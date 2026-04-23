import * as THREE from 'three'
import { sendVideoPlay, sendVideoStop } from '../../../src/customChannels'
import { WorldRendererThree } from './worldrendererThree'
import { ThreeJsSound } from './threeJsSound'

interface MediaProperties {
  position: { x: number, y: number, z: number }
  size: { width: number, height: number }
  src: string
  rotation?: 0 | 1 | 2 | 3 // 0-3 for 0°, 90°, 180°, 270°
  doubleSide?: boolean
  background?: number // Hexadecimal color (e.g., 0x000000 for black)
  opacity?: number // 0-1 value for transparency
  uvMapping?: { startU: number, endU: number, startV: number, endV: number }
  allowOrigins?: string[] | boolean
  loop?: boolean
  volume?: number
  autoPlay?: boolean

  allowLighting?: boolean
}

export class ThreeJsMedia {
  customMedia = new Map<string, {
    mesh: THREE.Object3D
    props: MediaProperties
    video: HTMLVideoElement | undefined
    texture: THREE.Texture
    updateUVMapping: (config: { startU: number, endU: number, startV: number, endV: number }) => void
    positionalAudio?: THREE.PositionalAudio
    hadAutoPlayError?: boolean
  }>()

  constructor (private readonly worldRenderer: WorldRendererThree) {
    this.worldRenderer.onWorldSwitched.push(() => {
      this.onWorldGone()
    })

    this.worldRenderer.onRender.push(() => {
      this.render()
    })
  }

  onWorldGone () {
    for (const [id, videoData] of this.customMedia.entries()) {
      this.destroyMedia(id)
    }
  }

  onWorldStop () {
    for (const [id, videoData] of this.customMedia.entries()) {
      this.setVideoPlaying(id, false)
    }
  }

  private createErrorTexture (width: number, height: number, background = 0x00_00_00, error = 'Failed to load'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    const MAX_DIMENSION = 100

    canvas.width = MAX_DIMENSION
    canvas.height = MAX_DIMENSION

    const ctx = canvas.getContext('2d')
    if (!ctx) return new THREE.CanvasTexture(canvas)

    // Clear with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Add background color
    ctx.fillStyle = `rgba(${background >> 16 & 255}, ${background >> 8 & 255}, ${background & 255}, 0.5)`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Add red text with size relative to canvas dimensions
    ctx.fillStyle = '#ff0000'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(error, canvas.width / 2, canvas.height / 2, canvas.width)

    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    return texture
  }

  private createBackgroundTexture (width: number, height: number, color = 0x00_00_00, opacity = 1): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1

    const ctx = canvas.getContext('2d')
    if (!ctx) return new THREE.CanvasTexture(canvas)

    // Convert hex color to rgba
    const r = (color >> 16) & 255
    const g = (color >> 8) & 255
    const b = color & 255

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`
    ctx.fillRect(0, 0, 1, 1)

    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    return texture
  }

  validateOrigin (src: string, allowOrigins: string[] | boolean) {
    if (allowOrigins === true) return true
    if (allowOrigins === false) return false
    const url = new URL(src)
    return allowOrigins.some(origin => url.origin.endsWith(origin))
  }

  onPageInteraction () {
    for (const [id, videoData] of this.customMedia.entries()) {
      if (videoData.hadAutoPlayError) {
        videoData.hadAutoPlayError = false
        void videoData.video?.play()
          .catch(err => {
            if (err.name === 'AbortError') return
            console.error('Failed to play video:', err)
            videoData.hadAutoPlayError = true
            return true
          })
          .then((fromCatch) => {
            if (fromCatch) return
            if (videoData.positionalAudio) {
              // workaround: audio has to be recreated
              this.addMedia(id, videoData.props)
            }
          })
      }
    }
  }

  addMedia (id: string, props: MediaProperties) {
    const originalProps = structuredClone(props)
    this.destroyMedia(id)

    const { scene } = this.worldRenderer

    const originSecurityError = props.allowOrigins !== undefined && !this.validateOrigin(props.src, props.allowOrigins)
    if (originSecurityError) {
      console.warn('Remote resource blocked due to security policy', props.src, 'allowed origins:', props.allowOrigins, 'you can control it with `remoteContentNotSameOrigin` option')
      props.src = ''
    }

    const isImage = props.src.endsWith('.png') || props.src.endsWith('.jpg') || props.src.endsWith('.jpeg')

    let video: HTMLVideoElement | undefined
    let positionalAudio: THREE.PositionalAudio | undefined
    if (!isImage) {
      video = document.createElement('video')
      video.src = props.src.endsWith('.gif') ? props.src.replace('.gif', '.mp4') : props.src
      video.loop = props.loop ?? true
      video.volume = props.volume ?? 1
      video.playsInline = true
      video.crossOrigin = 'anonymous'

      // Create positional audio
      const soundSystem = this.worldRenderer.soundSystem as ThreeJsSound
      soundSystem.initAudioListener()
      if (!soundSystem.audioListener) throw new Error('Audio listener not initialized')
      positionalAudio = new THREE.PositionalAudio(soundSystem.audioListener)
      positionalAudio.setRefDistance(6)
      positionalAudio.setVolume(props.volume ?? 1)
      scene.add(positionalAudio)
      positionalAudio.position.set(props.position.x, props.position.y, props.position.z)

      // Connect video to positional audio
      positionalAudio.setMediaElementSource(video)
      positionalAudio.connect()

      video.addEventListener('pause', () => {
        positionalAudio?.pause()
        sendVideoStop(id, 'paused', video!.currentTime)
      })
      video.addEventListener('play', () => {
        positionalAudio?.play()
        sendVideoPlay(id)
      })
      video.addEventListener('seeked', () => {
        if (positionalAudio && video) {
          positionalAudio.offset = video.currentTime
        }
      })
      video.addEventListener('stalled', () => {
        sendVideoStop(id, 'stalled', video!.currentTime)
      })
      video.addEventListener('waiting', () => {
        sendVideoStop(id, 'waiting', video!.currentTime)
      })
      video.addEventListener('error', ({ error }) => {
        sendVideoStop(id, `error: ${error}`, video!.currentTime)
      })
      video.addEventListener('ended', () => {
        sendVideoStop(id, 'ended', video!.currentTime)
      })
    }


    // Create background texture first
    const backgroundTexture = this.createBackgroundTexture(
      props.size.width,
      props.size.height,
      props.background,
      // props.opacity ?? 1
    )

    const handleError = (text?: string) => {
      const errorTexture = this.createErrorTexture(props.size.width, props.size.height, props.background, text)
      material.map = errorTexture
      material.needsUpdate = true
    }

    // Create a plane geometry with configurable UV mapping
    const geometry = new THREE.PlaneGeometry(1, 1)

    // Create material with initial properties using background texture
    const MaterialClass = props.allowLighting ? THREE.MeshLambertMaterial : THREE.MeshBasicMaterial
    const material = new MaterialClass({
      map: backgroundTexture,
      transparent: true,
      side: props.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: 0.1
    })

    const texture = video
      ? new THREE.VideoTexture(video)
      : new THREE.TextureLoader().load(props.src, () => {
        if (this.customMedia.get(id)?.texture === texture) {
          material.map = texture
          material.needsUpdate = true
        }
      }, undefined, () => handleError()) // todo cache
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    // texture.format = THREE.RGBAFormat
    // texture.colorSpace = THREE.SRGBColorSpace
    texture.generateMipmaps = false

    // Create inner mesh for offsets
    const mesh = new THREE.Mesh(geometry, material)

    const { mesh: panel } = this.positionMeshExact(mesh, THREE.MathUtils.degToRad((props.rotation ?? 0) * 90), props.position, props.size.width, props.size.height)

    scene.add(panel)

    if (video) {
      // Start playing the video
      video.play().catch(err => {
        if (err.name === 'AbortError') return
        console.error('Failed to play video:', err)
        videoData.hadAutoPlayError = true
        handleError(err.name === 'NotAllowedError' ? 'Waiting for user interaction' : 'Failed to auto play')
      })

      // Update texture in animation loop
      mesh.onBeforeRender = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA && (!video.paused || !videoData?.hadAutoPlayError)) {
          if (material.map !== texture) {
            material.map = texture
            material.needsUpdate = true
          }
          texture.needsUpdate = true

          // Sync audio position with video position
          if (positionalAudio) {
            positionalAudio.position.copy(panel.position)
            positionalAudio.rotation.copy(panel.rotation)
          }
        }
      }
    }

    // UV mapping configuration
    const updateUVMapping = (config: { startU: number, endU: number, startV: number, endV: number }) => {
      const uvs = geometry.attributes.uv.array as Float32Array
      uvs[0] = config.startU
      uvs[1] = config.startV
      uvs[2] = config.endU
      uvs[3] = config.startV
      uvs[4] = config.endU
      uvs[5] = config.endV
      uvs[6] = config.startU
      uvs[7] = config.endV
      geometry.attributes.uv.needsUpdate = true
    }

    // Apply initial UV mapping if provided
    if (props.uvMapping) {
      updateUVMapping(props.uvMapping)
    }

    const videoData = {
      mesh: panel,
      video,
      texture,
      updateUVMapping,
      positionalAudio,
      props: originalProps,
      hadAutoPlayError: false
    }
    // Store video data
    this.customMedia.set(id, videoData)

    return id
  }

  render () {
    for (const [id, videoData] of this.customMedia.entries()) {
      const chunkX = Math.floor(videoData.props.position.x / 16) * 16
      const chunkZ = Math.floor(videoData.props.position.z / 16) * 16
      const sectionY = Math.floor(videoData.props.position.y / 16) * 16

      const chunkKey = `${chunkX},${chunkZ}`
      const sectionKey = `${chunkX},${sectionY},${chunkZ}`
      videoData.mesh.visible = !!this.worldRenderer.sectionObjects[sectionKey] || !!this.worldRenderer.finishedChunks[chunkKey]
    }
  }

  setVideoPlaying (id: string, playing: boolean) {
    const videoData = this.customMedia.get(id)
    if (videoData?.video) {
      if (playing) {
        videoData.video.play().catch(console.error)
      } else {
        videoData.video.pause()
      }
    }
  }

  setVideoSeeking (id: string, seconds: number) {
    const videoData = this.customMedia.get(id)
    if (videoData?.video) {
      videoData.video.currentTime = seconds
    }
  }

  setVideoVolume (id: string, volume: number) {
    const videoData = this.customMedia.get(id)
    if (videoData?.video) {
      videoData.video.volume = volume
    }
  }

  setVideoSpeed (id: string, speed: number) {
    const videoData = this.customMedia.get(id)
    if (videoData?.video) {
      videoData.video.playbackRate = speed
    }
  }

  destroyMedia (id: string) {
    const { scene } = this.worldRenderer
    const mediaData = this.customMedia.get(id)
    if (mediaData) {
      if (mediaData.video) {
        mediaData.video.pause()
        mediaData.video.src = ''
        mediaData.video.remove()
      }
      if (mediaData.positionalAudio) {
        // mediaData.positionalAudio.stop()
        // mediaData.positionalAudio.disconnect()
        scene.remove(mediaData.positionalAudio)
      }
      scene.remove(mediaData.mesh)
      mediaData.texture.dispose()

      // Get the inner mesh from the group
      const mesh = mediaData.mesh.children[0] as THREE.Mesh
      if (mesh) {
        mesh.geometry.dispose()
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose()
        }
      }

      this.customMedia.delete(id)
    }
  }

  /**
   * Positions a mesh exactly at startPosition and extends it along the rotation direction
   * with the specified width and height
   *
   * @param mesh The mesh to position
   * @param rotation Rotation in radians (applied to Y axis)
   * @param startPosition The exact starting position (corner) of the mesh
   * @param width Width of the mesh
   * @param height Height of the mesh
   * @param depth Depth of the mesh (default: 1)
   * @returns The positioned mesh for chaining
   */
  positionMeshExact (
    mesh: THREE.Mesh,
    rotation: number,
    startPosition: { x: number, y: number, z: number },
    width: number,
    height: number,
    depth = 1
  ) {
    // avoid z-fighting with the ground plane
    if (rotation === 0) {
      startPosition.z += 0.001
    }
    if (rotation === Math.PI / 2) {
      startPosition.x -= 0.001
    }
    if (rotation === Math.PI) {
      startPosition.z -= 0.001
    }
    if (rotation === 3 * Math.PI / 2) {
      startPosition.x += 0.001
    }

    // rotation normalize coordinates
    if (rotation === 0) {
      startPosition.z += 1
    }
    if (rotation === Math.PI) {
      startPosition.x += 1
    }
    if (rotation === 3 * Math.PI / 2) {
      startPosition.z += 1
      startPosition.x += 1
    }


    // First, clean up any previous transformations
    mesh.matrix.identity()
    mesh.position.set(0, 0, 0)
    mesh.rotation.set(0, 0, 0)
    mesh.scale.set(1, 1, 1)

    // By default, PlaneGeometry creates a plane in the XY plane (facing +Z)
    // We need to set up the proper orientation for our use case
    // Rotate the plane to face the correct direction based on the rotation parameter
    mesh.rotateY(rotation)
    if (rotation === Math.PI / 2 || rotation === 3 * Math.PI / 2) {
      mesh.rotateZ(-Math.PI)
      mesh.rotateX(-Math.PI)
    }

    // Scale it to the desired size
    mesh.scale.set(width, height, depth)

    // For a PlaneGeometry, if we want the corner at the origin, we need to offset
    // by half the dimensions after scaling
    mesh.geometry.translate(0.5, 0.5, 0)
    mesh.geometry.attributes.position.needsUpdate = true

    // Now place the mesh at the start position
    mesh.position.set(startPosition.x, startPosition.y, startPosition.z)

    // Create a group to hold our mesh and markers
    const debugGroup = new THREE.Group()
    debugGroup.add(mesh)

    // Add a marker at the starting position (should be exactly at pos)
    const startMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff_00_00 })
    )
    startMarker.position.copy(new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z))
    debugGroup.add(startMarker)

    // Add a marker at the end position (width units away in the rotated direction)
    const endX = startPosition.x + Math.cos(rotation) * width
    const endZ = startPosition.z + Math.sin(rotation) * width
    const endYMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x00_00_ff })
    )
    endYMarker.position.set(startPosition.x, startPosition.y + height, startPosition.z)
    debugGroup.add(endYMarker)

    // Add a marker at the width endpoint
    const endWidthMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff_ff_00 })
    )
    endWidthMarker.position.set(endX, startPosition.y, endZ)
    debugGroup.add(endWidthMarker)

    // Add a marker at the corner diagonal endpoint (both width and height)
    const endCornerMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff_00_ff })
    )
    endCornerMarker.position.set(endX, startPosition.y + height, endZ)
    debugGroup.add(endCornerMarker)

    // Also add a visual helper to show the rotation direction
    const directionHelper = new THREE.ArrowHelper(
      new THREE.Vector3(Math.cos(rotation), 0, Math.sin(rotation)),
      new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z),
      1,
      0xff_00_00
    )
    debugGroup.add(directionHelper)

    return {
      mesh,
      debugGroup
    }
  }

  createTestCanvasTexture () {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.font = '10px Arial'
    ctx.fillStyle = 'red'
    ctx.fillText('Hello World', 0, 10) // at
    return new THREE.CanvasTexture(canvas)
  }

  /**
   * Creates a test mesh that demonstrates the exact positioning
   */
  addTestMeshExact (rotationNum: number) {
    const pos = window.cursorBlockRel().position
    console.log('Creating exact positioned test mesh at:', pos)

    // Create a plane mesh with a wireframe to visualize boundaries
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        // side: THREE.DoubleSide,
        map: this.createTestCanvasTexture()
      })
    )

    const width = 2
    const height = 1
    const rotation = THREE.MathUtils.degToRad(rotationNum * 90) // 90 degrees in radians

    // Position the mesh exactly where we want it
    const { debugGroup } = this.positionMeshExact(plane, rotation, pos, width, height)

    this.worldRenderer.scene.add(debugGroup)
    console.log('Exact test mesh added with dimensions:', width, height, 'and rotation:', rotation)
  }

  lastCheck = 0
  THROTTLE_TIME = 100
  tryIntersectMedia () {
    // hack: need to optimize this by pulling only in distance of interaction instead and throttle
    if (this.customMedia.size === 0) return
    if (Date.now() - this.lastCheck < this.THROTTLE_TIME) return
    this.lastCheck = Date.now()

    const { camera, scene } = this.worldRenderer
    const raycaster = new THREE.Raycaster()

    // Get mouse position at center of screen
    const mouse = new THREE.Vector2(0, 0)

    // Update the raycaster
    raycaster.setFromCamera(mouse, camera)

    // Check intersection with all objects in scene
    const intersects = raycaster.intersectObjects(scene.children, true)
    if (intersects.length > 0) {
      const intersection = intersects[0]
      const intersectedObject = intersection.object

      // Find if this object belongs to any media
      for (const [id, videoData] of this.customMedia.entries()) {
        // Check if the intersected object is part of our media mesh
        if (intersectedObject === videoData.mesh ||
          videoData.mesh.children.includes(intersectedObject)) {
          const { uv } = intersection
          if (uv) {
            const result = {
              id,
              x: uv.x,
              y: uv.y
            }
            this.worldRenderer.reactiveState.world.intersectMedia = result
            this.worldRenderer['debugVideo'] = videoData
            this.worldRenderer.cursorBlock.cursorLinesHidden = true
            return
          }
        }
      }
    }

    // No media intersection found
    this.worldRenderer.reactiveState.world.intersectMedia = null
    this.worldRenderer['debugVideo'] = null
    this.worldRenderer.cursorBlock.cursorLinesHidden = false
  }
}
