export class CameraBobbing {
  private walkDistance = 0
  private prevWalkDistance = 0
  private bobAmount = 0
  private prevBobAmount = 0
  private readonly gameTimer = new GameTimer()

  // eslint-disable-next-line max-params
  constructor (
    private readonly BOB_FREQUENCY: number = Math.PI, // How fast the bob cycles
    private readonly BOB_BASE_AMPLITUDE: number = 0.5, // Base amplitude of the bob
    private readonly VERTICAL_MULTIPLIER: number = 1, // Vertical movement multiplier
    private readonly ROTATION_MULTIPLIER_Z: number = 3, // Roll rotation multiplier
    private readonly ROTATION_MULTIPLIER_X: number = 5 // Pitch rotation multiplier
  ) {}

  // Call this when player is moving
  public updateWalkDistance (distance: number): void {
    this.prevWalkDistance = this.walkDistance
    this.walkDistance = distance
  }

  // Call this when player is moving to update bob amount
  public updateBobAmount (isMoving: boolean): void {
    const targetBob = isMoving ? 1 : 0
    this.prevBobAmount = this.bobAmount

    // Update timing
    const ticks = this.gameTimer.update()
    const deltaTime = ticks / 20 // Convert ticks to seconds assuming 20 TPS

    // Smooth transition for bob amount
    const bobDelta = (targetBob - this.bobAmount) * Math.min(1, deltaTime * 10)
    this.bobAmount += bobDelta
  }

  // Call this in your render/animation loop
  public getBobbing (): { position: { x: number, y: number }, rotation: { x: number, z: number } } {
    // Interpolate walk distance
    const walkDist = this.prevWalkDistance +
      (this.walkDistance - this.prevWalkDistance) * this.gameTimer.partialTick

    // Interpolate bob amount
    const bob = this.prevBobAmount +
      (this.bobAmount - this.prevBobAmount) * this.gameTimer.partialTick

    // Calculate total distance for bob cycle
    const totalDist = -(walkDist * this.BOB_FREQUENCY)

    // Calculate offsets
    const xOffset = Math.sin(totalDist) * bob * this.BOB_BASE_AMPLITUDE
    const yOffset = -Math.abs(Math.cos(totalDist) * bob) * this.VERTICAL_MULTIPLIER

    // Calculate rotations (in radians)
    const zRot = (Math.sin(totalDist) * bob * this.ROTATION_MULTIPLIER_Z) * (Math.PI / 180)
    const xRot = (Math.abs(Math.cos(totalDist - 0.2) * bob) * this.ROTATION_MULTIPLIER_X) * (Math.PI / 180)

    return {
      position: { x: xOffset, y: yOffset },
      rotation: { x: xRot, z: zRot }
    }
  }
}

class GameTimer {
  private readonly msPerTick: number
  private lastMs: number
  public partialTick = 0

  constructor (tickRate = 20) {
    this.msPerTick = 1000 / tickRate
    this.lastMs = performance.now()
  }

  update (): number {
    const currentMs = performance.now()
    const deltaSinceLastTick = currentMs - this.lastMs

    // Calculate how much of a tick has passed
    const tickDelta = deltaSinceLastTick / this.msPerTick
    this.lastMs = currentMs

    // Add to accumulated partial ticks
    this.partialTick += tickDelta

    // Get whole number of ticks that should occur
    const wholeTicks = Math.floor(this.partialTick)

    // Keep the remainder as the new partial tick
    this.partialTick -= wholeTicks

    return wholeTicks
  }
}
