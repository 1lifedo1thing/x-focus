import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { invalidateSpamConfig, runScan } from '../../content-scripts/spam/scanner'
import {
  KeySpamDebugMode,
  KeySpamFilterEnabled,
  KeySpamKeywordList,
  KeySpamThreshold,
} from '../../storage-keys'

function mockSpamStorage() {
  ;(globalThis as any).browser.runtime.id = 'test-runtime'
  ;(globalThis as any).browser.storage.local.get = async () => ({
    [KeySpamFilterEnabled]: 'on',
    [KeySpamDebugMode]: 'on',
    [KeySpamThreshold]: 45,
    [KeySpamKeywordList]: '点击主页',
  })
}

describe('debug bar in dialogs', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/alice/status/123456')
    document.body.innerHTML = ''
    invalidateSpamConfig()
    mockSpamStorage()
  })

  afterEach(() => {
    window.history.pushState({}, '', '/')
    delete (globalThis as any).browser.runtime.id
    ;(globalThis as any).browser.storage.local.get = async () => ({})
    invalidateSpamConfig()
  })

  it('does not render score bars for tweets inside role=dialog modals', async () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <a href="/alice/status/123456">Main Tweet</a>
      </article>
      <div role="dialog">
        <article data-testid="tweet" id="dialog-tweet">
          <a href="/bob" role="link">@bob</a>
          <div data-testid="User-Name">Bob</div>
          <div data-testid="tweetText">点击主页</div>
        </article>
      </div>
    `

    await runScan(true)

    const article = document.querySelector<HTMLElement>('#dialog-tweet')!
    expect(article.querySelector('#x-focus-spam-debug-bar')).toBeNull()
  })

  it('removes stale score bars that were already inserted inside dialogs', async () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <a href="/alice/status/123456">Main Tweet</a>
      </article>
      <div role="dialog">
        <article data-testid="tweet" id="dialog-tweet" data-xf-spam-processed="1" data-xf-spam-debug-positioned="1" style="position: relative;">
          <a href="/bob" role="link">@bob</a>
          <div data-testid="User-Name">Bob</div>
          <div data-testid="tweetText">点击主页</div>
          <div id="x-focus-spam-debug-bar" data-xf-spam-debug="1">old score</div>
        </article>
      </div>
    `

    await runScan(true)

    const article = document.querySelector<HTMLElement>('#dialog-tweet')!
    expect(article.querySelector('#x-focus-spam-debug-bar')).toBeNull()
    expect(article.style.position).toBe('')
    expect(article.hasAttribute('data-xf-spam-debug-positioned')).toBe(false)
  })
})
