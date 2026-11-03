// 从 X.com 推文 article 元素中解析出文本/昵称/handle
// 抽到这里是为了可单测：jsdom 加载 HTML 字符串后调用即可

import { isInsideQuotedTweet } from './detect-language'

export * from './detect-language'

export interface TweetInfo {
  element: HTMLElement
  text: string
  authorHandle: string
  authorName: string
}

const NAVIGATION_HANDLES = new Set([
  'home',
  'explore',
  'notifications',
  'messages',
  'bookmarks',
  'profile',
  'i',
  'compose',
  'search',
  'settings',
])

/**
 * 提取推文中的 <a> 链接元素的完整文本，避免 URL 被视觉省略号截断：
 * X (Twitter) 在渲染外链时，会拆分为：
 *   1. 隐藏协议头 span（如 <span aria-hidden="true">https://</span>）
 *   2. 可见前缀文本（如 github.com/anthropics/Fla）
 *   3. 隐藏后缀文本 span（如 <span aria-hidden="true">shProve</span>）
 *   4. 省略号 span（如 <span aria-hidden="true" class="... r-lrvibr">…</span>）
 * 若直接读 textContent，会把结尾的视觉省略号也拼进去，导致变成 "https://github.com/anthropics/FlashProve…"
 * 本函数通过过滤纯视觉省略号节点，完整还原出真实的无省略 URL。
 */
export function extractAnchorFullText(
  doc: Document,
  a: HTMLElement,
): string {
  const walker = doc.createTreeWalker(a, NodeFilter.SHOW_ALL, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as HTMLElement
        if (elem.hidden || elem.style?.display === 'none') {
          return NodeFilter.FILTER_REJECT
        }
        // Twitter 的视觉省略号节点通常带有 r-lrvibr 类，或者其文本仅为省略号
        const t = (elem.textContent || '').trim()
        if (t === '…' || t === '...') {
          return NodeFilter.FILTER_REJECT
        }
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let raw = ''
  let n: Node | null
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.textContent || ''
      if (t.trim() !== '…' && t.trim() !== '...') {
        raw += t
      }
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement
      if (el.tagName.toUpperCase() === 'IMG') {
        raw += el.getAttribute('alt') || ''
      }
    }
  }

  let text = raw.trim()
  // 清理结尾可能残留的省略号（如 \u2026 或多个点）
  text = text.replace(/[\u2026]+$|\.{3,}$/, '')
  return text
}

/**
 * 收集元素的可见文本
 * X 把 emoji 渲染成 <img alt="🌸">，textContent 会漏掉，
 * 所以遍历时要把 img[alt] 也算进文本；遇到链接则提取完整无省略 URL。
 */
export function collectVisibleText(
  doc: Document,
  el: HTMLElement | null,
): string {
  if (!el) return ''
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_ALL, null)
  let result = ''
  let node: Node | null
  let currentAnchor: HTMLElement | null = null

  while ((node = walker.nextNode())) {
    if (currentAnchor) {
      if (currentAnchor.contains(node)) {
        continue
      }
      currentAnchor = null
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const e = node as HTMLElement
      const tag = e.tagName.toUpperCase()
      if (tag === 'A') {
        currentAnchor = e
        result += extractAnchorFullText(doc, e)
        continue
      }
      if (tag === 'IMG') {
        result += e.getAttribute('alt') || ''
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || ''
    }
  }
  return result.replace(/\s+/g, ' ').trim()
}

/**
 * 从推文 article 元素解析出 authorName/handle/text
 * 解析失败时返回 null（既没文本也没昵称）
 */
export function extractTweetInfo(
  doc: Document,
  article: HTMLElement,
): TweetInfo | null {
  // author handle: 直接在 article 内部查找 /handle 链接，避免全局查询导致拿到错误用户，并排除引用推文卡片内的链接
  const handleLinks = article.querySelectorAll<HTMLAnchorElement>(
    'a[href^="/"][role="link"]',
  )
  let handle = ''
  for (const a of Array.from(handleLinks)) {
    if (isInsideQuotedTweet(a, article)) continue
    const m = a
      .getAttribute('href')
      ?.match(/^\/([A-Za-z0-9_]{1,15})(?:\/|$)/)
    if (m && m[1] && !NAVIGATION_HANDLES.has(m[1].toLowerCase())) {
      handle = m[1]
      break
    }
  }

  // 获取主推文昵称（排除引用推文中的 User-Name）
  const allUserNames = Array.from(article.querySelectorAll<HTMLElement>('[data-testid="User-Name"]'))
  const userNameEl = allUserNames.find((el) => !isInsideQuotedTweet(el, article)) || allUserNames[0]
  const authorName = collectVisibleText(doc, userNameEl)

  // 支持普通 Tweet (`tweetText`) 以及 X 文章 Article (`twitter-article-title` / `longformRichTextComponent` / `twitterArticleRichTextView`)
  let text = ''
  const allTweetTexts = Array.from(article.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
  const textEl = allTweetTexts.find((el) => !isInsideQuotedTweet(el, article)) || allTweetTexts[0]
  if (textEl) {
    text = collectVisibleText(doc, textEl)
  } else {
    const titleEl = article.querySelector<HTMLElement>('[data-testid="twitter-article-title"]')
    const articleBodyEl =
      article.querySelector<HTMLElement>('[data-testid="twitterArticleRichTextView"]') ||
      article.querySelector<HTMLElement>('[data-testid="twitterArticleReadView"]')
    const titleText = collectVisibleText(doc, titleEl)
    const bodyText = collectVisibleText(doc, articleBodyEl)
    text = [titleText, bodyText].filter(Boolean).join('\n')
  }

  if (!text && !authorName) return null
  return { element: article, text, authorHandle: handle, authorName }
}

/**
 * 递归遍历收集元素的格式化可见文本，
 * 专为复制推文文案设计：
 * - 完整保留原本的段落换行与行内格式（避免被正则全部压成单个空格）
 * - 支持 <br> 显式换行
 * - 支持提取 <img> 的 alt 属性（X 把 Emoji 渲染为 <img alt="🌸">）
 * - 过滤隐藏节点以及内部的“显示更多 / Show more”等按钮元素
 */
export function collectFormattedTweetText(
  doc: Document,
  el: HTMLElement | null,
): string {
  if (!el) return ''

  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_ALL, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as HTMLElement
        if (elem.hidden || elem.style?.display === 'none') {
          return NodeFilter.FILTER_REJECT
        }
        if (
          elem.getAttribute('role') === 'button' ||
          elem.tagName.toUpperCase() === 'BUTTON'
        ) {
          return NodeFilter.FILTER_REJECT
        }
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let raw = ''
  let node: Node | null
  let currentAnchor: HTMLElement | null = null

  while ((node = walker.nextNode())) {
    if (currentAnchor) {
      if (currentAnchor.contains(node)) {
        continue
      }
      currentAnchor = null
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const e = node as HTMLElement
      const tag = e.tagName.toUpperCase()
      if (tag === 'A') {
        currentAnchor = e
        raw += extractAnchorFullText(doc, e)
        continue
      }
      if (tag === 'BR') {
        raw += '\n'
        continue
      }
      if (tag === 'IMG') {
        raw += e.getAttribute('alt') || ''
        continue
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      raw += node.textContent || ''
    }
  }

  return raw
    .replace(/\r\n|\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 从富文本长文（Article）容器中提取纯净正文文本，保留段落/标题换行结构
 */
export function collectArticleCopyBodyText(
  doc: Document,
  articleEl: HTMLElement | null,
): string {
  if (!articleEl) return ''

  let container = articleEl
  while (container.children.length === 1 && container.firstElementChild instanceof HTMLElement) {
    container = container.firstElementChild
  }

  const children = Array.from(container.children) as HTMLElement[]
  if (children.length > 1) {
    const blocks: string[] = []
    for (const child of children) {
      const text = collectFormattedTweetText(doc, child)
      if (text) {
        blocks.push(text)
      }
    }
    if (blocks.length > 0) {
      return blocks.join('\n\n')
    }
  }

  const candidateElements = Array.from(
    container.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, h5, h6, [role="heading"], p, [data-block="true"], .longform-unstyled, li, blockquote, pre',
    ),
  )

  if (candidateElements.length > 0) {
    const topLevelBlocks = candidateElements.filter((el) => {
      let parent = el.parentElement
      while (parent && parent !== container) {
        if (candidateElements.includes(parent)) {
          return false
        }
        parent = parent.parentElement
      }
      return true
    })

    const paragraphs = topLevelBlocks
      .map((el) => collectFormattedTweetText(doc, el))
      .filter(Boolean)

    if (paragraphs.length > 0) {
      return paragraphs.join('\n\n')
    }
  }

  return collectFormattedTweetText(doc, container)
}

/**
 * 提取推文用于剪贴板复制的纯文本内容：
 * 1. 优先提取当前推文正文（排除内部 Quote Tweet 引用推文）
 * 2. 完整保留换行与多行排版格式
 * 3. 提取 Emoji（img[alt]）与 <br>
 * 4. 兼容 Twitter Article 长文章与普通推文
 * 5. 过滤媒体，仅完整提取纯文本
 */
export function extractTweetCopyText(
  doc: Document,
  article: HTMLElement,
): string {
  // 1. 获取主推文的正文（排除引用推文中的 tweetText）
  const allTweetTexts = Array.from(article.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
  const textEl = allTweetTexts.find((el) => !isInsideQuotedTweet(el, article)) || allTweetTexts[0]
  const tweetIntroText = textEl ? collectFormattedTweetText(doc, textEl) : ''

  // 2. 检查并提取 X 文章（Twitter Article）的大标题与完整正文
  const isDetailPage =
    typeof window !== 'undefined' &&
    (/\/(?:status\/\d+|i\/article\/|article\/)/.test(window.location?.pathname || ''))

  const titleEl =
    article.querySelector<HTMLElement>('[data-testid="twitter-article-title"]') ||
    (isDetailPage ? doc.querySelector<HTMLElement>('[data-testid="twitter-article-title"]') : null)

  const articleBodyEl =
    article.querySelector<HTMLElement>('[data-testid="twitterArticleRichTextView"]') ||
    article.querySelector<HTMLElement>('[data-testid="twitterArticleReadView"]') ||
    article.querySelector<HTMLElement>('[data-testid="article-body"]') ||
    (isDetailPage
      ? doc.querySelector<HTMLElement>('[data-testid="twitterArticleRichTextView"]') ||
        doc.querySelector<HTMLElement>('[data-testid="twitterArticleReadView"]')
      : null)

  const titleText = titleEl ? collectFormattedTweetText(doc, titleEl) : ''
  const bodyText = articleBodyEl ? collectArticleCopyBodyText(doc, articleBodyEl) : ''

  // 3. 组合推文导语、文章标题与正文
  const textParts: string[] = []
  if (tweetIntroText && tweetIntroText !== titleText && !bodyText.startsWith(tweetIntroText)) {
    textParts.push(tweetIntroText)
  }
  if (titleText && !bodyText.startsWith(titleText)) {
    textParts.push(titleText)
  }
  if (bodyText) {
    textParts.push(bodyText)
  }

  if (textParts.length > 0) {
    return textParts.join('\n\n')
  }

  return tweetIntroText
}
