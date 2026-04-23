import { describe, expect, it } from 'vitest'
import { parseServerAddress as parseServerAddressOriginal } from './parseServerAddress'

const parseServerAddress = (address: string | undefined, removeHttp = true) => {
  const { serverIpFull, ...result } = parseServerAddressOriginal(address, removeHttp)
  return result
}

describe('parseServerAddress', () => {
  it('should handle undefined input', () => {
    expect(parseServerAddress(undefined)).toEqual({
      host: '',
      isWebSocket: false
    })
  })

  it('should handle empty string input', () => {
    expect(parseServerAddress('')).toEqual({
      host: '',
      isWebSocket: false
    })
  })

  it('should parse basic hostname', () => {
    expect(parseServerAddress('example.com')).toEqual({
      host: 'example.com',
      isWebSocket: false
    })
  })

  it('should parse hostname with port', () => {
    expect(parseServerAddress('example.com:25565')).toEqual({
      host: 'example.com',
      port: '25565',
      isWebSocket: false
    })
  })

  it('should parse hostname with version', () => {
    expect(parseServerAddress('example.com:1.20.4')).toEqual({
      host: 'example.com',
      version: '1.20.4',
      isWebSocket: false
    })
  })

  it('should parse hostname with port and version', () => {
    expect(parseServerAddress('example.com:25565:1.20.4')).toEqual({
      host: 'example.com',
      port: '25565',
      version: '1.20.4',
      isWebSocket: false
    })
    expect(parseServerAddress('example.com:1.20.4:25565')).toEqual({
      host: 'example.com',
      version: '1.20.4',
      port: '25565',
      isWebSocket: false
    })
  })

  it('should handle WebSocket URLs', () => {
    expect(parseServerAddress('ws://example.com')).toEqual({
      host: 'ws://example.com',
      isWebSocket: true
    })
    expect(parseServerAddress('wss://example.com')).toEqual({
      host: 'wss://example.com',
      isWebSocket: true
    })
  })

  it('should handle http/https URLs with removeHttp=true', () => {
    expect(parseServerAddress('http://example.com')).toEqual({
      host: 'example.com',
      isWebSocket: false
    })
    expect(parseServerAddress('https://example.com')).toEqual({
      host: 'example.com',
      isWebSocket: false
    })
  })

  it('should handle http/https URLs with removeHttp=false', () => {
    expect(parseServerAddress('http://example.com', false)).toEqual({
      host: 'http://example.com',
      isWebSocket: false
    })
    expect(parseServerAddress('https://example.com', false)).toEqual({
      host: 'https://example.com',
      isWebSocket: false
    })
  })

  it('should handle IP addresses', () => {
    expect(parseServerAddress('127.0.0.1')).toEqual({
      host: '127.0.0.1',
      isWebSocket: false
    })
    expect(parseServerAddress('127.0.0.1:25565')).toEqual({
      host: '127.0.0.1',
      port: '25565',
      isWebSocket: false
    })
  })
})
