//@ts-check
import { PlayerAnimation } from 'skinview3d'

export class WalkingGeneralSwing extends PlayerAnimation {

  switchAnimationCallback

  isRunning = false
  isMoving = true
  isCrouched = false

  _startArmSwing

  swingArm() {
    this._startArmSwing = this.progress
  }

  animate(player) {
    // Multiply by animation's natural speed
    let t = 0
    const updateT = () => {
      if (!this.isMoving) {
        t = 0
        return
      }
      if (this.isRunning) {
        t = this.progress * 10 + Math.PI * 0.5
      } else {
        t = this.progress * 8
      }
    }
    updateT()
    let reset = false

    croughAnimation(player, this.isCrouched)

    if ((this.isRunning ? Math.cos(t) : Math.sin(t)) < 0.01) {
      if (this.switchAnimationCallback) {
        reset = true
        this.progress = 0
        updateT()
      }
    }

    if (this.isRunning) {
      // Leg swing with larger amplitude
      player.skin.leftLeg.rotation.x = Math.cos(t + Math.PI) * 1.3
      player.skin.rightLeg.rotation.x = Math.cos(t) * 1.3
    } else {
      // Leg swing
      player.skin.leftLeg.rotation.x = Math.sin(t) * 0.5
      player.skin.rightLeg.rotation.x = Math.sin(t + Math.PI) * 0.5
    }

    if (this._startArmSwing) {
      const tHand = (this.progress - this._startArmSwing) * 18 + Math.PI * 0.5
      // player.skin.rightArm.rotation.x = Math.cos(tHand) * 1.5
      // const basicArmRotationZ = Math.PI * 0.1
      // player.skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.3 - basicArmRotationZ
      HitAnimation.animate((this.progress - this._startArmSwing), player, this.isMoving)

      if (tHand > Math.PI + Math.PI) {
        this._startArmSwing = null
        player.skin.rightArm.rotation.z = 0
      }
    }

    if (this.isRunning) {
      player.skin.leftArm.rotation.x = Math.cos(t) * 1.5
      if (!this._startArmSwing) {
        player.skin.rightArm.rotation.x = Math.cos(t + Math.PI) * 1.5
      }
      const basicArmRotationZ = Math.PI * 0.1
      player.skin.leftArm.rotation.z = Math.cos(t) * 0.1 + basicArmRotationZ
      if (!this._startArmSwing) {
        player.skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.1 - basicArmRotationZ
      }
    } else {
      // Arm swing
      player.skin.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.5
      if (!this._startArmSwing) {
        player.skin.rightArm.rotation.x = Math.sin(t) * 0.5
      }
      const basicArmRotationZ = Math.PI * 0.02
      player.skin.leftArm.rotation.z = Math.cos(t) * 0.03 + basicArmRotationZ
      if (!this._startArmSwing) {
        player.skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ
      }
    }

    if (this.isRunning) {
      player.rotation.z = Math.cos(t + Math.PI) * 0.01
    }
    if (this.isRunning) {
      const basicCapeRotationX = Math.PI * 0.3
      player.cape.rotation.x = Math.sin(t * 2) * 0.1 + basicCapeRotationX
    } else {
      // Always add an angle for cape around the x axis
      const basicCapeRotationX = Math.PI * 0.06
      player.cape.rotation.x = Math.sin(t / 1.5) * 0.06 + basicCapeRotationX
    }

    if (reset) {
      this.switchAnimationCallback()
      this.switchAnimationCallback = null
    }
  }
}

const HitAnimation = {
  animate(progress, player, isMovingOrRunning) {
    const t = progress * 18
    player.skin.rightArm.rotation.x = -0.453_786_055_2 * 2 + 2 * Math.sin(t + Math.PI) * 0.3

    if (!isMovingOrRunning) {
      const basicArmRotationZ = 0.01 * Math.PI + 0.06
      player.skin.rightArm.rotation.z = -Math.cos(t) * 0.403 + basicArmRotationZ
      player.skin.body.rotation.y = -Math.cos(t) * 0.06
      player.skin.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.077
      player.skin.leftArm.rotation.z = -Math.cos(t) * 0.015 + 0.13 - 0.05
      player.skin.leftArm.position.z = Math.cos(t) * 0.3
      player.skin.leftArm.position.x = 5 - Math.cos(t) * 0.05
    }
  },
}

const croughAnimation = (player, isCrouched) => {
  const erp = 0

  // let pr = this.progress * 8;
  let pr = isCrouched ? 1 : 0
  const showProgress = false
  if (showProgress) {
    pr = Math.floor(pr)
  }
  player.skin.body.rotation.x = 0.453_786_055_2 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.skin.body.position.z =
			1.325_618_1 * Math.abs(Math.sin((pr * Math.PI) / 2)) - 3.450_031_037_7 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.skin.body.position.y = -6 - 2.103_677_462 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.cape.position.y = 8 - 1.851_236_166_577_372 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.cape.rotation.x = (10.8 * Math.PI) / 180 + 0.294_220_265_771 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.cape.position.z =
			-2 + 3.786_619_432 * Math.abs(Math.sin((pr * Math.PI) / 2)) - 3.450_031_037_7 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.elytra.position.x = player.cape.position.x
  player.elytra.position.y = player.cape.position.y
  player.elytra.position.z = player.cape.position.z
  player.elytra.rotation.x = player.cape.rotation.x - (10.8 * Math.PI) / 180
  // const pr1 = this.progress / this.speed;
  const pr1 = 1
  if (Math.abs(Math.sin((pr * Math.PI) / 2)) === 1) {
    player.elytra.leftWing.rotation.z =
				0.261_799_44 + 0.458_200_6 * Math.abs(Math.sin((Math.min(pr1 - erp, 1) * Math.PI) / 2))
    player.elytra.updateRightWing()
  } else if (isCrouched !== undefined) {
    player.elytra.leftWing.rotation.z =
				0.72 - 0.458_200_6 * Math.abs(Math.sin((Math.min(pr1 - erp, 1) * Math.PI) / 2))
    player.elytra.updateRightWing()
  }
  player.skin.head.position.y = -3.618_325_234_674 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.skin.leftArm.position.z =
			3.618_325_234_674 * Math.abs(Math.sin((pr * Math.PI) / 2)) - 3.450_031_037_7 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.skin.rightArm.position.z = player.skin.leftArm.position.z
  player.skin.leftArm.rotation.x = 0.410_367_746_202 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.skin.rightArm.rotation.x = player.skin.leftArm.rotation.x
  player.skin.leftArm.rotation.z = 0.1
  player.skin.rightArm.rotation.z = -player.skin.leftArm.rotation.z
  player.skin.leftArm.position.y = -2 - 2.539_433_18 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.skin.rightArm.position.y = player.skin.leftArm.position.y
  player.skin.rightLeg.position.z = -3.450_031_037_7 * Math.abs(Math.sin((pr * Math.PI) / 2))
  player.skin.leftLeg.position.z = player.skin.rightLeg.position.z
}
