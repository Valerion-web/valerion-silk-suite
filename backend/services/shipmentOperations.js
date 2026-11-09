import { createHash, randomUUID } from 'node:crypto'
import { shiprocketClient } from './shiprocketService.js'

const RETRY_DELAY_MS = 60_000
const PROCESSING_LEASE_TIMEOUT_MS = 60_000
const OPERATION_TYPES = Object.freeze({
  ASSIGN_AWB: 'ASSIGN_AWB',
  GENERATE_LABEL: 'GENERATE_LABEL',
  REQUEST_PICKUP: 'REQUEST_PICKUP',
  GENERATE_MANIFEST: 'GENERATE_MANIFEST',
  PRINT_MANIFEST: 'PRINT_MANIFEST',
})
const RECONCILIATION_REQUIRED = 'RECONCILIATION_REQUIRED'
const SAFE_TO_RETRY_STAGES = ['NOT_SUBMITTED', 'REJECTED']
const SAFE_ERROR_CODES = new Set([
  'SHIPROCKET_CONFIG_MISSING',
  'SHIPROCKET_AUTH_UNAVAILABLE',
  'SHIPROCKET_AUTH_FAILED',
  'SHIPROCKET_REQUEST_FAILED',
  'SHIPROCKET_REQUEST_UNAVAILABLE',
  'SHIPROCKET_INVALID_RESPONSE',
  'SHIPROCKET_INVALID_REQUEST',
  'SHIPROCKET_OUTCOME_UNCERTAIN',
])
const ERROR_MESSAGES = Object.freeze({
  SHIPROCKET_CONFIG_MISSING: 'Shiprocket is not configured.',
  SHIPROCKET_AUTH_UNAVAILABLE: 'Shiprocket authentication is temporarily unavailable.',
  SHIPROCKET_AUTH_FAILED: 'Shiprocket authentication failed before operation submission.',
  SHIPROCKET_REQUEST_FAILED: 'Shiprocket rejected the operation.',
  SHIPROCKET_REQUEST_UNAVAILABLE: 'Shiprocket operation outcome is uncertain; reconcile before retrying.',
  SHIPROCKET_INVALID_RESPONSE: 'Shiprocket returned an incomplete or invalid operation response.',
  SHIPROCKET_INVALID_REQUEST: 'The Shiprocket operation request is invalid.',
  OPERATION_PERSISTENCE_FAILED: 'Shiprocket accepted the operation but its result could not be saved.',
})

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonEmptyString = (value) => typeof value === 'string' && value.trim() ? value.trim() : null
const scalarString = (value) => (typeof value === 'string' || typeof value === 'number') && String(value).trim()
  ? String(value).trim()
  : null

const providerData = (response) => {
  if (!isRecord(response)) return null
  if (isRecord(response.response?.data)) return response.response.data
  if (isRecord(response.data)) return response.data
  if (isRecord(response.response)) return response.response
  return response
}

const secureDocumentUrl = (value) => {
  const url = nonEmptyString(value)
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.toString() : null
  } catch {
    return null
  }
}

const errorOutcome = (error) => {
  if (error?.code === 'SHIPROCKET_CONFIG_MISSING' || error?.code === 'SHIPROCKET_INVALID_REQUEST') {
    return { status: 'FAILED', stage: 'NOT_SUBMITTED', code: error.code }
  }
  if (error?.code === 'SHIPROCKET_AUTH_UNAVAILABLE' || error?.code === 'SHIPROCKET_AUTH_FAILED') {
    return { status: 'RETRY_SCHEDULED', stage: 'NOT_SUBMITTED', code: error.code }
  }
  if (error?.code === 'SHIPROCKET_REQUEST_FAILED' && Number.isInteger(error.statusCode)) {
    if (error.statusCode === 429 || error.statusCode === 401) {
      return { status: 'RETRY_SCHEDULED', stage: 'REJECTED', code: error.code }
    }
    if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 408) {
      return { status: 'FAILED', stage: 'REJECTED', code: error.code }
    }
  }
  return {
    status: RECONCILIATION_REQUIRED,
    stage: 'SUBMISSION_STARTED',
    code: SAFE_ERROR_CODES.has(error?.code) ? error.code : 'SHIPROCKET_OUTCOME_UNCERTAIN',
  }
}

const operationResult = (operation, outcome, extra = {}) => ({
  outcome,
  operation: {
    id: operation.id,
    operationType: operation.operationType,
    status: operation.status,
    requestSubmissionStage: operation.requestSubmissionStage,
    attemptCount: operation.attemptCount,
    lastErrorCode: operation.lastErrorCode,
    lastErrorMessage: operation.lastErrorMessage,
  },
  ...extra,
})

const manifestOperationIdentity = (manifestId, type) => `manifest:${manifestId}:${type}`
const shipmentOperationIdentity = (shipmentId, type) => `shipment:${shipmentId}:${type}`

export const createShipmentOperationsService = ({
  prismaClient,
  shiprocketClient: client = shiprocketClient,
  clock = () => new Date(),
  createLeaseToken = randomUUID,
} = {}) => {
  if (
    (prismaClient && (!prismaClient.shipment || !prismaClient.shipmentOperation || !prismaClient.shipmentManifest))
    || !client
    || typeof clock !== 'function'
    || typeof createLeaseToken !== 'function'
  ) {
    throw new TypeError('Prisma, a Shiprocket client, and operation clock are required')
  }

  const getPrismaClient = async () => {
    if (prismaClient) return prismaClient
    const loaded = await import('../lib/prisma.js')
    return loaded.default
  }

  const markOperation = async (database, operation, leaseToken, data) => {
    const updated = await database.shipmentOperation.updateMany({
      where: { id: operation.id, status: 'PROCESSING', processingLeaseToken: leaseToken },
      data: {
        ...data,
        processingStartedAt: null,
        processingLeaseToken: null,
      },
    })
    return updated.count === 1
  }

  const reconcileOperation = async (
    database,
    operation,
    leaseToken,
    code = 'OPERATION_PERSISTENCE_FAILED',
    applyReconciliation,
  ) => {
    const message = ERROR_MESSAGES[code] || ERROR_MESSAGES.OPERATION_PERSISTENCE_FAILED
    const data = {
      status: RECONCILIATION_REQUIRED,
      requestSubmissionStage: 'SUBMISSION_STARTED',
      lastErrorCode: code,
      lastErrorMessage: message,
    }
    const updated = await database.$transaction(async (transaction) => {
      if (applyReconciliation) await applyReconciliation(transaction, operation, leaseToken, data)
      return markOperation(transaction, operation, leaseToken, data)
    })
    if (!updated) return { ...operationResult(operation, 'LEASE_LOST'), outcome: 'LEASE_LOST' }
    return operationResult({ ...operation, ...data }, RECONCILIATION_REQUIRED)
  }

  const executeOperation = async ({
    database,
    operation,
    request,
    applySuccess,
    applyProcessing,
    applyFailure,
    applyReconciliation,
  }) => {
    const now = clock()
    if (operation.status === 'SUCCEEDED') return operationResult(operation, 'ALREADY_SUCCEEDED')
    if (operation.status === RECONCILIATION_REQUIRED) {
      return operationResult(operation, RECONCILIATION_REQUIRED)
    }
    if (operation.status === 'FAILED') return operationResult(operation, 'FAILED')
    if (operation.status === 'PROCESSING') {
      if (
        operation.processingLeaseToken
        && operation.processingStartedAt instanceof Date
        && now.getTime() - operation.processingStartedAt.getTime() >= PROCESSING_LEASE_TIMEOUT_MS
      ) {
        const data = {
          status: RECONCILIATION_REQUIRED,
          requestSubmissionStage: 'SUBMISSION_STARTED',
          lastErrorCode: 'SHIPROCKET_OUTCOME_UNCERTAIN',
          lastErrorMessage: ERROR_MESSAGES.SHIPROCKET_REQUEST_UNAVAILABLE,
          processingStartedAt: null,
          processingLeaseToken: null,
        }
        const updated = await database.$transaction(async (transaction) => {
          if (applyReconciliation) {
            await applyReconciliation(transaction, operation, operation.processingLeaseToken, data)
          }
          return transaction.shipmentOperation.updateMany({
            where: {
              id: operation.id,
              status: 'PROCESSING',
              processingLeaseToken: operation.processingLeaseToken,
            },
            data,
          })
        })
        return updated.count === 1
          ? operationResult({ ...operation, ...data }, RECONCILIATION_REQUIRED)
          : operationResult(operation, 'PROCESSING')
      }
      return operationResult(operation, 'PROCESSING')
    }
    if (operation.nextAttemptAt > now) return operationResult(operation, 'RETRY_SCHEDULED')
    if (!SAFE_TO_RETRY_STAGES.includes(operation.requestSubmissionStage)) {
      return operationResult(operation, RECONCILIATION_REQUIRED)
    }

    const leaseToken = createLeaseToken()
    const claim = await database.shipmentOperation.updateMany({
      where: {
        id: operation.id,
        status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
        nextAttemptAt: { lte: now },
        requestSubmissionStage: { in: SAFE_TO_RETRY_STAGES },
        processingStartedAt: null,
        processingLeaseToken: null,
      },
      data: {
        status: 'PROCESSING',
        requestSubmissionStage: 'SUBMISSION_STARTED',
        attemptCount: { increment: 1 },
        processingStartedAt: now,
        processingLeaseToken: leaseToken,
      },
    })
    if (claim.count !== 1) {
      const current = await database.shipmentOperation.findUnique({ where: { id: operation.id } })
      if (!current) return operationResult(operation, 'NOT_FOUND')
      return operationResult(current, current.status)
    }

    const claimedOperation = {
      ...operation,
      status: 'PROCESSING',
      requestSubmissionStage: 'SUBMISSION_STARTED',
      attemptCount: operation.attemptCount + 1,
      processingStartedAt: now,
      processingLeaseToken: leaseToken,
    }

    if (applyProcessing) {
      try {
        await applyProcessing(database, claimedOperation, leaseToken)
      } catch {
        const data = {
          status: 'FAILED',
          requestSubmissionStage: 'NOT_SUBMITTED',
          lastErrorCode: 'OPERATION_PROCESSING_PERSISTENCE_FAILED',
          lastErrorMessage: 'The operation could not be prepared for submission.',
        }
        await markOperation(database, claimedOperation, leaseToken, data)
        return operationResult({ ...claimedOperation, ...data }, 'FAILED')
      }
    }

    let response
    try {
      response = await request()
    } catch (error) {
      const classification = errorOutcome(error)
      const message = classification.status === RECONCILIATION_REQUIRED
        ? ERROR_MESSAGES.SHIPROCKET_REQUEST_UNAVAILABLE
        : ERROR_MESSAGES[classification.code] || ERROR_MESSAGES.SHIPROCKET_REQUEST_FAILED
      const operationFailure = {
        status: classification.status,
        requestSubmissionStage: classification.stage,
        nextAttemptAt: classification.status === 'RETRY_SCHEDULED'
          ? new Date(clock().getTime() + RETRY_DELAY_MS)
          : now,
        lastErrorCode: classification.code,
        lastErrorMessage: message,
      }
      const updated = await database.$transaction(async (transaction) => {
        if (applyFailure) {
          await applyFailure(transaction, claimedOperation, leaseToken, classification, message)
        }
        return markOperation(transaction, claimedOperation, leaseToken, operationFailure)
      })
      if (!updated) return operationResult(claimedOperation, 'LEASE_LOST')
      return operationResult({
        ...claimedOperation,
        ...operationFailure,
        lastErrorMessage: message,
      }, classification.status)
    }

    const normalized = applySuccess(response, claimedOperation, leaseToken)
    if (!normalized) {
      return reconcileOperation(
        database,
        claimedOperation,
        leaseToken,
        'SHIPROCKET_INVALID_RESPONSE',
        applyReconciliation,
      )
    }

    try {
      await database.$transaction(async (transaction) => {
        await normalized.persistTarget(transaction)
        const saved = await transaction.shipmentOperation.updateMany({
          where: { id: operation.id, status: 'PROCESSING', processingLeaseToken: leaseToken },
          data: {
            status: 'SUCCEEDED',
            requestSubmissionStage: 'PROVIDER_ACCEPTED',
            nextAttemptAt: now,
            providerReference: normalized.providerReference || null,
            lastErrorCode: null,
            lastErrorMessage: null,
            processingStartedAt: null,
            processingLeaseToken: null,
          },
        })
        if (saved.count !== 1) throw new Error('Shipment operation lease was lost before persistence')
      })
    } catch {
      return reconcileOperation(
        database,
        claimedOperation,
        leaseToken,
        'OPERATION_PERSISTENCE_FAILED',
        normalized.persistReconciliation,
      )
    }

    const succeededOperation = {
      ...claimedOperation,
      status: 'SUCCEEDED',
      requestSubmissionStage: 'PROVIDER_ACCEPTED',
      processingStartedAt: null,
      processingLeaseToken: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      providerReference: normalized.providerReference || null,
    }
    return operationResult(succeededOperation, 'SUCCEEDED', normalized.result)
  }

  const ensureShipmentOperation = (database, shipmentId, type) => database.shipmentOperation.upsert({
    where: { identityKey: shipmentOperationIdentity(shipmentId, type) },
    create: {
      identityKey: shipmentOperationIdentity(shipmentId, type),
      shipmentId,
      operationType: type,
    },
    update: {},
  })

  const executeShipmentOperation = async (shipmentId, type, courierId) => {
    if (!Number.isSafeInteger(shipmentId) || shipmentId < 1) {
      return { outcome: 'INVALID_SHIPMENT_ID' }
    }
    const database = await getPrismaClient()
    const shipment = await database.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        operations: {
          where: { operationType: OPERATION_TYPES.REQUEST_PICKUP, status: 'SUCCEEDED' },
          select: { id: true },
        },
      },
    })
    if (!shipment) return { outcome: 'NOT_FOUND' }
    if (!shipment.shiprocketShipmentId) return { outcome: 'SHIPROCKET_SHIPMENT_ID_REQUIRED' }

    if (type === OPERATION_TYPES.ASSIGN_AWB && shipment.awbCode) {
      return { outcome: 'AWB_ALREADY_ASSIGNED', awbCode: shipment.awbCode }
    }
    if (type === OPERATION_TYPES.GENERATE_LABEL && !shipment.awbCode) {
      return { outcome: 'AWB_REQUIRED' }
    }
    if (type === OPERATION_TYPES.GENERATE_LABEL && shipment.labelUrl) {
      return { outcome: 'ALREADY_SUCCEEDED', labelUrl: shipment.labelUrl, generatedAt: shipment.labelGeneratedAt }
    }
    if (type === OPERATION_TYPES.REQUEST_PICKUP && !shipment.awbCode) {
      return { outcome: 'AWB_REQUIRED' }
    }
    if (type === OPERATION_TYPES.REQUEST_PICKUP && shipment.pickupRequestedAt) {
      return {
        outcome: 'ALREADY_SUCCEEDED',
        pickupRequestedAt: shipment.pickupRequestedAt,
        pickupEstimatedAt: shipment.pickupEstimatedAt,
        pickupProviderReference: shipment.pickupProviderReference,
      }
    }

    const operation = await ensureShipmentOperation(database, shipmentId, type)
    return executeOperation({
      database,
      operation,
      request: () => {
        if (type === OPERATION_TYPES.ASSIGN_AWB) {
          return client.assignAwb({ shipmentId: shipment.shiprocketShipmentId, courierId })
        }
        if (type === OPERATION_TYPES.GENERATE_LABEL) {
          return client.generateLabel(shipment.shiprocketShipmentId)
        }
        return client.requestPickup(shipment.shiprocketShipmentId)
      },
      applySuccess: (response) => {
        const data = providerData(response)
        if (!data) return null

        if (type === OPERATION_TYPES.ASSIGN_AWB) {
          const awbCode = scalarString(data.awb_code || data.awb)
          if (!awbCode) return null
          const courierCompanyId = scalarString(data.courier_company_id || data.courier_id) || (
            courierId === undefined ? null : String(courierId)
          )
          const courierName = nonEmptyString(data.courier_name || data.courier_company_name)
          return {
            providerReference: awbCode,
            result: { awbCode, courierCompanyId, courierName },
            persistTarget: (transaction) => transaction.shipment.updateMany({
              where: { id: shipmentId, awbCode: null },
              data: {
                awbCode,
                awbNormalized: awbCode.replace(/\s+/g, '').toUpperCase(),
                courierCompanyId,
                courierName,
              },
            }).then((updated) => {
              if (updated.count !== 1) throw new Error('AWB already exists')
            }),
          }
        }

        if (type === OPERATION_TYPES.GENERATE_LABEL) {
          const labelUrl = secureDocumentUrl(data.label_url || data.label_urls?.[0])
          if (!labelUrl) return null
          const generatedAt = clock()
          return {
            result: { labelUrl, generatedAt },
            persistTarget: (transaction) => transaction.shipment.updateMany({
              where: { id: shipmentId, labelUrl: null },
              data: { labelUrl, labelGeneratedAt: generatedAt },
            }).then((updated) => {
              if (updated.count !== 1) throw new Error('Label already exists')
            }),
          }
        }

        const pickup = Array.isArray(data.response) ? data.response[0] : data
        const pickupData = isRecord(pickup) ? pickup : data
        const pickupEstimatedAtValue = pickupData.pickup_scheduled_date || pickupData.pickup_date
        const pickupEstimatedAt = pickupEstimatedAtValue && !Number.isNaN(Date.parse(pickupEstimatedAtValue))
          ? new Date(pickupEstimatedAtValue)
          : null
        const pickupProviderReference = scalarString(
          pickupData.pickup_id || pickupData.pickup_request_id || pickupData.id,
        )
        const pickupStatus = pickupData.pickup_status ?? data.pickup_status
        const statusText = pickupData.status ?? data.status
        const accepted = pickupStatus === 1
          || pickupStatus === true
          || statusText === true
          || (typeof statusText === 'string' && /scheduled|accepted|requested/i.test(statusText))
          || Boolean(pickupProviderReference || pickupEstimatedAt)
        if (!accepted || (pickupStatus !== undefined && pickupStatus !== 1 && pickupStatus !== true)) return null
        const pickupRequestedAt = clock()
        return {
          providerReference: pickupProviderReference,
          result: { pickupRequestedAt, pickupEstimatedAt, pickupProviderReference },
          persistTarget: (transaction) => transaction.shipment.updateMany({
            where: { id: shipmentId, pickupRequestedAt: null },
            data: { pickupRequestedAt, pickupEstimatedAt, pickupProviderReference },
          }).then((updated) => {
            if (updated.count !== 1) throw new Error('Pickup request already exists')
          }),
        }
      },
    })
  }

  const assignAwb = (shipmentId, courierId) => {
    if (courierId !== undefined && (!Number.isSafeInteger(courierId) || courierId < 1)) {
      return Promise.resolve({ outcome: 'INVALID_COURIER_ID' })
    }
    return executeShipmentOperation(shipmentId, OPERATION_TYPES.ASSIGN_AWB, courierId)
  }

  const generateLabel = (shipmentId) => executeShipmentOperation(shipmentId, OPERATION_TYPES.GENERATE_LABEL)
  const requestPickup = (shipmentId) => executeShipmentOperation(shipmentId, OPERATION_TYPES.REQUEST_PICKUP)

  const getShipmentOperations = async (shipmentId) => {
    if (!Number.isSafeInteger(shipmentId) || shipmentId < 1) return null
    const database = await getPrismaClient()
    const shipment = await database.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        orderId: true,
        status: true,
        shiprocketOrderId: true,
        shiprocketShipmentId: true,
        awbCode: true,
        courierName: true,
        courierCompanyId: true,
        trackingStatus: true,
        trackingStatusAt: true,
        estimatedDeliveryAt: true,
        labelUrl: true,
        labelGeneratedAt: true,
        pickupRequestedAt: true,
        pickupEstimatedAt: true,
        pickupProviderReference: true,
        operations: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            operationType: true,
            status: true,
            requestSubmissionStage: true,
            attemptCount: true,
            nextAttemptAt: true,
            processingStartedAt: true,
            providerReference: true,
            lastErrorCode: true,
            lastErrorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        trackingEvents: {
          orderBy: { occurredAt: 'asc' },
          select: {
            id: true,
            source: true,
            status: true,
            statusId: true,
            shipmentStatus: true,
            shipmentStatusId: true,
            activity: true,
            location: true,
            srStatus: true,
            srStatusLabel: true,
            occurredAt: true,
          },
        },
        manifestItems: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            manifestId: true,
            manifest: {
              select: {
                id: true,
                status: true,
                shiprocketManifestId: true,
                manifestUrl: true,
                generatedAt: true,
                printUrl: true,
                printedAt: true,
                lastErrorCode: true,
                lastErrorMessage: true,
                operations: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    operationType: true,
                    status: true,
                    requestSubmissionStage: true,
                    attemptCount: true,
                    lastErrorCode: true,
                    lastErrorMessage: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    return shipment
  }

  const getManifestOperations = async (manifestId) => {
    if (!Number.isSafeInteger(manifestId) || manifestId < 1) return null
    const database = await getPrismaClient()
    return database.shipmentManifest.findUnique({
      where: { id: manifestId },
      select: {
        id: true,
        status: true,
        shiprocketManifestId: true,
        manifestUrl: true,
        generatedAt: true,
        printUrl: true,
        printedAt: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        items: {
          orderBy: { id: 'asc' },
          select: { id: true, shipmentId: true, shiprocketOrderId: true, shiprocketShipmentId: true },
        },
        operations: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            operationType: true,
            status: true,
            requestSubmissionStage: true,
            attemptCount: true,
            nextAttemptAt: true,
            processingStartedAt: true,
            providerReference: true,
            lastErrorCode: true,
            lastErrorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })
  }

  const createManifest = async (shipmentIds, storeId) => {
    if (
      !Array.isArray(shipmentIds)
      || shipmentIds.length === 0
      || shipmentIds.some((id) => !Number.isSafeInteger(id) || id < 1)
      || new Set(shipmentIds).size !== shipmentIds.length
      || !Number.isSafeInteger(storeId)
      || storeId < 1
    ) {
      return { outcome: 'INVALID_REQUEST' }
    }
    const database = await getPrismaClient()
    const sortedIds = [...shipmentIds].sort((a, b) => a - b)
    const requestKey = createHash('sha256').update(sortedIds.join(',')).digest('hex')
    const shipments = await database.shipment.findMany({
      where: {
        id: { in: sortedIds },
        order: { storeId },
      },
      include: {
        operations: {
          where: { operationType: OPERATION_TYPES.REQUEST_PICKUP, status: 'SUCCEEDED' },
          select: { id: true },
        },
      },
    })
    if (shipments.length !== sortedIds.length) return { outcome: 'NOT_FOUND' }

    let manifest = await database.shipmentManifest.findUnique({
      where: { requestKey },
      include: { operations: true, items: true },
    })
    if (!manifest) {
      if (shipments.some((shipment) => (
        !shipment.shiprocketOrderId
        || !shipment.shiprocketShipmentId
        || !shipment.awbCode
        || !shipment.operations?.length
      ))) {
        return { outcome: 'PICKUP_REQUIRED' }
      }
      try {
        manifest = await database.$transaction(async (transaction) => {
          const created = await transaction.shipmentManifest.create({
            data: {
              requestKey,
              items: {
                create: shipments.map((shipment) => ({
                  shipmentId: shipment.id,
                  shiprocketOrderId: shipment.shiprocketOrderId,
                  shiprocketShipmentId: shipment.shiprocketShipmentId,
                })),
              },
            },
          })
          const operation = await transaction.shipmentOperation.create({
            data: {
              identityKey: manifestOperationIdentity(created.id, OPERATION_TYPES.GENERATE_MANIFEST),
              manifestId: created.id,
              operationType: OPERATION_TYPES.GENERATE_MANIFEST,
            },
          })
          return { ...created, operations: [operation], items: shipments }
        })
      } catch (error) {
        if (error?.code !== 'P2002') throw error
        manifest = await database.shipmentManifest.findUnique({
          where: { requestKey },
          include: { operations: true, items: true },
        })
        if (!manifest) throw error
      }
    }

    const operation = manifest.operations?.find((item) => item.operationType === OPERATION_TYPES.GENERATE_MANIFEST)
    if (!operation) throw new Error('Manifest generation operation is missing')
    return executeOperation({
      database,
      operation,
      request: async () => {
        const items = manifest.items?.length
          ? manifest.items
          : await database.shipmentManifestItem.findMany({
              where: { manifestId: manifest.id },
              orderBy: { id: 'asc' },
            })
        return client.generateManifest(items.map((item) => item.shiprocketShipmentId))
      },
      applyProcessing: async (target, claimedOperation, leaseToken) => {
        const updated = await target.shipmentManifest.updateMany({
          where: { id: manifest.id, status: { in: ['PENDING', 'RETRY_SCHEDULED'] } },
          data: {
            status: 'PROCESSING',
            requestSubmissionStage: 'SUBMISSION_STARTED',
            attemptCount: { increment: 1 },
            processingStartedAt: claimedOperation.processingStartedAt,
            processingLeaseToken: leaseToken,
          },
        })
        if (updated.count !== 1) throw new Error('Manifest processing lease could not be acquired')
      },
      applyFailure: async (target, claimedOperation, leaseToken, classification, message) => {
        await target.shipmentManifest.updateMany({
          where: { id: manifest.id, status: 'PROCESSING', processingLeaseToken: leaseToken },
          data: {
            status: classification.status,
            requestSubmissionStage: classification.stage,
            nextAttemptAt: classification.status === 'RETRY_SCHEDULED'
              ? new Date(clock().getTime() + RETRY_DELAY_MS)
              : clock(),
            lastErrorCode: classification.code,
            lastErrorMessage: message,
            processingStartedAt: null,
            processingLeaseToken: null,
          },
        })
      },
      applyReconciliation: async (target, claimedOperation, leaseToken, data) => {
        const updated = await target.shipmentManifest.updateMany({
          where: { id: manifest.id, status: 'PROCESSING', processingLeaseToken: leaseToken },
          data: {
            status: RECONCILIATION_REQUIRED,
            requestSubmissionStage: data.requestSubmissionStage,
            lastErrorCode: data.lastErrorCode,
            lastErrorMessage: data.lastErrorMessage,
            processingStartedAt: null,
            processingLeaseToken: null,
          },
        })
        if (updated.count !== 1) throw new Error('Manifest reconciliation state could not be saved')
      },
      applySuccess: (response, claimedOperation, leaseToken) => {
        const data = providerData(response)
        const manifestUrl = secureDocumentUrl(data?.manifest_url || data?.manifestUrl)
        if (!data || !manifestUrl) return null
        const generatedAt = clock()
        const shiprocketManifestId = scalarString(data.manifest_id || data.id)
        const safeProviderResponse = {
          manifest_id: shiprocketManifestId,
          status: scalarString(data.status),
        }
        return {
          providerReference: shiprocketManifestId,
          result: { manifestId: manifest.id, manifestUrl, generatedAt },
          persistTarget: async (transaction) => {
            const updated = await transaction.shipmentManifest.updateMany({
              where: { id: manifest.id, processingLeaseToken: leaseToken },
              data: {
                status: 'GENERATED',
                shiprocketManifestId,
                manifestUrl,
                generatedAt,
                providerResponse: safeProviderResponse,
                requestSubmissionStage: 'PROVIDER_ACCEPTED',
                processingStartedAt: null,
                processingLeaseToken: null,
                lastErrorCode: null,
                lastErrorMessage: null,
              },
            })
            if (updated.count !== 1) throw new Error('Manifest processing lease was lost')
          },
          persistReconciliation: async (target) => {
            const updated = await target.shipmentManifest.updateMany({
              where: { id: manifest.id, status: 'PROCESSING', processingLeaseToken: leaseToken },
              data: {
                status: RECONCILIATION_REQUIRED,
                lastErrorCode: 'OPERATION_PERSISTENCE_FAILED',
                lastErrorMessage: ERROR_MESSAGES.OPERATION_PERSISTENCE_FAILED,
                processingStartedAt: null,
                processingLeaseToken: null,
              },
            })
            if (updated.count !== 1) throw new Error('Manifest reconciliation state could not be saved')
          },
        }
      },
    })
  }

  const printManifest = async (manifestId) => {
    if (!Number.isSafeInteger(manifestId) || manifestId < 1) return { outcome: 'INVALID_MANIFEST_ID' }
    const database = await getPrismaClient()
    const manifest = await database.shipmentManifest.findUnique({
      where: { id: manifestId },
      include: { operations: true, items: { orderBy: { id: 'asc' } } },
    })
    if (!manifest) return { outcome: 'NOT_FOUND' }
    if (manifest.status !== 'GENERATED') return { outcome: 'MANIFEST_NOT_GENERATED' }
    if (manifest.printUrl) {
      return { outcome: 'ALREADY_SUCCEEDED', manifestId, printUrl: manifest.printUrl, printedAt: manifest.printedAt }
    }

    let operation = manifest.operations?.find((item) => item.operationType === OPERATION_TYPES.PRINT_MANIFEST)
    if (!operation) {
      try {
        operation = await database.shipmentOperation.create({
          data: {
            identityKey: manifestOperationIdentity(manifest.id, OPERATION_TYPES.PRINT_MANIFEST),
            manifestId: manifest.id,
            operationType: OPERATION_TYPES.PRINT_MANIFEST,
          },
        })
      } catch (error) {
        if (error?.code !== 'P2002') throw error
        operation = await database.shipmentOperation.findUnique({
          where: { identityKey: manifestOperationIdentity(manifest.id, OPERATION_TYPES.PRINT_MANIFEST) },
        })
      }
    }
    if (!operation) throw new Error('Manifest print operation could not be loaded')

    return executeOperation({
      database,
      operation,
      request: () => client.printManifest(manifest.items.map((item) => item.shiprocketOrderId)),
      applySuccess: (response) => {
        const data = providerData(response)
        const printUrl = secureDocumentUrl(data?.print_url || data?.manifest_url || data?.label_url)
        if (!data || !printUrl) return null
        const printedAt = clock()
        return {
          providerReference: scalarString(data.print_id || data.manifest_id || data.id),
          result: { manifestId: manifest.id, printUrl, printedAt },
          persistTarget: async (transaction) => {
            const updated = await transaction.shipmentManifest.updateMany({
              where: { id: manifest.id, status: 'GENERATED', printUrl: null },
              data: { printUrl, printedAt },
            })
            if (updated.count !== 1) throw new Error('Manifest has already been printed')
          },
        }
      },
    })
  }

  return Object.freeze({
    assignAwb,
    generateLabel,
    requestPickup,
    createManifest,
    printManifest,
    getShipmentOperations,
    getManifestOperations,
  })
}
