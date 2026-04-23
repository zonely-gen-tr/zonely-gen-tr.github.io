import type { GraphicsBackend } from '../../../src/appViewer'
import type { ThreeJsBackendMethods } from './graphicsBackend'

export function getThreeJsRendererMethods (): ThreeJsBackendMethods | undefined {
  const renderer = appViewer.backend
  if (renderer?.id !== 'threejs' || !renderer.backendMethods) return
  return new Proxy(renderer.backendMethods, {
    get (target, prop) {
      return async (...args) => {
        const result = await (target[prop as any] as any)(...args)
        return result
      }
    }
  }) as ThreeJsBackendMethods
}
