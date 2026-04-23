import * as THREE from 'three'

interface ParticleMesh extends THREE.Mesh {
  velocity: THREE.Vector3;
}

interface ParticleConfig {
  fountainHeight: number;
  resetHeight: number;
  xVelocityRange: number;
  zVelocityRange: number;
  particleCount: number;
  particleRadiusRange: { min: number; max: number };
  yVelocityRange: { min: number; max: number };
}

export interface FountainOptions {
  position?: { x: number, y: number, z: number }
  particleConfig?: Partial<ParticleConfig>;
}

export class Fountain {
  private readonly particles: ParticleMesh[] = []
  private readonly config: { particleConfig: ParticleConfig }
  private readonly position: THREE.Vector3
  container: THREE.Object3D | undefined

  constructor (public sectionId: string, options: FountainOptions = {}) {
    this.position = options.position ? new THREE.Vector3(options.position.x, options.position.y, options.position.z) : new THREE.Vector3(0, 0, 0)
    this.config = this.createConfig(options.particleConfig)
  }

  private createConfig (
    particleConfigOverride?: Partial<ParticleConfig>
  ): { particleConfig: ParticleConfig } {
    const particleConfig: ParticleConfig = {
      fountainHeight: 10,
      resetHeight: 0,
      xVelocityRange: 0.4,
      zVelocityRange: 0.4,
      particleCount: 400,
      particleRadiusRange: { min: 0.1, max: 0.6 },
      yVelocityRange: { min: 0.1, max: 2 },
      ...particleConfigOverride
    }

    return { particleConfig }
  }


  createParticles (container: THREE.Object3D): void {
    this.container = container
    const colorStart = new THREE.Color(0xff_ff_00)
    const colorEnd = new THREE.Color(0xff_a5_00)

    for (let i = 0; i < this.config.particleConfig.particleCount; i++) {
      const radius = Math.random() *
        (this.config.particleConfig.particleRadiusRange.max - this.config.particleConfig.particleRadiusRange.min) +
        this.config.particleConfig.particleRadiusRange.min
      const geometry = new THREE.SphereGeometry(radius)
      const material = new THREE.MeshBasicMaterial({
        color: colorStart.clone().lerp(colorEnd, Math.random())
      })
      const mesh = new THREE.Mesh(geometry, material)
      const particle = mesh as unknown as ParticleMesh

      particle.position.set(
        this.position.x + (Math.random() - 0.5) * this.config.particleConfig.xVelocityRange * 2,
        this.position.y + this.config.particleConfig.fountainHeight,
        this.position.z + (Math.random() - 0.5) * this.config.particleConfig.zVelocityRange * 2
      )

      particle.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * this.config.particleConfig.xVelocityRange,
        -Math.random() * this.config.particleConfig.yVelocityRange.max,
        (Math.random() - 0.5) * this.config.particleConfig.zVelocityRange
      )

      this.particles.push(particle)
      this.container.add(particle)

      // this.container.onBeforeRender = () => {
      //   this.render()
      // }
    }
  }

  render (): void {
    for (const particle of this.particles) {
      particle.velocity.y -= 0.01 + Math.random() * 0.1
      particle.position.add(particle.velocity)

      if (particle.position.y < this.position.y + this.config.particleConfig.resetHeight) {
        particle.position.set(
          this.position.x + (Math.random() - 0.5) * this.config.particleConfig.xVelocityRange * 2,
          this.position.y + this.config.particleConfig.fountainHeight,
          this.position.z + (Math.random() - 0.5) * this.config.particleConfig.zVelocityRange * 2
        )
        particle.velocity.set(
          (Math.random() - 0.5) * this.config.particleConfig.xVelocityRange,
          -Math.random() * this.config.particleConfig.yVelocityRange.max,
          (Math.random() - 0.5) * this.config.particleConfig.zVelocityRange
        )
      }
    }
  }

  private updateParticleCount (newCount: number): void {
    if (newCount !== this.config.particleConfig.particleCount) {
      this.config.particleConfig.particleCount = newCount
      const currentCount = this.particles.length

      if (newCount > currentCount) {
        this.addParticles(newCount - currentCount)
      } else if (newCount < currentCount) {
        this.removeParticles(currentCount - newCount)
      }
    }
  }

  private addParticles (count: number): void {
    const geometry = new THREE.SphereGeometry(0.1)
    const material = new THREE.MeshBasicMaterial({ color: 0x00_ff_00 })

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, material)
      const particle = mesh as unknown as ParticleMesh
      particle.position.copy(this.position)
      particle.velocity = new THREE.Vector3(
        Math.random() * this.config.particleConfig.xVelocityRange -
        this.config.particleConfig.xVelocityRange / 2,
        Math.random() * 2,
        Math.random() * this.config.particleConfig.zVelocityRange -
        this.config.particleConfig.zVelocityRange / 2
      )
      this.particles.push(particle)
      this.container!.add(particle)
    }
  }

  private removeParticles (count: number): void {
    for (let i = 0; i < count; i++) {
      const particle = this.particles.pop()
      if (particle) {
        this.container!.remove(particle)
      }
    }
  }

  public dispose (): void {
    for (const particle of this.particles) {
      particle.geometry.dispose()
      if (Array.isArray(particle.material)) {
        for (const material of particle.material) material.dispose()
      } else {
        particle.material.dispose()
      }
    }
  }
}
