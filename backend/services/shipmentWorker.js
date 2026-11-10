const CLAIMABLE_STATUSES = ['PENDING', 'RETRY_SCHEDULED']
const MAX_BATCH_SIZE = 10
const MAX_CONCURRENCY = 2
const MIN_POLL_INTERVAL_MS = 5_000
const MAX_POLL_INTERVAL_MS = 5 * 60 * 1_000
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

const boundedInteger = (value, { name, defaultValue, min, max }) => {
  const raw = value === undefined ? String(defaultValue) : String(value)
  if (!/^\d+$/.test(raw)) {
    throw new TypeError(`${name} must be a positive bounded integer.`)
  }
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`)
  }
  return parsed
}

export const parseShipmentWorkerCutoff = (value) => {
  if (typeof value !== 'string' || !UTC_TIMESTAMP_PATTERN.test(value)) {
    throw new TypeError('SHIPMENT_WORKER_CREATED_AT_CUTOFF must be an explicit UTC timestamp.')
  }

  const cutoff = new Date(value)
  const fractionalSeconds = value.match(/\.(\d{1,3})Z$/)?.[1] ?? ''
  if (
    !Number.isFinite(cutoff.getTime())
    || cutoff.toISOString().slice(0, 19) !== value.slice(0, 19)
    || cutoff.getUTCMilliseconds() !== Number(fractionalSeconds.padEnd(3, '0') || 0)
  ) {
    throw new TypeError('SHIPMENT_WORKER_CREATED_AT_CUTOFF must be a valid UTC timestamp.')
  }
  return cutoff
}

export const readShipmentWorkerConfig = (env = process.env) => ({
  createdAtCutoff: parseShipmentWorkerCutoff(env.SHIPMENT_WORKER_CREATED_AT_CUTOFF),
  batchSize: boundedInteger(env.SHIPMENT_WORKER_BATCH_SIZE, {
    name: 'SHIPMENT_WORKER_BATCH_SIZE',
    defaultValue: MAX_BATCH_SIZE,
    min: 1,
    max: MAX_BATCH_SIZE,
  }),
  concurrency: boundedInteger(env.SHIPMENT_WORKER_CONCURRENCY, {
    name: 'SHIPMENT_WORKER_CONCURRENCY',
    defaultValue: MAX_CONCURRENCY,
    min: 1,
    max: MAX_CONCURRENCY,
  }),
  pollIntervalMs: boundedInteger(env.SHIPMENT_WORKER_POLL_INTERVAL_MS, {
    name: 'SHIPMENT_WORKER_POLL_INTERVAL_MS',
    defaultValue: MIN_POLL_INTERVAL_MS,
    min: MIN_POLL_INTERVAL_MS,
    max: MAX_POLL_INTERVAL_MS,
  }),
})

export const createShipmentWorker = ({
  shipmentModel,
  processShipment,
  createdAtCutoff,
  batchSize = MAX_BATCH_SIZE,
  concurrency = MAX_CONCURRENCY,
  pollIntervalMs = MIN_POLL_INTERVAL_MS,
  clock = () => new Date(),
  logger = console,
} = {}) => {
  if (typeof shipmentModel?.findMany !== 'function' || typeof processShipment !== 'function') {
    throw new TypeError('A shipment model and shipment processor are required.')
  }
  if (!(createdAtCutoff instanceof Date) || !Number.isFinite(createdAtCutoff.getTime())) {
    throw new TypeError('A valid shipment activation cutoff is required.')
  }
  boundedInteger(batchSize, { name: 'batchSize', defaultValue: MAX_BATCH_SIZE, min: 1, max: MAX_BATCH_SIZE })
  boundedInteger(concurrency, { name: 'concurrency', defaultValue: MAX_CONCURRENCY, min: 1, max: MAX_CONCURRENCY })
  boundedInteger(pollIntervalMs, {
    name: 'pollIntervalMs',
    defaultValue: MIN_POLL_INTERVAL_MS,
    min: MIN_POLL_INTERVAL_MS,
    max: MAX_POLL_INTERVAL_MS,
  })

  let stopping = false
  let cyclePromise = null
  let runPromise = null
  let wakePoll = null

  const reportFailure = (stage) => {
    logger.error?.(`[ShipmentWorker] ${stage} failed.`)
  }

  const runCycle = () => {
    if (stopping) return Promise.resolve({ discovered: 0, started: 0, processorErrors: 0 })
    if (cyclePromise) return cyclePromise

    const cycle = (async () => {
      const now = clock()
      const shipments = await shipmentModel.findMany({
        where: {
          status: { in: CLAIMABLE_STATUSES },
          nextAttemptAt: { lte: now },
          processingStartedAt: null,
          processingLeaseToken: null,
          packageConfirmedAt: { not: null },
          packageConfirmedById: { not: null },
          packageWeightKg: { not: null },
          packageLengthCm: { not: null },
          packageBreadthCm: { not: null },
          packageHeightCm: { not: null },
          createdAt: { gte: createdAtCutoff },
        },
        orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
        take: batchSize,
        select: { id: true },
      })

      const selected = shipments.slice(0, batchSize)
      let nextIndex = 0
      let started = 0
      let processorErrors = 0

      const processNext = async () => {
        while (!stopping) {
          const index = nextIndex
          nextIndex += 1
          if (index >= selected.length) return

          const shipmentId = selected[index]?.id
          if (!Number.isSafeInteger(shipmentId) || shipmentId < 1) {
            reportFailure('Shipment discovery')
            continue
          }

          started += 1
          try {
            await processShipment(shipmentId)
          } catch {
            processorErrors += 1
            reportFailure('Shipment processing')
          }
        }
      }

      const workerCount = Math.min(concurrency, selected.length)
      await Promise.all(Array.from({ length: workerCount }, () => processNext()))
      return { discovered: selected.length, started, processorErrors }
    })()

    cyclePromise = cycle.finally(() => {
      cyclePromise = null
    })
    return cyclePromise
  }

  const waitForNextPoll = () => new Promise((resolve) => {
    let settled = false
    let timer
    const finish = () => {
      if (settled) return
      settled = true
      wakePoll = null
      resolve()
    }

    timer = setTimeout(finish, pollIntervalMs)
    wakePoll = () => {
      clearTimeout(timer)
      finish()
    }
  })

  const run = () => {
    if (runPromise) return runPromise
    if (stopping) return Promise.resolve()

    runPromise = (async () => {
      while (!stopping) {
        try {
          await runCycle()
        } catch {
          reportFailure('Shipment discovery')
        }
        if (!stopping) await waitForNextPoll()
      }
    })()
    return runPromise
  }

  const stop = async () => {
    stopping = true
    wakePoll?.()
    if (runPromise) await runPromise
    else if (cyclePromise) await cyclePromise
  }

  return Object.freeze({ run, runCycle, stop })
}
