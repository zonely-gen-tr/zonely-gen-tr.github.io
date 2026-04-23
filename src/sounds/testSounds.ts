import { createSoundMap } from './soundsMap'

//@ts-expect-error
globalThis.window = {}
require('../../generated/sounds.js')

const soundMap = createSoundMap('1.20.1')
console.log(soundMap?.getSoundUrl('ambient.cave'))
