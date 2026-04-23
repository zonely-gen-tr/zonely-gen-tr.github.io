import { appQueryParams } from './appParams'

if (appQueryParams.testCrashApp === '1') {
  throw new Error('test error')
}
