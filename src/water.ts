import { ref } from 'valtio'
import { watchUnloadForCleanup } from './gameUnload'

let inWater = false

customEvents.on('gameLoaded', () => {
  const cleanup = () => {
    appViewer.playerState.reactive.inWater = false
  }
  watchUnloadForCleanup(cleanup)

  const updateInWater = () => {
    const waterBr = Object.keys(bot.entity.effects).find((effect: any) => loadedData.effects[effect.id]?.name === 'water_breathing')
    if (inWater) {
      appViewer.playerState.reactive.inWater = true
      appViewer.playerState.reactive.waterBreathing = waterBr !== undefined
    } else {
      cleanup()
    }
    updateBackground()
  }
  bot.on('physicsTick', () => {
    // todo
    const _inWater = bot.world.getBlock(bot.entity.position.offset(0, 1, 0))?.name === 'water'
    if (_inWater !== inWater) {
      inWater = _inWater
      updateInWater()
    }
  })
})

let sceneBg = { r: 0, g: 0, b: 0 }
export const updateBackground = (newSceneBg = sceneBg) => {
  sceneBg = newSceneBg
  const color: [number, number, number] = inWater ? [0, 0, 1] : [sceneBg.r, sceneBg.g, sceneBg.b]
  appViewer.playerState.reactive.backgroundColor = ref(color)
}
