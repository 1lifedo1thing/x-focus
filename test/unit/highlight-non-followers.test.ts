import { describe, it, expect, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { changeHighlightNonFollowers } from '../../content-scripts/options/interface'

describe('changeHighlightNonFollowers 页面作用域测试', () => {
  let dom: JSDOM

  const createDom = (url: string) => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><head></head><body>
        <div data-testid="UserCell" id="user-1">
          <button data-testid="12345-unfollow" aria-label="正在关注 @user1">
            <span>正在关注</span>
          </button>
        </div>
        <div data-testid="UserCell" id="user-2">
          <div data-testid="userFollowIndicator"><span>关注了你</span></div>
          <button data-testid="67890-unfollow" aria-label="正在关注 @user2">
            <span>正在关注</span>
          </button>
        </div>
      </body></html>`,
      { pretendToBeVisual: true, url },
    )
    globalThis.document = dom.window.document
    // @ts-expect-error jsdom window 与浏览器 Window 类型不完全兼容
    globalThis.window = dom.window
    globalThis.location = dom.window.location
  }

  afterEach(() => {
    if (dom) dom.window.close()
  })

  it('在非 /following 页面（如 /home）上，不添加任何高亮样式，且清理已有样式', () => {
    createDom('https://x.com/home')
    changeHighlightNonFollowers('on')

    const user1Btn = document.querySelector('#user-1 button')!
    expect(user1Btn.classList.contains('xf-non-follower-btn')).toBe(false)
    expect(document.getElementById('xf-style-highlightNonFollowers')).toBeNull()
  })

  it('在 /following 页面上，对未关注我的用户按钮添加红色边框类名 xf-non-follower-btn', () => {
    createDom('https://x.com/my_username/following')
    changeHighlightNonFollowers('on')

    const user1Btn = document.querySelector('#user-1 button')!
    const user2Btn = document.querySelector('#user-2 button')!

    // user1 没有 userFollowIndicator，因此被标记
    expect(user1Btn.classList.contains('xf-non-follower-btn')).toBe(true)
    // user2 有 userFollowIndicator，保持原样
    expect(user2Btn.classList.contains('xf-non-follower-btn')).toBe(false)
    expect(document.getElementById('xf-style-highlightNonFollowers')).not.toBeNull()
  })

  it('切换离开 /following 页面时，自动清理之前的标红类名', () => {
    createDom('https://x.com/my_username/following')
    changeHighlightNonFollowers('on')

    const user1Btn = document.querySelector('#user-1 button')!
    expect(user1Btn.classList.contains('xf-non-follower-btn')).toBe(true)

    // 模拟路由跳转到 /home
    dom.reconfigure({ url: 'https://x.com/home' })
    changeHighlightNonFollowers('on')

    expect(user1Btn.classList.contains('xf-non-follower-btn')).toBe(false)
    expect(document.getElementById('xf-style-highlightNonFollowers')).toBeNull()
  })
})
