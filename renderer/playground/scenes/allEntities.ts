import { BasePlaygroundScene } from '../baseScene'
import { EntityDebugFlags, EntityMesh, rendererSpecialHandled } from '../../viewer/three/entity/EntityMesh'
import { displayEntitiesDebugList } from '../allEntitiesDebug'

export default class AllEntities extends BasePlaygroundScene {
  continuousRender = false
  enableCameraControls = false

  async initData () {
    await super.initData()
    displayEntitiesDebugList(this.version)
  }
}
