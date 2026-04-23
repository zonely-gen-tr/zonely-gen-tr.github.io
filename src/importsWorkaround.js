// workaround for mineflayer
globalThis.window ??= globalThis
globalThis.localStorage ??= {}
process.versions.node = '18.0.0'

if (!navigator.getGamepads) {
  console.warn('navigator.getGamepads is not available, adding a workaround')
  navigator.getGamepads ??= () => []
}
