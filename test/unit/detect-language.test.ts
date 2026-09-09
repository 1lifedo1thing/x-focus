import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  detectTweetLanguage,
  isInsideQuotedTweet,
  normalizeLanguageName,
} from '../../shared/detect-language'
import { extractTweetInfo } from '../../shared/parse-tweet'

function docOf(html: string): Document {
  return new JSDOM(html).window.document
}

describe('normalizeLanguageName', () => {
  it('normalizes common English names and codes', () => {
    expect(normalizeLanguageName('English')).toBe('英语')
    expect(normalizeLanguageName('en')).toBe('英语')
    expect(normalizeLanguageName('英文')).toBe('英语')
    expect(normalizeLanguageName('英语')).toBe('英语')
  })

  it('normalizes common Japanese / Korean / Vietnamese names', () => {
    expect(normalizeLanguageName('Japanese')).toBe('日语')
    expect(normalizeLanguageName('日文')).toBe('日语')
    expect(normalizeLanguageName('日本語')).toBe('日语')
    expect(normalizeLanguageName('Korean')).toBe('韩语')
    expect(normalizeLanguageName('한국어')).toBe('韩语')
    expect(normalizeLanguageName('Vietnamese')).toBe('越南语')
    expect(normalizeLanguageName('Tiếng Việt')).toBe('越南语')
  })

  it('normalizes Spanish, French, German, Russian, Arabic', () => {
    expect(normalizeLanguageName('Spanish')).toBe('西班牙语')
    expect(normalizeLanguageName('Español')).toBe('西班牙语')
    expect(normalizeLanguageName('French')).toBe('法语')
    expect(normalizeLanguageName('Français')).toBe('法语')
    expect(normalizeLanguageName('German')).toBe('德语')
    expect(normalizeLanguageName('Deutsch')).toBe('德语')
    expect(normalizeLanguageName('Russian')).toBe('俄语')
    expect(normalizeLanguageName('Arabic')).toBe('阿拉伯语')
  })

  it('preserves valid Chinese language names', () => {
    expect(normalizeLanguageName('乌克兰语')).toBe('乌克兰语')
    expect(normalizeLanguageName('波兰语')).toBe('波兰语')
  })
})

describe('isInsideQuotedTweet', () => {
  it('returns true for elements inside div[role="link"] quote card', () => {
    const html = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Main text</div>
        <div tabindex="0" role="link">
          <span id="quote-span">翻译自 英语</span>
          <div data-testid="tweetText" id="quote-text">Quoted text</div>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const quoteSpan = doc.querySelector('#quote-span')!
    const quoteText = doc.querySelector('#quote-text')!
    const mainText = doc.querySelector('[data-testid="tweetText"]')!

    expect(isInsideQuotedTweet(quoteSpan, article)).toBe(true)
    expect(isInsideQuotedTweet(quoteText, article)).toBe(true)
    expect(isInsideQuotedTweet(mainText, article)).toBe(false)
  })

  it('returns true for elements inside data-testid="quoteTweet"', () => {
    const html = `
      <article data-testid="tweet">
        <div data-testid="tweetText">Main text</div>
        <div data-testid="quoteTweet">
          <span id="quote-span">Quote content</span>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const quoteSpan = doc.querySelector('#quote-span')!

    expect(isInsideQuotedTweet(quoteSpan, article)).toBe(true)
  })
})

describe('detectTweetLanguage', () => {
  it('correctly identifies Chinese tweet quoting an English tweet with Twitter translation banner', () => {
    // 用户的实际场景：中文推文引用英文推文，英文推文带有“翻译自 英语”
    const html = `
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Max For AI</span><span>@MaxForAI</span></div>
        <div dir="auto" lang="zh" data-testid="tweetText">
          <span>卧槽！？Claude的20X套餐，居然不是真的20倍？看了才发现 Claude Max 这个“20x”，可能是 AI 订阅里最容易被误解的一个数字。</span>
        </div>
        <div aria-labelledby="quote-id" class="quote-container">
          <div dir="ltr"><span>引用</span></div>
          <div tabindex="0" role="link">
            <div data-testid="User-Name"><span>SataEric</span><span>@SataEricUX</span></div>
            <div>
              <span>翻译自 英语</span>
            </div>
            <div dir="auto" lang="zh" data-testid="tweetText">
              <span>Claude 定价中的整个“20 倍”说法太误导人了。</span>
            </div>
          </div>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const tweetText = '卧槽！？Claude的20X套餐，居然不是真的20倍？看了才发现 Claude Max 这个“20x”，可能是 AI 订阅里最容易被误解的一个数字。'

    const info = detectTweetLanguage(article, tweetText)
    expect(info.isForeign).toBe(false)
    expect(info.detectedLang).toBe('中文')
  })

  it('identifies foreign tweet when MAIN tweet has translation banner', () => {
    const html = `
      <article data-testid="tweet">
        <div data-testid="User-Name"><span>Sam Altman</span><span>@sama</span></div>
        <div>
          <span>翻译自 英语</span>
        </div>
        <div dir="auto" lang="zh" data-testid="tweetText">
          <span>这是被 Twitter 翻译成中文的内容</span>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const tweetText = '这是被 Twitter 翻译成中文的内容'

    const info = detectTweetLanguage(article, tweetText)
    expect(info.isForeign).toBe(true)
    expect(info.detectedLang).toBe('英语')
  })

  it('identifies foreign tweet with Translated from banner in English UI', () => {
    const html = `
      <article data-testid="tweet">
        <div>
          <span>Translated from Vietnamese</span>
        </div>
        <div data-testid="tweetText">Translated content</div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = detectTweetLanguage(article, 'Translated content')
    expect(info.isForeign).toBe(true)
    expect(info.detectedLang).toBe('越南语')
  })

  it('identifies English tweet by lang="en" on main tweet element', () => {
    const html = `
      <article data-testid="tweet">
        <div dir="auto" lang="en" data-testid="tweetText">
          <span>Anthropic just launched Claude 3.7 Sonnet hybrid reasoning model!</span>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = detectTweetLanguage(article, 'Anthropic just launched Claude 3.7 Sonnet hybrid reasoning model!')
    expect(info.isForeign).toBe(true)
    expect(info.detectedLang).toBe('英语')
  })

  it('identifies English tweet quoting Chinese tweet as English', () => {
    const html = `
      <article data-testid="tweet">
        <div dir="auto" lang="en" data-testid="tweetText">
          <span>What do you all think about this perspective?</span>
        </div>
        <div tabindex="0" role="link">
          <div dir="auto" lang="zh" data-testid="tweetText">
            <span>中文原帖内容</span>
          </div>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = detectTweetLanguage(article, 'What do you all think about this perspective?')
    expect(info.isForeign).toBe(true)
    expect(info.detectedLang).toBe('英语')
  })

  it('corrects Twitter mislabeling when lang="en" but text is clearly Chinese', () => {
    const html = `
      <article data-testid="tweet">
        <div dir="auto" lang="en" data-testid="tweetText">
          <span>今天天气真好，出来散步喝咖啡！</span>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = detectTweetLanguage(article, '今天天气真好，出来散步喝咖啡！')
    expect(info.isForeign).toBe(false)
    expect(info.detectedLang).toBe('中文')
  })

  it('identifies Japanese tweet with Kana', () => {
    const html = `
      <article data-testid="tweet">
        <div data-testid="tweetText">
          <span>おはようございます！今日も一日頑張りましょう。</span>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = detectTweetLanguage(article, 'おはようございます！今日も一日頑張りましょう。')
    expect(info.isForeign).toBe(true)
    expect(info.detectedLang).toBe('日语')
  })

  it('identifies Korean tweet with Hangul', () => {
    const html = `
      <article data-testid="tweet">
        <div data-testid="tweetText">
          <span>안녕하세요! 좋은 아침입니다.</span>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = detectTweetLanguage(article, '안녕하세요! 좋은 아침입니다.')
    expect(info.isForeign).toBe(true)
    expect(info.detectedLang).toBe('韩语')
  })

  it('identifies Vietnamese tweet with tones', () => {
    const html = `
      <article data-testid="tweet">
        <div data-testid="tweetText">
          <span>Chào mọi người, chúc một ngày tốt lành!</span>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = detectTweetLanguage(article, 'Chào mọi người, chúc một ngày tốt lành!')
    expect(info.isForeign).toBe(true)
    expect(info.detectedLang).toBe('越南语')
  })

  it('extractTweetInfo does not confuse main tweet with quoted tweet', () => {
    const html = `
      <article data-testid="tweet">
        <a href="/MaxForAI" role="link">@MaxForAI</a>
        <div data-testid="User-Name"><span>Max For AI</span></div>
        <div data-testid="tweetText"><span>Main tweet text</span></div>
        <div tabindex="0" role="link">
          <a href="/SataEricUX" role="link">@SataEricUX</a>
          <div data-testid="User-Name"><span>SataEric</span></div>
          <div data-testid="tweetText"><span>Quoted tweet text</span></div>
        </div>
      </article>
    `
    const doc = docOf(html)
    const article = doc.querySelector('article')!
    const info = extractTweetInfo(doc, article)

    expect(info).not.toBeNull()
    expect(info!.authorHandle).toBe('MaxForAI')
    expect(info!.authorName).toBe('Max For AI')
    expect(info!.text).toBe('Main tweet text')
  })
})
