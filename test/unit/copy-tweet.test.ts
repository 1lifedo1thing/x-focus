import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { createCopyTweetButton, COPY_BTN_ATTR } from '../../content-scripts/features/copy-tweet'
import { injectKeywordButton } from '../../content-scripts/spam/keyword-picker'

describe('copy-tweet feature', () => {
  let dom: JSDOM
  let doc: Document

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <article data-testid="tweet">
            <div class="header">
              <div class="actions">
                <button aria-label="Grok 操作" type="button">Grok</button>
              </div>
            </div>
            <div data-testid="tweetText">
              <span>这是非常精彩的一段推文文案！\n包含换行与思考。</span>
            </div>
          </article>
        </body>
      </html>
    `, { url: 'https://x.com/home' })
    doc = dom.window.document
    vi.stubGlobal('document', doc)
    vi.stubGlobal('window', dom.window)
    vi.stubGlobal('navigator', dom.window.navigator)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates copy button with correct attributes and default icon', () => {
    const article = doc.querySelector('article')!
    const btn = createCopyTweetButton(article)

    expect(btn.getAttribute(COPY_BTN_ATTR)).toBe('1')
    expect(btn.type).toBe('button')
    expect(btn.title).toBe('复制推文')
    expect(btn.getAttribute('aria-label')).toBe('复制推文')
    expect(btn.innerHTML).toContain('<svg')
  })

  it('injects copy button directly to the left of "添加到营销词库" button', () => {
    const article = doc.querySelector('article')!
    injectKeywordButton(article)

    const copyBtn = article.querySelector(`button[${COPY_BTN_ATTR}]`) as HTMLButtonElement | null
    const kwBtn = article.querySelector('button[data-xf-kw-btn]') as HTMLButtonElement | null

    expect(copyBtn).not.toBeNull()
    expect(kwBtn).not.toBeNull()

    // 验证位置：复制推文按钮恰好是“添加到营销词库”按钮的前一个兄弟节点（即视觉左侧）
    expect(kwBtn!.previousElementSibling).toBe(copyBtn)
    expect(copyBtn!.title).toBe('复制推文')
    expect(kwBtn!.title).toBe('添加到营销词库')
  })

  it('copies text and provides visual feedback when clicked', async () => {
    vi.useFakeTimers()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })
    Object.defineProperty(dom.window, 'isSecureContext', { value: true, writable: true })

    const article = doc.querySelector('article')!
    injectKeywordButton(article)

    const copyBtn = article.querySelector(`button[${COPY_BTN_ATTR}]`) as HTMLButtonElement

    // 触发点击
    copyBtn.click()
    await Promise.resolve()
    await Promise.resolve()

    // 检查剪贴板写入内容（保留换行）
    expect(writeTextMock).toHaveBeenCalledWith('这是非常精彩的一段推文文案！\n包含换行与思考。')

    // 检查反馈状态：变为绿勾与“已复制推文”
    expect(copyBtn.getAttribute('data-copied')).toBe('1')
    expect(copyBtn.title).toBe('已复制推文')
    expect(copyBtn.style.color).toBe('rgb(52, 168, 83)')

    // 1500ms 后应恢复初始状态
    vi.advanceTimersByTime(1500)
    expect(copyBtn.getAttribute('data-copied')).toBeNull()
    expect(copyBtn.title).toBe('复制推文')

    vi.useRealTimers()
  })

  it('does not copy and shows warning when tweet has no text', async () => {
    const writeTextMock = vi.fn()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    // 清空 tweetText
    const tweetTextEl = doc.querySelector('[data-testid="tweetText"]')!
    tweetTextEl.remove()

    const article = doc.querySelector('article')!
    injectKeywordButton(article)

    const copyBtn = article.querySelector(`button[${COPY_BTN_ATTR}]`) as HTMLButtonElement
    copyBtn.click()
    await Promise.resolve()

    expect(writeTextMock).not.toHaveBeenCalled()
    expect(copyBtn.getAttribute('data-copied')).toBeNull()

    const toast = doc.getElementById('xf-toast-container')
    expect(toast?.textContent).toContain('该推文未包含文本内容')
  })
})
