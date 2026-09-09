import {
  defaultSpamKeywords,
  KeySpamKeywordList,
} from '../storage-keys'

function ensureDefaultKeywords() {
  const KEY = KeySpamKeywordList
  const VERSION_KEY = 'spamKeywordsVersion'
  const CURRENT_VERSION = 2

  void browser.storage.local.get([KEY, VERSION_KEY]).then((result) => {
    const version = (result[VERSION_KEY] as number | undefined) ?? 0
    if (version >= CURRENT_VERSION) return

    const storedWords = ((result[KEY] as string | undefined) || '')
      .split(/\n/)
      .map((w: string) => w.trim().toLowerCase())
      .filter(Boolean)
    const storedSet = new Set(storedWords)

    // 合并默认词中缺失的新词
    const merged = [...storedWords]
    for (const kw of defaultSpamKeywords) {
      if (!storedSet.has(kw.toLowerCase())) {
        merged.push(kw.toLowerCase())
      }
    }

    void browser.storage.local.set({ [KEY]: merged.join('\n'), [VERSION_KEY]: CURRENT_VERSION })
  })
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    ensureDefaultKeywords()
  })

  ensureDefaultKeywords()
})
