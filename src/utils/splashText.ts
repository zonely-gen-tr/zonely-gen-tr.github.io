const MAX_WORDS = 5
const HTTPS_REGEX = /^https?:\/\//
const TIMEOUT_MS = 5000
const SPLASH_CACHE_KEY = 'minecraft_splash_text_cache'
const SPLASH_URL_KEY = 'minecraft_splash_url'

const limitWords = (text: string): string => {
  const words = text.split(/\s+/)
  if (words.length <= MAX_WORDS) {
    return text
  }
  return words.slice(0, MAX_WORDS).join(' ') + '...'
}

export const isRemoteSplashText = (text: string): boolean => {
  if (!text) return false
  return HTTPS_REGEX.test(text)
}

export const loadRemoteSplashText = async (url: string): Promise<string> => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) {
      throw new Error(`Failed to fetch splash text: ${response.statusText}`)
    }

    const clonedResponse = response.clone()
    try {
      const json = await response.json()

      if (typeof json === 'object' && json !== null) {
        if (json.title) return limitWords(json.title)
        if (json.text) return limitWords(json.text)
        if (json.message) return limitWords(json.message)

        return limitWords(JSON.stringify(json))
      }

      return limitWords(String(json))
    } catch (jsonError) {
      const text = await clonedResponse.text()
      return limitWords(text.trim())
    }
  } catch (error) {
    console.error('Error loading remote splash text:', error)
    return 'Failed to load splash text!'
  }
}

export const cacheSourceUrl = (url: string): void => {
  localStorage.setItem(SPLASH_URL_KEY, url)
}

export const clearSplashCache = (): void => {
  localStorage.removeItem(SPLASH_CACHE_KEY)
}

export const getCachedSplashText = (): string | null => {
  return localStorage.getItem(SPLASH_CACHE_KEY)
}

export const cacheSplashText = (text: string): void => {
  localStorage.setItem(SPLASH_CACHE_KEY, text)
}
