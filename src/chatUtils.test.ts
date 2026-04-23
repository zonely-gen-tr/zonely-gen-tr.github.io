import { test, expect } from 'vitest'
import mcData from 'minecraft-data'
import { formatMessage, isAllowedChatCharacter, isStringAllowed } from './chatUtils'

//@ts-expect-error
globalThis.loadedData ??= mcData('1.20.1')

const mapIncludeDefined = (props) => {
  return (x) => {
    return Object.fromEntries(Object.entries(x).filter(([k, v]) => v !== undefined && props.includes(k)))
  }
}

test('formatMessage', () => {
  const result = formatMessage({
    'json': {
      'translate': 'chat.type.announcement',
      'with': [
        {
          'text': 'Server'
        },
        {
          'text': '§cf'
        }
      ]
    },
    'translate': 'chat.type.announcement',
    'with': [
      {
        'json': {
          'text': 'Server'
        },
        'text': 'Server'
      },
      {
        'json': {
          'text': '§cf'
        },
        'text': '§cf'
      }
    ]
  }).map(mapIncludeDefined(['text', 'color']))
  expect(result).toMatchInlineSnapshot(`
    [
      {
        "text": "[",
      },
      {
        "text": "Server",
      },
      {
        "text": "] ",
      },
      {
        "text": "",
      },
      {
        "color": "red",
        "text": "f",
      },
      {
        "text": "",
      },
    ]
  `)
})

test('isAllowedChatCharacter', () => {
  expect(isAllowedChatCharacter('a')).toBe(true)
  expect(isAllowedChatCharacter('a')).toBe(true)
  expect(isAllowedChatCharacter('§')).toBe(false)
  expect(isAllowedChatCharacter(' ')).toBe(true)
  expect(isStringAllowed('a§b')).toMatchObject({
    valid: false,
    clean: 'ab',
    invalid: ['§']
  })
  expect(isStringAllowed('aツ')).toMatchObject({
    valid: true,
  })
  expect(isStringAllowed('a🟢')).toMatchObject({
    valid: true,
  })
})
