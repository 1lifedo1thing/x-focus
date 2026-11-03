import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  isTweetOrArticleUrl,
  extractBookmarkMetrics,
  extractBookmarkFromAriaLabel,
  formatBookmarkCount,
  getBookmarkOwnerIds,
} from '../../shared/bookmark-interceptor'
import {
  applyBookmarkCountToButton,
  updateBookmarkCounters,
  removeBookmarkCounters,
  setBookmarkCountEnabled,
} from '../../content-scripts/features/bookmark-counter'

describe('推文/长文常驻收藏量 (Bookmark Counter) 核心逻辑测试', () => {
  describe('formatBookmarkCount 数值格式化', () => {
    it('对 0、负数或 NaN 返回空串（不展示数字）', () => {
      expect(formatBookmarkCount(0)).toBe('')
      expect(formatBookmarkCount(-5)).toBe('')
      expect(formatBookmarkCount(NaN)).toBe('')
    })

    it('对 10000 以下的数字返回千分位格式', () => {
      expect(formatBookmarkCount(1)).toBe('1')
      expect(formatBookmarkCount(45)).toBe('45')
      expect(formatBookmarkCount(999)).toBe('999')
      expect(formatBookmarkCount(1234)).toBe('1,234')
      expect(formatBookmarkCount(9999)).toBe('9,999')
    })

    it('对 10000 及以上的数字在中文下格式化为万/亿', () => {
      expect(formatBookmarkCount(10000, 'zh')).toBe('1万')
      expect(formatBookmarkCount(12500, 'zh')).toBe('1.3万')
      expect(formatBookmarkCount(89000, 'zh')).toBe('8.9万')
      expect(formatBookmarkCount(100000000, 'zh')).toBe('1亿')
    })

    it('英文环境下正确格式化为 K / M', () => {
      expect(formatBookmarkCount(12500, 'en')).toBe('12.5K')
      expect(formatBookmarkCount(1200000, 'en')).toBe('1.2M')
    })
  })

  describe('extractBookmarkFromAriaLabel 正则提取', () => {
    it('正确从各种多语言 aria-label 属性中提取书签数值', () => {
      expect(extractBookmarkFromAriaLabel('186 个书签。将帖子添加到书签')).toBe(186)
      expect(extractBookmarkFromAriaLabel('32 书签')).toBe(32)
      expect(extractBookmarkFromAriaLabel('1,245 书签')).toBe(1245)
      expect(extractBookmarkFromAriaLabel('128 Bookmarks')).toBe(128)
      expect(extractBookmarkFromAriaLabel('1 Bookmark')).toBe(1)
      expect(extractBookmarkFromAriaLabel('Bookmark (45)')).toBe(45)
      expect(extractBookmarkFromAriaLabel('书签: 88')).toBe(88)
    })

    it('无数字的默认提示文本返回 null', () => {
      expect(extractBookmarkFromAriaLabel('将帖子添加到书签')).toBeNull()
      expect(extractBookmarkFromAriaLabel('Bookmark post')).toBeNull()
      expect(extractBookmarkFromAriaLabel(null)).toBeNull()
      expect(extractBookmarkFromAriaLabel('')).toBeNull()
    })
  })

  describe('isTweetOrArticleUrl URL 命中过滤', () => {
    it('命中包含 GraphQL 的推文与时间线接口', () => {
      expect(isTweetOrArticleUrl('https://x.com/i/api/graphql/123/TweetDetail')).toBe(true)
      expect(isTweetOrArticleUrl('https://x.com/i/api/graphql/456/HomeTimeline')).toBe(true)
      expect(isTweetOrArticleUrl('https://x.com/i/api/graphql/789/UserTweets')).toBe(true)
    })

    it('排除排期与设置等非推文内容接口', () => {
      expect(isTweetOrArticleUrl('https://x.com/i/api/graphql/abc/FetchScheduledTweets')).toBe(false)
      expect(isTweetOrArticleUrl('https://x.com/i/api/1.1/account/settings.json')).toBe(false)
      expect(isTweetOrArticleUrl('')).toBe(false)
    })
  })

  describe('extractBookmarkMetrics GraphQL 响应提取', () => {
    it('能从 GraphQL instructions 树中准确提取 rest_id 到 bookmark_count 的映射', () => {
      const mockPayload = {
        data: {
          home: {
            home_timeline_urt: {
              instructions: [
                {
                  type: 'TimelineAddEntries',
                  entries: [
                    {
                      entryId: 'tweet-11111',
                      content: {
                        itemContent: {
                          tweet_results: {
                            result: {
                              rest_id: '11111',
                              legacy: {
                                bookmark_count: 42,
                                full_text: 'Hello world',
                              },
                            },
                          },
                        },
                      },
                    },
                    {
                      entryId: 'tweet-22222',
                      content: {
                        itemContent: {
                          tweet_results: {
                            result: {
                              rest_id: '22222',
                              legacy: {
                                bookmark_count: 567,
                                full_text: 'Another tweet',
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      }

      const metrics = extractBookmarkMetrics(mockPayload)
      expect(metrics['11111']).toBe(42)
      expect(metrics['22222']).toBe(567)
    })

    it('支持长文 Article 及其双向 ID 绑定', () => {
      const mockArticlePayload = {
        data: {
          tweetResult: {
            result: {
              rest_id: '33333',
              article: {
                article_results: {
                  result: {
                    rest_id: 'article_9999',
                    bookmark_count: 1200,
                  },
                },
              },
            },
          },
        },
      }

      const metrics = extractBookmarkMetrics(mockArticlePayload)
      expect(metrics['33333']).toBe(1200)
      expect(metrics['article_9999']).toBe(1200)
    })
  })

  describe('DOM 注入与渲染交互测试', () => {
    let dom: JSDOM

    beforeEach(() => {
      dom = new JSDOM(
        `<!DOCTYPE html>
        <html>
          <head></head>
          <body>
            <article data-testid="tweet">
              <a href="/user/status/123456789">
                <time datetime="2026-10-22T10:00:00.000Z">1小时</time>
              </a>
              <div role="group">
                <button data-testid="reply">
                  <div data-testid="app-text-transition-container"><span>10</span></div>
                </button>
                <button data-testid="retweet">
                  <div data-testid="app-text-transition-container"><span>20</span></div>
                </button>
                <button data-testid="like">
                  <div data-testid="app-text-transition-container"><span>30</span></div>
                </button>
                <button data-testid="bookmark" aria-label="将帖子添加到书签">
                  <div>
                    <svg><path d="M12 2"/></svg>
                  </div>
                </button>
              </div>
            </article>
          </body>
        </html>`,
        { url: 'https://x.com/home' },
      )
      globalThis.document = dom.window.document
      // @ts-expect-error jsdom window
      globalThis.window = dom.window
      globalThis.HTMLElement = dom.window.HTMLElement
      setBookmarkCountEnabled(true)
    })

    afterEach(() => {
      removeBookmarkCounters()
      if (dom) dom.window.close()
    })

    it('getBookmarkOwnerIds 正确提取推文 status ID', () => {
      const btn = document.querySelector('button[data-testid="bookmark"]') as HTMLElement
      expect(btn).not.toBeNull()
      const ids = getBookmarkOwnerIds(btn)
      expect(ids).toContain('123456789')
    })

    it('applyBookmarkCountToButton 在书签按钮旁注入格式化数字并记录 data 属性', () => {
      const btn = document.querySelector('button[data-testid="bookmark"]') as HTMLElement
      applyBookmarkCountToButton(btn, 88)

      const counter = btn.querySelector('.xf-bookmark-counter')
      expect(counter).not.toBeNull()
      expect(counter?.textContent?.trim()).toBe('88')
      expect(btn.dataset.xfBookmarkCount).toBe('88')
    })

    it('updateBookmarkCounters 通过 aria-label 兜底时自动渲染数字', () => {
      const btn = document.querySelector('button[data-testid="bookmark"]') as HTMLElement
      btn.setAttribute('aria-label', '152 个书签。将帖子添加到书签')

      updateBookmarkCounters()

      const counter = btn.querySelector('.xf-bookmark-counter')
      expect(counter).not.toBeNull()
      expect(counter?.textContent?.trim()).toBe('152')
    })

    it('removeBookmarkCounters 能彻底清理注入的计数器与样式', () => {
      const btn = document.querySelector('button[data-testid="bookmark"]') as HTMLElement
      applyBookmarkCountToButton(btn, 120)
      expect(btn.querySelector('.xf-bookmark-counter')).not.toBeNull()

      removeBookmarkCounters()
      expect(btn.querySelector('.xf-bookmark-counter')).toBeNull()
    })
  })
})
