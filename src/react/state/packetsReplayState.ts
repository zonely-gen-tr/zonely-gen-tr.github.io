import { proxy } from 'valtio'
import type { PacketData } from '../ReplayPanel'
import { appQueryParams, updateQsParam } from '../../appParams'

export const packetsReplayState = proxy({
  packetsPlayback: [] as PacketData[],
  isOpen: false,
  isMinimized: false,
  isRecording: false,
  replayName: '',
  isPlaying: false,
  progress: {
    current: 0,
    total: 0
  },
  speed: appQueryParams.replaySpeed ? parseFloat(appQueryParams.replaySpeed) : 1,
  customButtons: {
    validateClientPackets: {
      state: appQueryParams.replayValidateClient === 'true',
      label: 'C',
      tooltip: 'Validate client packets'
    },
    stopOnError: {
      state: appQueryParams.replayStopOnError === 'true',
      label: 'E',
      tooltip: 'Stop the replay when an error occurs'
    },
    skipMissingOnTimeout: {
      state: appQueryParams.replaySkipMissingOnTimeout === 'true',
      label: 'T',
      tooltip: 'Skip missing packets on timeout'
    },
    packetsSenderDelay: {
      state: appQueryParams.replayPacketsSenderDelay === 'true',
      label: 'D',
      tooltip: 'Send packets with an additional delay'
    }
  }
})

export const onChangeButtonState = (button: keyof typeof packetsReplayState.customButtons, state: boolean) => {
  packetsReplayState.customButtons[button].state = state
  switch (button) {
    case 'validateClientPackets': {
      updateQsParam('replayValidateClient', String(state))
      break
    }
    case 'stopOnError': {
      updateQsParam('replayStopOnError', String(state))
      break
    }
    case 'skipMissingOnTimeout': {
      updateQsParam('replaySkipMissingOnTimeout', String(state))
      break
    }
    case 'packetsSenderDelay': {
      updateQsParam('replayPacketsSenderDelay', String(state))
      break
    }
  }
}
