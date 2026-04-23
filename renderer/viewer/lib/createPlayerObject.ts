import { PlayerObject, PlayerAnimation } from 'skinview3d'
import * as THREE from 'three'
import { WalkingGeneralSwing } from '../three/entity/animations'
import { loadSkinImage, stevePngUrl } from './utils/skins'

export type PlayerObjectType = PlayerObject & {
  animation?: PlayerAnimation
  realPlayerUuid: string
  realUsername: string
}

export function createPlayerObject (options: {
  username?: string
  uuid?: string
  scale?: number
}): {
    playerObject: PlayerObjectType
    wrapper: THREE.Group
  } {
  const wrapper = new THREE.Group()
  const playerObject = new PlayerObject() as PlayerObjectType

  playerObject.realPlayerUuid = options.uuid ?? ''
  playerObject.realUsername = options.username ?? ''
  playerObject.position.set(0, 16, 0)

  // fix issues with starfield
  playerObject.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
      obj.material.transparent = true
    }
  })

  wrapper.add(playerObject as any)
  const scale = options.scale ?? (1 / 16)
  wrapper.scale.set(scale, scale, scale)
  wrapper.rotation.set(0, Math.PI, 0)

  // Set up animation
  playerObject.animation = new WalkingGeneralSwing()
  ;(playerObject.animation as WalkingGeneralSwing).isMoving = false
  playerObject.animation.update(playerObject, 0)

  return { playerObject, wrapper }
}

export const applySkinToPlayerObject = async (playerObject: PlayerObjectType, skinUrl: string) => {
  return loadSkinImage(skinUrl || stevePngUrl).then(({ canvas }) => {
    const skinTexture = new THREE.CanvasTexture(canvas)
    skinTexture.magFilter = THREE.NearestFilter
    skinTexture.minFilter = THREE.NearestFilter
    skinTexture.needsUpdate = true
    playerObject.skin.map = skinTexture as any
  }).catch(console.error)
}
