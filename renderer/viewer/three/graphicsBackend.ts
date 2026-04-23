import * as THREE from 'three'
import { Vec3 } from 'vec3'
import { GraphicsBackendLoader, GraphicsBackend, GraphicsInitOptions, DisplayWorldOptions } from '../../../src/appViewer'
import { ProgressReporter } from '../../../src/core/progressReporter'
import { showNotification } from '../../../src/react/NotificationProvider'
import { displayEntitiesDebugList } from '../../playground/allEntitiesDebug'
import supportedVersions from '../../../src/supportedVersions.mjs'
import { ResourcesManager } from '../../../src/resourcesManager'
import { WorldRendererThree } from './worldrendererThree'
import { DocumentRenderer } from './documentRenderer'
import { PanoramaRenderer } from './panorama'
import { initVR } from './world/vr'

// https://discourse.threejs.org/t/updates-to-color-management-in-three-js-r152/50791
THREE.ColorManagement.enabled = false
globalThis.THREE = THREE

const getBackendMethods = (worldRenderer: WorldRendererThree) => {
  return {
    updateMap: worldRenderer.entities.updateMap.bind(worldRenderer.entities),
    updateCustomBlock: worldRenderer.updateCustomBlock.bind(worldRenderer),
    getBlockInfo: worldRenderer.getBlockInfo.bind(worldRenderer),
    playEntityAnimation: worldRenderer.entities.playAnimation.bind(worldRenderer.entities),
    damageEntity: worldRenderer.entities.handleDamageEvent.bind(worldRenderer.entities),
    updatePlayerSkin: worldRenderer.entities.updatePlayerSkin.bind(worldRenderer.entities),
    changeHandSwingingState: worldRenderer.changeHandSwingingState.bind(worldRenderer),
    getHighestBlocks: worldRenderer.getHighestBlocks.bind(worldRenderer),
    reloadWorld: worldRenderer.reloadWorld.bind(worldRenderer),

    addMedia: worldRenderer.media.addMedia.bind(worldRenderer.media),
    destroyMedia: worldRenderer.media.destroyMedia.bind(worldRenderer.media),
    setVideoPlaying: worldRenderer.media.setVideoPlaying.bind(worldRenderer.media),
    setVideoSeeking: worldRenderer.media.setVideoSeeking.bind(worldRenderer.media),
    setVideoVolume: worldRenderer.media.setVideoVolume.bind(worldRenderer.media),
    setVideoSpeed: worldRenderer.media.setVideoSpeed.bind(worldRenderer.media),

    addSectionAnimation (id: string, animation: typeof worldRenderer.sectionsOffsetsAnimations[string]) {
      worldRenderer.sectionsOffsetsAnimations[id] = animation
    },
    removeSectionAnimation (id: string) {
      delete worldRenderer.sectionsOffsetsAnimations[id]
    },

    shakeFromDamage: worldRenderer.cameraShake.shakeFromDamage.bind(worldRenderer.cameraShake),
    onPageInteraction: worldRenderer.media.onPageInteraction.bind(worldRenderer.media),
    downloadMesherLog: worldRenderer.downloadMesherLog.bind(worldRenderer),

    addWaypoint: worldRenderer.waypoints.addWaypoint.bind(worldRenderer.waypoints),
    removeWaypoint: worldRenderer.waypoints.removeWaypoint.bind(worldRenderer.waypoints),

    launchFirework: worldRenderer.fireworks.launchFirework.bind(worldRenderer.fireworks),

    // New method for updating skybox
    setSkyboxImage: worldRenderer.skyboxRenderer.setSkyboxImage.bind(worldRenderer.skyboxRenderer)
  }
}

export type ThreeJsBackendMethods = ReturnType<typeof getBackendMethods>

const createGraphicsBackend: GraphicsBackendLoader = (initOptions: GraphicsInitOptions) => {
  // Private state
  const documentRenderer = new DocumentRenderer(initOptions)
  globalThis.renderer = documentRenderer.renderer

  let panoramaRenderer: PanoramaRenderer | null = null
  let worldRenderer: WorldRendererThree | null = null

  const startPanorama = async () => {
    if (!documentRenderer) throw new Error('Document renderer not initialized')
    if (worldRenderer) return
    const qs = new URLSearchParams(location.search)
    if (qs.get('debugEntities')) {
      const fullResourceManager = initOptions.resourcesManager as ResourcesManager
      fullResourceManager.currentConfig = { version: qs.get('version') || supportedVersions.at(-1)!, noInventoryGui: true }
      await fullResourceManager.updateAssetsData({ })

      displayEntitiesDebugList(fullResourceManager.currentConfig.version)
      return
    }

    if (!panoramaRenderer) {
      panoramaRenderer = new PanoramaRenderer(documentRenderer, initOptions, !!process.env.SINGLE_FILE_BUILD_MODE)
      globalThis.panoramaRenderer = panoramaRenderer
      callModsMethod('panoramaCreated', panoramaRenderer)
      await panoramaRenderer.start()
      callModsMethod('panoramaReady', panoramaRenderer)
    }
  }

  const startWorld = async (displayOptions: DisplayWorldOptions) => {
    if (panoramaRenderer) {
      panoramaRenderer.dispose()
      panoramaRenderer = null
    }
    worldRenderer = new WorldRendererThree(documentRenderer.renderer, initOptions, displayOptions)
    void initVR(worldRenderer, documentRenderer)
    await worldRenderer.worldReadyPromise
    documentRenderer.render = (sizeChanged: boolean) => {
      worldRenderer?.render(sizeChanged)
    }
    documentRenderer.inWorldRenderingConfig = displayOptions.inWorldRenderingConfig
    window.world = worldRenderer
    callModsMethod('worldReady', worldRenderer)
  }

  const disconnect = () => {
    if (panoramaRenderer) {
      panoramaRenderer.dispose()
      panoramaRenderer = null
    }
    if (documentRenderer) {
      documentRenderer.dispose()
    }
    if (worldRenderer) {
      worldRenderer.destroy()
      worldRenderer = null
    }
  }

  // Public interface
  const backend: GraphicsBackend = {
    id: 'threejs',
    displayName: `three.js ${THREE.REVISION}`,
    startPanorama,
    startWorld,
    disconnect,
    setRendering (rendering) {
      documentRenderer.setPaused(!rendering)
      if (worldRenderer) worldRenderer.renderingActive = rendering
    },
    getDebugOverlay: () => ({
      get entitiesString () {
        return worldRenderer?.entities.getDebugString()
      },
    }),
    updateCamera (pos: Vec3 | null, yaw: number, pitch: number) {
      worldRenderer?.setFirstPersonCamera(pos, yaw, pitch)
    },
    get soundSystem () {
      return worldRenderer?.soundSystem
    },
    get backendMethods () {
      if (!worldRenderer) return undefined
      return getBackendMethods(worldRenderer)
    }
  }

  globalThis.threeJsBackend = backend
  globalThis.resourcesManager = initOptions.resourcesManager
  callModsMethod('default', backend)

  return backend
}

const callModsMethod = (method: string, ...args: any[]) => {
  for (const mod of Object.values((window.loadedMods ?? {}) as Record<string, any>)) {
    try {
      mod.threeJsBackendModule?.[method]?.(...args)
    } catch (err) {
      const errorMessage = `[mod three.js] Error calling ${method} on ${mod.name}: ${err}`
      showNotification(errorMessage, 'error')
      throw new Error(errorMessage)
    }
  }
}

createGraphicsBackend.id = 'threejs'
export default createGraphicsBackend
