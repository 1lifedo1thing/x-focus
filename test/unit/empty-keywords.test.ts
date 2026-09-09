import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { invalidateSpamConfig, runScan } from '../../content-scripts/spam/scanner'
import {
  KeySpamBlacklist,
  KeySpamDebugMode,
  KeySpamFilterEnabled,
  KeySpamKeywordList,
  KeySpamRulesEnabled,
  KeySpamThreshold,
  KeySpamWhitelist,
} from '../../storage-keys'

describe('empty spam keyword list', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/alice/status/123456')
    document.body.innerHTML = `
      <article data-testid="tweet">
        <a href="/alice/status/123456">Main</a>
      </article>
      <article data-testid="tweet" id="comment">
        <a href="/bob" role="link">@bob</a>
        <div data-testid="User-Name">Bob</div>
        <div data-testid="tweetText">点击主页查看更多</div>
        <button data-testid="caret" aria-label="更多"></button>
      </article>
    `
    ;(globalThis as any).browser.runtime.id = 'test-runtime'
    ;(globalThis as any).browser.storage.local.get = async () => ({
      [KeySpamFilterEnabled]: 'on',
      [KeySpamThreshold]: 20,
      [KeySpamDebugMode]: 'off',
      [KeySpamKeywordList]: '',
      [KeySpamRulesEnabled]: 'marketing_nickname:off,emoji_ratio:off,short_text:off,random_username:off,marketing_keyword:on,pure_emoji:off,decorated_nickname:off,repeated_chars:off',
      [KeySpamWhitelist]: '',
      [KeySpamBlacklist]: '',
    })
    invalidateSpamConfig()
  })

  afterEach(() => {
    window.history.pushState({}, '', '/')
    document.body.innerHTML = ''
    delete (globalThis as any).browser.runtime.id
    invalidateSpamConfig()
  })

  it('treats an explicitly cleared list as empty instead of restoring defaults', async () => {
    await runScan(true)

    const article = document.querySelector<HTMLElement>('#comment')!
    expect(article.style.display).not.toBe('none')
    expect(article.getAttribute('data-xf-spam-score')).toBe('0')
  })
})
