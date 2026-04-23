/* eslint-disable guard-for-in */

// todo refactor into its own commons module
import { EventEmitter } from 'events'
import { generateSpiralMatrix, ViewRect } from 'flying-squid/dist/utils'
import { Vec3 } from 'vec3'
import { BotEvents } from 'mineflayer'
import { proxy } from 'valtio'
import TypedEmitter from 'typed-emitter'
import { Biome } from 'minecraft-data'
import { delayedIterator } from '../../playground/shared'
import { chunkPos } from './simpleUtils'

export type ChunkPosKey = string // like '16,16'
type ChunkPos = { x: number, z: number } // like { x: 16, z: 16 }

export type WorldDataEmitterEvents = {
  chunkPosUpdate: (data: { pos: Vec3 }) => void
  blockUpdate: (data: { pos: Vec3, stateId: number }) => void
  entity: (data: any) => void
  entityMoved: (data: any) => void
  playerEntity: (data: any) => void
  time: (data: number) => void
  renderDistance: (viewDistance: number) => void
  blockEntities: (data: Record<string, any> | { blockEntities: Record<string, any> }) => void
  markAsLoaded: (data: { x: number, z: number }) => void
  unloadChunk: (data: { x: number, z: number }) => void
  loadChunk: (data: { x: number, z: number, chunk: string, blockEntities: any, worldConfig: any, isLightUpdate: boolean }) => void
  updateLight: (data: { pos: Vec3 }) => void
  onWorldSwitch: () => void
  end: () => void
  biomeUpdate: (data: { biome: Biome }) => void
  biomeReset: () => void
}

export class WorldDataEmitterWorker extends (EventEmitter as new () => TypedEmitter<WorldDataEmitterEvents>) {
  static readonly restorerName = 'WorldDataEmitterWorker'
}

export class WorldDataEmitter extends (EventEmitter as new () => TypedEmitter<WorldDataEmitterEvents>) {
  spiralNumber = 0
  gotPanicLastTime = false
  panicChunksReload = () => {}
  loadedChunks: Record<ChunkPosKey, boolean>
  private inLoading = false
  private chunkReceiveTimes: number[] = []
  private lastChunkReceiveTime = 0
  public lastChunkReceiveTimeAvg = 0
  private panicTimeout?: NodeJS.Timeout
  readonly lastPos: Vec3
  private eventListeners: Record<string, any> = {}
  private readonly emitter: WorldDataEmitter
  debugChunksInfo: Record<ChunkPosKey, {
    loads: Array<{
      dataLength: number
      reason: string
      time: number
    }>
    // blockUpdates: number
  }> = {}

  waitingSpiralChunksLoad = {} as Record<ChunkPosKey, (value: boolean) => void>

  addWaitTime = 1
  /* config */ keepChunksDistance = 0
  /* config */ isPlayground = false
  /* config */ allowPositionUpdate = true

  constructor (public world: typeof __type_bot['world'], public viewDistance: number, position: Vec3 = new Vec3(0, 0, 0)) {
    // eslint-disable-next-line constructor-super
    super()
    this.loadedChunks = {}
    this.lastPos = new Vec3(0, 0, 0).update(position)
    // todo
    this.emitter = this
  }

  setBlockStateId (position: Vec3, stateId: number) {
    const val = this.world.setBlockStateId(position, stateId) as Promise<void> | void
    if (val) throw new Error('setBlockStateId returned promise (not supported)')
    // const chunkX = Math.floor(position.x / 16)
    // const chunkZ = Math.floor(position.z / 16)
    // if (!this.loadedChunks[`${chunkX},${chunkZ}`] && !this.waitingSpiralChunksLoad[`${chunkX},${chunkZ}`]) {
    //   void this.loadChunk({ x: chunkX, z: chunkZ })
    //   return
    // }

    this.emit('blockUpdate', { pos: position, stateId })
  }

  updateViewDistance (viewDistance: number) {
    this.viewDistance = viewDistance
    this.emitter.emit('renderDistance', viewDistance)
  }

  listenToBot (bot: typeof __type_bot) {
    const entitiesObjectData = new Map<string, number>()
    bot._client.prependListener('spawn_entity', (data) => {
      if (data.objectData && data.entityId !== undefined) {
        entitiesObjectData.set(data.entityId, data.objectData)
      }
    })

    const emitEntity = (e, name = 'entity') => {
      if (!e) return
      if (e === bot.entity) {
        if (name === 'entity') {
          this.emitter.emit('playerEntity', e)
        }
        return
      }
      if (!e.name) return // mineflayer received update for not spawned entity
      e.objectData = entitiesObjectData.get(e.id)
      this.emitter.emit(name as any, {
        ...e,
        position: e.position,
        pos: e.position,
        username: e.username,
        team: bot.teamMap[e.username] || bot.teamMap[e.uuid],
        // set debugTree (obj) {
        //   e.debugTree = obj
        // }
      })
    }

    this.eventListeners = {
      // 'move': botPosition,
      entitySpawn (e: any) {
        if (e.name === 'item_frame' || e.name === 'glow_item_frame') {
          // Item frames use block positions in the protocol, not their center. Fix that.
          e.position.translate(0.5, 0.5, 0.5)
        }
        emitEntity(e)
      },
      entityUpdate (e: any) {
        emitEntity(e)
      },
      entityEquip (e: any) {
        emitEntity(e)
      },
      entityMoved (e: any) {
        emitEntity(e, 'entityMoved')
      },
      entityGone: (e: any) => {
        this.emitter.emit('entity', { id: e.id, delete: true })
      },
      chunkColumnLoad: (pos: Vec3) => {
        const now = performance.now()
        if (this.lastChunkReceiveTime) {
          this.chunkReceiveTimes.push(now - this.lastChunkReceiveTime)
        }
        this.lastChunkReceiveTime = now

        if (this.waitingSpiralChunksLoad[`${pos.x},${pos.z}`]) {
          this.waitingSpiralChunksLoad[`${pos.x},${pos.z}`](true)
          delete this.waitingSpiralChunksLoad[`${pos.x},${pos.z}`]
        } else if (this.loadedChunks[`${pos.x},${pos.z}`]) {
          void this.loadChunk(pos, false, 'Received another chunkColumnLoad event while already loaded')
        }
        this.chunkProgress()
      },
      chunkColumnUnload: (pos: Vec3) => {
        this.unloadChunk(pos)
      },
      blockUpdate: (oldBlock: any, newBlock: any) => {
        const stateId = newBlock.stateId ?? ((newBlock.type << 4) | newBlock.metadata)
        this.emitter.emit('blockUpdate', { pos: oldBlock.position, stateId })
      },
      time: () => {
        this.emitter.emit('time', bot.time.timeOfDay)
      },
      end: () => {
        this.emitter.emit('end')
      },
      // when dimension might change
      login: () => {
        void this.updatePosition(bot.entity.position, true)
        this.emitter.emit('playerEntity', bot.entity)
      },
      respawn: () => {
        void this.updatePosition(bot.entity.position, true)
        this.emitter.emit('playerEntity', bot.entity)
        this.emitter.emit('onWorldSwitch')
      },
    } satisfies Partial<BotEvents>


    bot._client.on('update_light', ({ chunkX, chunkZ }) => {
      const chunkPos = new Vec3(chunkX * 16, 0, chunkZ * 16)
      if (!this.waitingSpiralChunksLoad[`${chunkX},${chunkZ}`] && this.loadedChunks[`${chunkX},${chunkZ}`]) {
        void this.loadChunk(chunkPos, true, 'update_light')
      }
    })

    for (const [evt, listener] of Object.entries(this.eventListeners)) {
      bot.on(evt as any, listener)
    }

    for (const id in bot.entities) {
      const e = bot.entities[id]
      try {
        emitEntity(e)
      } catch (err) {
        // reportError?.(err)
        console.error('error processing entity', err)
      }
    }
  }

  emitterGotConnected () {
    this.emitter.emit('blockEntities', new Proxy({}, {
      get (_target, posKey, receiver) {
        if (typeof posKey !== 'string') return
        const [x, y, z] = posKey.split(',').map(Number)
        return bot.world.getBlock(new Vec3(x, y, z))?.entity
      },
    }))
  }

  removeListenersFromBot (bot: import('mineflayer').Bot) {
    for (const [evt, listener] of Object.entries(this.eventListeners)) {
      bot.removeListener(evt as any, listener)
    }
  }

  async init (pos: Vec3) {
    this.updateViewDistance(this.viewDistance)
    this.emitter.emit('chunkPosUpdate', { pos })
    if (bot?.time?.timeOfDay) {
      this.emitter.emit('time', bot.time.timeOfDay)
    }
    if (bot?.entity) {
      this.emitter.emit('playerEntity', bot.entity)
    }
    this.emitterGotConnected()
    const [botX, botZ] = chunkPos(pos)

    const positions = generateSpiralMatrix(this.viewDistance).map(([x, z]) => new Vec3((botX + x) * 16, 0, (botZ + z) * 16))

    this.lastPos.update(pos)
    await this._loadChunks(positions, pos)
  }

  chunkProgress () {
    if (this.panicTimeout) clearTimeout(this.panicTimeout)
    if (this.chunkReceiveTimes.length >= 5) {
      const avgReceiveTime = this.chunkReceiveTimes.reduce((a, b) => a + b, 0) / this.chunkReceiveTimes.length
      this.lastChunkReceiveTimeAvg = avgReceiveTime
      const timeoutDelay = avgReceiveTime * 2 + 1000 // 2x average + 1 second

      // Clear any existing timeout
      if (this.panicTimeout) clearTimeout(this.panicTimeout)

      // Set new timeout for panic reload
      this.panicTimeout = setTimeout(() => {
        if (!this.gotPanicLastTime && this.inLoading) {
          console.warn('Chunk loading seems stuck, triggering panic reload')
          this.gotPanicLastTime = true
          this.panicChunksReload()
        }
      }, timeoutDelay)
    }
  }

  async _loadChunks (positions: Vec3[], centerPos: Vec3) {
    this.spiralNumber++
    const { spiralNumber } = this
    // stop loading previous chunks
    for (const pos of Object.keys(this.waitingSpiralChunksLoad)) {
      this.waitingSpiralChunksLoad[pos](false)
      delete this.waitingSpiralChunksLoad[pos]
    }

    let continueLoading = true
    this.inLoading = true
    await delayedIterator(positions, this.addWaitTime, async (pos) => {
      if (!continueLoading || this.loadedChunks[`${pos.x},${pos.z}`]) return

      // Wait for chunk to be available from server
      if (!this.world.getColumnAt(pos)) {
        continueLoading = await new Promise<boolean>(resolve => {
          this.waitingSpiralChunksLoad[`${pos.x},${pos.z}`] = resolve
        })
      }
      if (!continueLoading) return
      await this.loadChunk(pos, undefined, `spiral ${spiralNumber} from ${centerPos.x},${centerPos.z}`)
      this.chunkProgress()
    })
    if (this.panicTimeout) clearTimeout(this.panicTimeout)
    this.inLoading = false
    this.gotPanicLastTime = false
    this.chunkReceiveTimes = []
    this.lastChunkReceiveTime = 0
  }

  readdDebug () {
    const clonedLoadedChunks = { ...this.loadedChunks }
    this.unloadAllChunks()
    console.time('readdDebug')
    for (const loadedChunk in clonedLoadedChunks) {
      const [x, z] = loadedChunk.split(',').map(Number)
      void this.loadChunk(new Vec3(x, 0, z))
    }
    const interval = setInterval(() => {
      if (appViewer.rendererState.world.allChunksLoaded) {
        clearInterval(interval)
        console.timeEnd('readdDebug')
      }
    }, 100)
  }

  // debugGotChunkLatency = [] as number[]
  // lastTime = 0

  async loadChunk (pos: ChunkPos, isLightUpdate = false, reason = 'spiral') {
    const [botX, botZ] = chunkPos(this.lastPos)

    const dx = Math.abs(botX - Math.floor(pos.x / 16))
    const dz = Math.abs(botZ - Math.floor(pos.z / 16))
    if (dx <= this.viewDistance && dz <= this.viewDistance) {
      // eslint-disable-next-line @typescript-eslint/await-thenable -- todo allow to use async world provider but not sure if needed
      const column = await this.world.getColumnAt(pos['y'] ? pos as Vec3 : new Vec3(pos.x, 0, pos.z))
      if (column) {
        // const latency = Math.floor(performance.now() - this.lastTime)
        // this.debugGotChunkLatency.push(latency)
        // this.lastTime = performance.now()
        // todo optimize toJson data, make it clear why it is used
        const chunk = column.toJson()
        // TODO: blockEntities
        const worldConfig = {
          minY: column['minY'] ?? 0,
          worldHeight: column['worldHeight'] ?? 256,
        }
        //@ts-expect-error
        this.emitter.emit('loadChunk', { x: pos.x, z: pos.z, chunk, blockEntities: column.blockEntities, worldConfig, isLightUpdate })
        this.loadedChunks[`${pos.x},${pos.z}`] = true

        this.debugChunksInfo[`${pos.x},${pos.z}`] ??= {
          loads: []
        }
        this.debugChunksInfo[`${pos.x},${pos.z}`].loads.push({
          dataLength: chunk.length,
          reason,
          time: Date.now(),
        })
      } else if (this.isPlayground) { // don't allow in real worlds pre-flag chunks as loaded to avoid race condition when the chunk might still be loading. In playground it's assumed we always pre-load all chunks first
        this.emitter.emit('markAsLoaded', { x: pos.x, z: pos.z })
      }
    } else {
      // console.debug('skipped loading chunk', dx, dz, '>', this.viewDistance)
    }
  }

  unloadAllChunks () {
    for (const coords of Object.keys(this.loadedChunks)) {
      const [x, z] = coords.split(',').map(Number)
      this.unloadChunk({ x, z })
    }
  }

  unloadChunk (pos: ChunkPos) {
    this.emitter.emit('unloadChunk', { x: pos.x, z: pos.z })
    delete this.loadedChunks[`${pos.x},${pos.z}`]
    delete this.debugChunksInfo[`${pos.x},${pos.z}`]
  }

  lastBiomeId: number | null = null

  udpateBiome (pos: Vec3) {
    try {
      const biomeId = this.world.getBiome(pos)
      if (biomeId !== this.lastBiomeId) {
        this.lastBiomeId = biomeId
        const biomeData = loadedData.biomes[biomeId]
        if (biomeData) {
          this.emitter.emit('biomeUpdate', {
            biome: biomeData
          })
        } else {
          // unknown biome
          this.emitter.emit('biomeReset')
        }
      }
    } catch (e) {
      console.error('error updating biome', e)
    }
  }

  lastPosCheck: Vec3 | null = null
  async updatePosition (pos: Vec3, force = false) {
    if (!this.allowPositionUpdate) return
    const posFloored = pos.floored()
    if (!force && this.lastPosCheck && this.lastPosCheck.equals(posFloored)) return
    this.lastPosCheck = posFloored

    this.udpateBiome(pos)

    const [lastX, lastZ] = chunkPos(this.lastPos)
    const [botX, botZ] = chunkPos(pos)
    if (lastX !== botX || lastZ !== botZ || force) {
      this.emitter.emit('chunkPosUpdate', { pos })

      // unload chunks that are no longer in view
      const newViewToUnload = new ViewRect(botX, botZ, this.viewDistance + this.keepChunksDistance)
      const chunksToUnload: Vec3[] = []
      for (const coords of Object.keys(this.loadedChunks)) {
        const x = parseInt(coords.split(',')[0], 10)
        const z = parseInt(coords.split(',')[1], 10)
        const p = new Vec3(x, 0, z)
        const [chunkX, chunkZ] = chunkPos(p)
        if (!newViewToUnload.contains(chunkX, chunkZ)) {
          chunksToUnload.push(p)
        }
      }
      for (const p of chunksToUnload) {
        this.unloadChunk(p)
      }

      // load new chunks
      const positions = generateSpiralMatrix(this.viewDistance).map(([x, z]) => {
        const pos = new Vec3((botX + x) * 16, 0, (botZ + z) * 16)
        if (!this.loadedChunks[`${pos.x},${pos.z}`]) return pos
        return undefined!
      }).filter(a => !!a)
      this.lastPos.update(pos)
      void this._loadChunks(positions, pos)
    } else {
      this.emitter.emit('chunkPosUpdate', { pos }) // todo-low
      this.lastPos.update(pos)
    }
  }
}
