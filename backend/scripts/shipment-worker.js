import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import dotenv from 'dotenv'
import {
  createShipmentWorker,
  readShipmentWorkerConfig,
} from '../services/shipmentWorker.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendDirectory = path.resolve(__dirname, '..')
const envFile = path.resolve(backendDirectory, '.env')

export const runShipmentWorker = async ({
  env = process.env,
  loadPrisma = () => import('../lib/prisma.js'),
  loadProcessor = () => import('../services/shipmentProcessor.js'),
  signalSource = process,
  logger = console,
} = {}) => {
  if (env.SHIPMENT_WORKER_ENABLED !== 'true') {
    logger.info?.('[ShipmentWorker] Disabled; exiting without loading database or processor modules.')
    return { enabled: false }
  }

  const config = readShipmentWorkerConfig(env)
  const [prismaModule, processorModule] = await Promise.all([loadPrisma(), loadProcessor()])
  const prisma = prismaModule.default
  if (!prisma || typeof prisma.$connect !== 'function' || typeof prisma.$disconnect !== 'function') {
    throw new TypeError('The Prisma client is unavailable.')
  }
  if (typeof processorModule.createShipmentProcessor !== 'function') {
    throw new TypeError('The shipment processor is unavailable.')
  }

  let worker
  let stopping = false
  let shutdownPromise
  const requestShutdown = () => {
    stopping = true
    if (worker && !shutdownPromise) shutdownPromise = worker.stop()
  }

  signalSource.once('SIGTERM', requestShutdown)
  signalSource.once('SIGINT', requestShutdown)

  try {
    await prisma.$connect()
    if (stopping) return { enabled: true }

    const processor = processorModule.createShipmentProcessor({ prismaClient: prisma })
    worker = createShipmentWorker({
      shipmentModel: prisma.shipment,
      processShipment: processor.processShipment,
      ...config,
      logger,
    })
    if (stopping) return { enabled: true }
    await worker.run()
    return { enabled: true }
  } finally {
    signalSource.removeListener('SIGTERM', requestShutdown)
    signalSource.removeListener('SIGINT', requestShutdown)
    try {
      if (worker) {
        if (!shutdownPromise) shutdownPromise = worker.stop()
        await shutdownPromise
      }
    } finally {
      await prisma.$disconnect()
    }
  }
}

export const runStandaloneShipmentWorker = async ({ dotenvConfig = dotenv.config, ...options } = {}) => {
  dotenvConfig({ path: envFile })
  return runShipmentWorker(options)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runStandaloneShipmentWorker().catch(() => {
    console.error('[ShipmentWorker] Startup or runtime failure; worker stopped.')
    process.exitCode = 1
  })
}
