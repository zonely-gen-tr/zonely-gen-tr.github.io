import { noCase } from 'change-case'

export interface BenchmarkAdapterInfo {
  fixture: string
  // general load info
  worldLoadTimeSeconds: number

  // mesher
  mesherWorkersCount: number
  mesherProcessAvgMs: number
  mesherProcessWorstMs: number
  mesherProcessTotalMs: number
  chunksFullInfo: string

  // rendering backend
  averageRenderTimeMs: number
  worstRenderTimeMs: number
  fpsAveragePrediction: number
  fpsWorstPrediction: number
  fpsAverageReal: string
  fpsWorstReal: number
  backendInfoReport: string

  // main thread
  fpsAverageMainThread: number
  fpsWorstMainThread: number

  // memory total
  memoryUsageAverage: string
  memoryUsageWorst: string

  // context info
  gpuInfo: string
  hardwareConcurrency: number
  userAgent: string
  clientVersion: string
}

export const getAllInfo = (adapter: BenchmarkAdapterInfo) => {
  return Object.fromEntries(
    Object.entries(adapter).map(([key, value]) => {
      if (typeof value === 'function') {
        value = (value as () => any)()
      }
      if (typeof value === 'number') {
        value = value.toFixed(2)
      }
      return [noCase(key), value]
    })
  )
}

export const getAllInfoLines = (adapter: BenchmarkAdapterInfo, delayed = false) => {
  const info = getAllInfo(adapter)
  if (delayed) {
    for (const key in info) {
      if (key !== 'fpsAveragePrediction' && key !== 'fpsAverageReal') {
        delete info[key]
      }
    }
  }

  return Object.entries(info).map(([key, value]) => {
    return `${key}${delayed ? ' (delayed)' : ''}: ${value}`
  })
}
