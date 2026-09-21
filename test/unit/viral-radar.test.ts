import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  parseNumberWithSuffix,
  calculateTweetVelocity,
  classifyTweetVelocity,
  formatVelocityBadge,
} from '../../shared/viral-radar-parser'
import {
  findGrokButton,
  findCaretButton,
  getTopBadgeAnchor,
  runViralRadar,
  cleanupViralRadar,
  invalidateViralRadarCache,
} from '../../content-scripts/features/viral-radar'

describe('viral-radar-parser', () => {
  describe('parseNumberWithSuffix', () => {
    it('parses standard numbers with commas', () => {
      expect(parseNumberWithSuffix('1,234')).toBe(1234)
      expect(parseNumberWithSuffix('500')).toBe(500)
      expect(parseNumberWithSuffix('0')).toBe(0)
    })

    it('parses English K/M/B suffixes', () => {
      expect(parseNumberWithSuffix('1.2K')).toBe(1200)
      expect(parseNumberWithSuffix('15.3k')).toBe(15300)
      expect(parseNumberWithSuffix('2.5M')).toBe(2500000)
      expect(parseNumberWithSuffix('1.2B')).toBe(1200000000)
    })

    it('parses Chinese units (万 / 千 / 亿)', () => {
      expect(parseNumberWithSuffix('1.2万')).toBe(12000)
      expect(parseNumberWithSuffix('15.5萬')).toBe(155000)
      expect(parseNumberWithSuffix('1.5千')).toBe(1500)
      expect(parseNumberWithSuffix('1.2亿')).toBe(120000000)
    })

    it('parses embedded text in aria-label or status links', () => {
      expect(parseNumberWithSuffix('1,234 Views')).toBe(1234)
      expect(parseNumberWithSuffix('1.2K 次查看')).toBe(1200)
      expect(parseNumberWithSuffix('1.5万 次浏览')).toBe(15000)
      expect(parseNumberWithSuffix('1.8万 查看')).toBe(18000)
      expect(parseNumberWithSuffix('1273 次查看。查看帖子分析')).toBe(1273)
      expect(parseNumberWithSuffix('1074 次查看。查看帖子分析')).toBe(1074)
      expect(parseNumberWithSuffix('353 次查看。查看帖子分析')).toBe(353)
    })

    it('returns null for invalid inputs', () => {
      expect(parseNumberWithSuffix('')).toBeNull()
      expect(parseNumberWithSuffix('abc')).toBeNull()
    })
  })

  describe('calculateTweetVelocity', () => {
    it('calculates views per hour accurately', () => {
      const now = 1000 * 60 * 60 * 10 // 10 hours
      const publishTime = 1000 * 60 * 60 * 8 // 8 hours (2 hours ago)
      const views = 10000
      expect(calculateTweetVelocity(views, publishTime, now)).toBe(5000) // 10000 / 2 = 5000/h
    })

    it('clamps elapsed time to 1 minute minimum to prevent spikes', () => {
      const now = 1000 * 60 * 10
      const publishTime = now - 1000 * 10 // 10 seconds ago
      const views = 60
      // effectiveHours = 1 / 60
      expect(calculateTweetVelocity(views, publishTime, now)).toBe(3600) // 60 / (1/60)
    })
  })

  describe('classifyTweetVelocity', () => {
    it('classifies normal, potential, and viral tweets', () => {
      expect(classifyTweetVelocity(500, 1000, 10000)).toBe('normal')
      expect(classifyTweetVelocity(1000, 1000, 10000)).toBe('potential')
      expect(classifyTweetVelocity(5000, 1000, 10000)).toBe('potential')
      expect(classifyTweetVelocity(10000, 1000, 10000)).toBe('viral')
      expect(classifyTweetVelocity(25000, 1000, 10000)).toBe('viral')
    })
  })

  describe('formatVelocityBadge', () => {
    it('formats velocity numbers into readable strings', () => {
      expect(formatVelocityBadge(500)).toBe('500/h')
      expect(formatVelocityBadge(1200)).toBe('1.2k/h')
      expect(formatVelocityBadge(6900)).toBe('6.9k/h')
      expect(formatVelocityBadge(15800)).toBe('1.6万/h')
      expect(formatVelocityBadge(127000)).toBe('12.7万/h')
    })
  })
})

describe('viral-radar DOM anchors and mounting', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
      url: 'https://x.com/home',
    })
    globalThis.document = dom.window.document
    // @ts-expect-error jsdom window 类型兼容
    globalThis.window = dom.window
    invalidateViralRadarCache()
  })

  afterEach(() => {
    cleanupViralRadar()
    dom.window.close()
  })

  describe('findGrokButton', () => {
    it('finds button by Grok aria-label', () => {
      const article = document.createElement('article')
      article.innerHTML = `
        <div class="r-18u37iz r-1h0z5md">
          <button aria-label="Grok 操作" role="button" type="button">
            <div><span>Grok</span></div>
          </button>
        </div>
      `
      const btn = findGrokButton(article)
      expect(btn).not.toBeNull()
      expect(btn?.getAttribute('aria-label')).toBe('Grok 操作')
    })

    it('finds button by Grok SVG viewBox', () => {
      const article = document.createElement('article')
      article.innerHTML = `
        <div class="r-18u37iz r-1h0z5md">
          <button role="button" type="button">
            <svg viewBox="0 0 33 32"><path d="M12.745 20.54l10.97-8.19c..."></path></svg>
          </button>
        </div>
      `
      const btn = findGrokButton(article)
      expect(btn).not.toBeNull()
      expect(btn?.tagName).toBe('BUTTON')
    })

    it('returns null when no Grok button exists', () => {
      const article = document.createElement('article')
      article.innerHTML = `
        <div class="r-18u37iz">
          <button data-testid="caret" aria-label="更多"></button>
        </div>
      `
      expect(findGrokButton(article)).toBeNull()
    })
  })

  describe('findCaretButton', () => {
    it('finds button by data-testid="caret"', () => {
      const article = document.createElement('article')
      article.innerHTML = `
        <div>
          <button data-testid="caret" type="button"></button>
        </div>
      `
      const btn = findCaretButton(article)
      expect(btn).not.toBeNull()
      expect(btn?.getAttribute('data-testid')).toBe('caret')
    })

    it('finds button by aria-label="更多" or "More"', () => {
      const article = document.createElement('article')
      article.innerHTML = `
        <div>
          <button aria-label="更多" type="button"></button>
        </div>
      `
      expect(findCaretButton(article)).not.toBeNull()

      article.innerHTML = `
        <div>
          <button aria-label="More" type="button"></button>
        </div>
      `
      expect(findCaretButton(article)).not.toBeNull()
    })

    it('returns null when no caret button exists', () => {
      const article = document.createElement('article')
      article.innerHTML = '<div><span>No buttons</span></div>'
      expect(findCaretButton(article)).toBeNull()
    })
  })

  describe('getTopBadgeAnchor', () => {
    it('prioritizes Grok button when both Grok and Caret exist', () => {
      const article = document.createElement('article')
      article.innerHTML = `
        <div class="r-1kkk96v">
          <div class="r-18u37iz r-1wtj0ep">
            <div class="grok-wrapper r-18u37iz r-1h0z5md">
              <button aria-label="Grok 操作" type="button"></button>
            </div>
            <div class="caret-wrapper r-18u37iz">
              <button data-testid="caret" type="button"></button>
            </div>
          </div>
        </div>
      `
      const anchor = getTopBadgeAnchor(article)
      expect(anchor).not.toBeNull()
      expect(anchor?.container.classList.contains('grok-wrapper')).toBe(true)
      expect(anchor?.referenceNode?.getAttribute('aria-label')).toBe('Grok 操作')
    })

    it('falls back cleanly to Caret button when Grok is absent', () => {
      const article = document.createElement('article')
      article.innerHTML = `
        <div class="r-1kkk96v">
          <div class="r-18u37iz r-1wtj0ep">
            <div class="caret-wrapper r-18u37iz">
              <button data-testid="caret" type="button"></button>
            </div>
          </div>
        </div>
      `
      const anchor = getTopBadgeAnchor(article)
      expect(anchor).not.toBeNull()
      expect(anchor?.container.classList.contains('caret-wrapper')).toBe(true)
      expect(anchor?.referenceNode?.getAttribute('data-testid')).toBe('caret')
    })

    it('falls back to extension button if neither Grok nor Caret exist', () => {
      const article = document.createElement('article')
      article.innerHTML = `
        <div class="ext-wrapper">
          <button data-xf-kw-btn="1" type="button"></button>
        </div>
      `
      const anchor = getTopBadgeAnchor(article)
      expect(anchor).not.toBeNull()
      expect(anchor?.container.classList.contains('ext-wrapper')).toBe(true)
      expect(anchor?.referenceNode?.hasAttribute('data-xf-kw-btn')).toBe(true)
    })

    it('falls back to .r-1kkk96v .r-18u37iz container if no buttons exist', () => {
      const article = document.createElement('article')
      article.innerHTML = `
        <div class="r-1kkk96v">
          <div class="r-18u37iz">
            <div id="first-child"></div>
          </div>
        </div>
      `
      const anchor = getTopBadgeAnchor(article)
      expect(anchor).not.toBeNull()
      expect(anchor?.container.classList.contains('r-18u37iz')).toBe(true)
      expect(anchor?.referenceNode?.id).toBe('first-child')
    })

    it('returns null if no matching elements exist', () => {
      const article = document.createElement('article')
      article.innerHTML = '<div>Hello world</div>'
      expect(getTopBadgeAnchor(article)).toBeNull()
    })
  })

  describe('runViralRadar badge placement in DOM', () => {
    it('places badge immediately to the left of Grok button when Grok is present', async () => {
      const tweetHtml = `
        <article data-testid="tweet">
          <a href="/user/status/123456789">Link</a>
          <time datetime="2026-09-20T10:00:00.000Z"></time>
          <div class="r-1kkk96v">
            <div class="r-18u37iz r-1wtj0ep">
              <div class="grok-wrapper r-18u37iz r-1h0z5md">
                <button aria-label="Grok 操作" type="button">Grok</button>
              </div>
              <div class="caret-wrapper r-18u37iz">
                <button data-testid="caret" type="button">More</button>
              </div>
            </div>
          </div>
          <div>
            <a href="/user/status/123456789/analytics" aria-label="15000 次查看">1.5万 查看</a>
          </div>
        </article>
      `
      document.body.innerHTML = tweetHtml

      await runViralRadar(true)

      const article = document.querySelector('article[data-testid="tweet"]') as HTMLElement
      const badge = article.querySelector('[data-xf-viral-badge="1"]') as HTMLElement
      expect(badge).not.toBeNull()

      const grokBtn = findGrokButton(article)!
      // Badge should be inserted directly before grokBtn in the same parent container
      expect(badge.parentElement).toBe(grokBtn.parentElement)
      expect(badge.nextElementSibling).toBe(grokBtn)
    })

    it('places badge immediately to the left of Caret button when Grok is absent', async () => {
      const tweetHtml = `
        <article data-testid="tweet">
          <a href="/user/status/987654321">Link</a>
          <time datetime="2026-09-20T10:00:00.000Z"></time>
          <div class="r-1kkk96v">
            <div class="r-18u37iz r-1wtj0ep">
              <div class="caret-wrapper r-18u37iz">
                <button data-testid="caret" type="button">More</button>
              </div>
            </div>
          </div>
          <div>
            <a href="/user/status/987654321/analytics" aria-label="25000 次查看">2.5万 查看</a>
          </div>
        </article>
      `
      document.body.innerHTML = tweetHtml

      await runViralRadar(true)

      const article = document.querySelector('article[data-testid="tweet"]') as HTMLElement
      const badge = article.querySelector('[data-xf-viral-badge="1"]') as HTMLElement
      expect(badge).not.toBeNull()

      const caretBtn = findCaretButton(article)!
      // Badge should be inserted directly before caretBtn in the caret wrapper
      expect(badge.parentElement).toBe(caretBtn.parentElement)
      expect(badge.nextElementSibling).toBe(caretBtn)
    })

    it('relocates badge to before Grok if Grok loads asynchronously later', async () => {
      const tweetHtml = `
        <article data-testid="tweet">
          <a href="/user/status/555666777">Link</a>
          <time datetime="2026-09-20T10:00:00.000Z"></time>
          <div class="r-1kkk96v">
            <div class="top-row r-18u37iz r-1wtj0ep">
              <div class="caret-wrapper r-18u37iz">
                <button data-testid="caret" type="button">More</button>
              </div>
            </div>
          </div>
          <div>
            <a href="/user/status/555666777/analytics" aria-label="30000 次查看">3万 查看</a>
          </div>
        </article>
      `
      document.body.innerHTML = tweetHtml

      // First run: only Caret is present
      await runViralRadar(true)

      const article = document.querySelector('article[data-testid="tweet"]') as HTMLElement
      const caretBtn = findCaretButton(article)!
      let badge = article.querySelector('[data-xf-viral-badge="1"]') as HTMLElement
      expect(badge.nextElementSibling).toBe(caretBtn)

      // Asynchronously add Grok button wrapper
      const grokWrapper = document.createElement('div')
      grokWrapper.className = 'grok-wrapper r-18u37iz r-1h0z5md'
      grokWrapper.innerHTML = '<button aria-label="Grok 操作" type="button">Grok</button>'
      const topRow = article.querySelector('.top-row')!
      topRow.insertBefore(grokWrapper, caretBtn.parentElement)

      // Second run (normal polling, force=false)
      await runViralRadar(false)

      badge = article.querySelector('[data-xf-viral-badge="1"]') as HTMLElement
      const grokBtn = findGrokButton(article)!
      expect(badge.parentElement).toBe(grokBtn.parentElement)
      expect(badge.nextElementSibling).toBe(grokBtn)
      // Confirm there is exactly ONE badge (idempotent)
      expect(article.querySelectorAll('[data-xf-viral-badge="1"]').length).toBe(1)
    })

    it('stops click event propagation on the badge', async () => {
      const tweetHtml = `
        <article data-testid="tweet">
          <a href="/user/status/111222333">Link</a>
          <time datetime="2026-09-20T10:00:00.000Z"></time>
          <div class="caret-wrapper">
            <button data-testid="caret" type="button"></button>
          </div>
          <div>
            <a href="/user/status/111222333/analytics" aria-label="20000 次查看">2万 查看</a>
          </div>
        </article>
      `
      document.body.innerHTML = tweetHtml
      await runViralRadar(true)

      const badge = document.querySelector('[data-xf-viral-badge="1"]') as HTMLElement
      expect(badge).not.toBeNull()

      let parentClicked = false
      badge.parentElement!.addEventListener('click', () => {
        parentClicked = true
      })

      const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
      badge.dispatchEvent(event)

      expect(parentClicked).toBe(false)
    })
  })
})

