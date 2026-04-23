import { proxy, getVersion, subscribe } from 'valtio'

export function createWorkerProxy<T extends Record<string, (...args: any[]) => void | Promise<any>>> (handlers: T, channel?: MessagePort): { __workerProxy: T } {
  const target = channel ?? globalThis
  target.addEventListener('message', (event: any) => {
    const { type, args, msgId } = event.data
    if (handlers[type]) {
      const result = handlers[type](...args)
      if (result instanceof Promise) {
        void result.then((result) => {
          target.postMessage({
            type: 'result',
            msgId,
            args: [result]
          })
        })
      }
    }
  })
  return null as any
}

/**
 * in main thread
 * ```ts
 * // either:
 * import type { importedTypeWorkerProxy } from './worker'
 * // or:
 * type importedTypeWorkerProxy = import('./worker').importedTypeWorkerProxy
 *
 * const workerChannel = useWorkerProxy<typeof importedTypeWorkerProxy>(worker)
 * ```
 */
export const useWorkerProxy = <T extends { __workerProxy: Record<string, (...args: any[]) => void> }> (worker: Worker | MessagePort, autoTransfer = true): T['__workerProxy'] & {
  transfer: (...args: Transferable[]) => T['__workerProxy']
} => {
  let messageId = 0
  // in main thread
  return new Proxy({} as any, {
    get (target, prop) {
      if (prop === 'transfer') {
        return (...transferable: Transferable[]) => {
          return new Proxy({}, {
            get (target, prop) {
              return (...args: any[]) => {
                worker.postMessage({
                  type: prop,
                  args,
                }, transferable)
              }
            }
          })
        }
      }
      return (...args: any[]) => {
        const msgId = messageId++
        const transfer = autoTransfer ? args.filter(arg => {
          return arg instanceof ArrayBuffer || arg instanceof MessagePort
            || (typeof ImageBitmap !== 'undefined' && arg instanceof ImageBitmap)
            || (typeof OffscreenCanvas !== 'undefined' && arg instanceof OffscreenCanvas)
            || (typeof ImageData !== 'undefined' && arg instanceof ImageData)
        }) : []
        worker.postMessage({
          type: prop,
          msgId,
          args,
        }, transfer)
        return {
          // eslint-disable-next-line unicorn/no-thenable
          then (onfulfilled: (value: any) => void) {
            const handler = ({ data }: MessageEvent): void => {
              if (data.type === 'result' && data.msgId === msgId) {
                onfulfilled(data.args[0])
                worker.removeEventListener('message', handler as EventListener)
              }
            }
            worker.addEventListener('message', handler as EventListener)
          }
        }
      }
    }
  })
}

// const workerProxy = createWorkerProxy({
//     startRender (canvas: HTMLCanvasElement) {
//     },
// })

// const worker = useWorkerProxy(null, workerProxy)

// worker.
