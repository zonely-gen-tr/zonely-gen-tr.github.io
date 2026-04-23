import { proxy } from 'valtio'
import { NonReactiveState, RendererReactiveState } from '../../src/appViewer'

export const getDefaultRendererState = (): {
  reactive: RendererReactiveState
  nonReactive: NonReactiveState
} => {
  return {
    reactive: proxy({
      world: {
        chunksLoaded: new Set(),
        heightmaps: new Map(),
        allChunksLoaded: true,
        mesherWork: false,
        intersectMedia: null
      },
      renderer: '',
      preventEscapeMenu: false
    }),
    nonReactive: {
      world: {
        chunksLoaded: new Set(),
        chunksTotalNumber: 0,
      }
    }
  }
}
