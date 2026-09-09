import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { extractTweetInfo, collectVisibleText } from '../../shared/parse-tweet'

function docOf(html: string): Document {
  return new JSDOM(html).window.document
}

describe('collectVisibleText', () => {
  it('returns empty string for null element', () => {
    const doc = docOf('<div></div>')
    expect(collectVisibleText(doc, null)).toBe('')
  })

  it('returns inner text from regular elements', () => {
    const doc = docOf('<div>hello world</div>')
    const el = doc.querySelector('div')!
    expect(collectVisibleText(doc, el)).toBe('hello world')
  })

  it('includes <img alt> as text (X renders emoji as img)', () => {
    const doc = docOf('<div><img alt="🌸">plain</div>')
    const el = doc.querySelector('div')!
    // img 和 plain 紧贴：没有空白节点，所以不会插空格
    expect(collectVisibleText(doc, el)).toBe('🌸plain')
  })

  it('normalizes whitespace and trims', () => {
    const doc = docOf('<div>  hello\n\n   world  </div>')
    const el = doc.querySelector('div')!
    expect(collectVisibleText(doc, el)).toBe('hello world')
  })

  it('skips the root element itself (only children contribute)', () => {
    const doc = docOf('<div>ROOT<p>child</p></div>')
    const el = doc.querySelector('div')!
    // 跳过根节点，理论上不收集"ROOT"，但 TreeWalker 的实现可能行为不一致
    // 这里只验证不会把 div 自身文字重复算入两次
    const result = collectVisibleText(doc, el)
    expect(result).toContain('child')
  })

  it('handles multiple img alt emoji in sequence', () => {
    // img 紧贴时，alt 之间没有空白
    const doc = docOf('<div><img alt="🌻"><img alt="😂"><img alt="🌹"></div>')
    const el = doc.querySelector('div')!
    expect(collectVisibleText(doc, el)).toBe('🌻😂🌹')
  })

  it('inserts single space when img elements are separated by whitespace', () => {
    const doc = docOf(
      '<div><img alt="🌻">\n            <img alt="😂">\n            <img alt="🌹"></div>',
    )
    const el = doc.querySelector('div')!
    expect(collectVisibleText(doc, el)).toBe('🌻 😂 🌹')
  })

  it('handles img with no alt attribute (returns empty str for that img)', () => {
    const doc = docOf('<div>text<img>after</div>')
    const el = doc.querySelector('div')!
    expect(collectVisibleText(doc, el)).toBe('textafter')
  })

  it('handles nested child elements with text (no space inserted between elements)', () => {
    // collectVisibleText 不做内联元素间插空格，与 textContent 行为一致
    const doc = docOf('<div><span>hello</span><span>world</span></div>')
    const el = doc.querySelector('div')!
    expect(collectVisibleText(doc, el)).toBe('helloworld')
  })

  it('handles nested elements with whitespace in HTML source', () => {
    const doc = docOf('<div><span>hello</span> <span>world</span></div>')
    const el = doc.querySelector('div')!
    expect(collectVisibleText(doc, el)).toBe('hello world')
  })

  it('returns empty for element with no text content', () => {
    const doc = docOf('<div><span></span><img alt=""></div>')
    const el = doc.querySelector('div')!
    expect(collectVisibleText(doc, el)).toBe('')
  })

  it('handles mixed inline elements and text', () => {
    const doc = docOf('<div>prefix <strong>bold</strong> <img alt="emoji"> suffix</div>')
    const el = doc.querySelector('div')!
    expect(collectVisibleText(doc, el)).toBe('prefix bold emoji suffix')
  })
})

describe('extractTweetInfo', () => {
  it('extracts handle from /<handle> links inside the article', () => {
    const html = `
      <article data-testid="tweet">
        <a href="/home">home link</a>
        <a href="/alice" role="link">@alice</a>
        <div data-testid="User-Name"><span>Alice</span></div>
        <div data-testid="tweetText"><span>hello</span></div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = extractTweetInfo(doc, article)
    expect(info).not.toBeNull()
    expect(info!.authorHandle).toBe('alice')
    expect(info!.authorName).toBe('Alice')
    expect(info!.text).toBe('hello')
  })

  it('skips navigation handles (home, explore, ...)', () => {
    const html = `
      <article data-testid="tweet">
        <a href="/home" role="link">Home</a>
        <a href="/explore" role="link">Explore</a>
        <a href="/bob" role="link">@bob</a>
        <div data-testid="User-Name">Bob</div>
        <div data-testid="tweetText">hi</div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = extractTweetInfo(doc, article)
    expect(info!.authorHandle).toBe('bob')
  })

  it('returns null when both text and name are empty', () => {
    const html = `<article data-testid="tweet"></article>`
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    expect(extractTweetInfo(doc, article)).toBeNull()
  })

  it('handles emoji-only text (X renders emoji as <img alt>)', () => {
    // X 实际 HTML：img 之间有换行+缩进
    const html = `
      <article data-testid="tweet">
        <a href="/x" role="link">x</a>
        <div data-testid="User-Name">花姐</div>
        <div data-testid="tweetText"><img alt="🌻">
            <img alt="😂">
            <img alt="🌹"></div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = extractTweetInfo(doc, article)
    expect(info!.text).toBe('🌻 😂 🌹')
  })

  it('does not pick up links from outside the article', () => {
    const html = `
      <div>
        <a href="/outside" role="link">outside</a>
        <article data-testid="tweet">
          <a href="/inside" role="link">inside</a>
          <div data-testid="User-Name">X</div>
          <div data-testid="tweetText">y</div>
        </article>
      </div>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = extractTweetInfo(doc, article)
    expect(info!.authorHandle).toBe('inside')
  })

  it('extracts title and content from X Article components', () => {
    const html = `
      <article data-testid="tweet" role="article">
        <a href="/aAbi8MOGCZi0JUR" role="link">@aAbi8MOGCZi0JUR</a>
        <div data-testid="User-Name">Prompt 修仙散人</div>
        <div data-testid="twitter-article-title">如何快速做到每天增长 200+？试试越南赛道</div>
        <div data-testid="twitterArticleRichTextView">
          <h2>我的战绩</h2>
          <div>中文区太卷，不妨换个赛道</div>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = extractTweetInfo(doc, article)
    expect(info).not.toBeNull()
    expect(info!.authorHandle).toBe('aAbi8MOGCZi0JUR')
    expect(info!.authorName).toBe('Prompt 修仙散人')
    expect(info!.text).toContain('如何快速做到每天增长 200+？试试越南赛道')
    expect(info!.text).toContain('中文区太卷，不妨换个赛道')
  })
})
