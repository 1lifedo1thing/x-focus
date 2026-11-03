import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  toOriginalImageUrl,
  generateMediaFilename,
  extractTweetMediaFromGraphql,
  harvestAllTweetMediaFromGraphql,
  extractTweetInfoFromDom,
} from '../../shared/tweet-media'
import { adjustButtonPositionForControls } from '../../content-scripts/features/tweet-media-download'

describe('推文媒体解析与下载工具函数测试 (tweet-media)', () => {
  describe('toOriginalImageUrl 原图转换', () => {
    it('正确将 twimg 图片的 name 参数替换为 orig', () => {
      const input = 'https://pbs.twimg.com/media/GfXxxxx?format=jpg&name=large'
      const output = toOriginalImageUrl(input)
      expect(output).toContain('name=orig')
      expect(output).toContain('format=jpg')
    })

    it('对没有 name 参数的 twimg 图片追加 name=orig', () => {
      const input = 'https://pbs.twimg.com/media/GfXxxxx?format=png'
      const output = toOriginalImageUrl(input)
      expect(output).toBe('https://pbs.twimg.com/media/GfXxxxx?format=png&name=orig')
    })

    it('非 twimg 域名的图片 URL 保持原样', () => {
      const input = 'https://example.com/images/cat.jpg?size=medium'
      expect(toOriginalImageUrl(input)).toBe(input)
    })

    it('空字符串或无效输入安全返回空串', () => {
      expect(toOriginalImageUrl('')).toBe('')
      expect(toOriginalImageUrl(null as any)).toBe('')
    })
  })

  describe('generateMediaFilename 命名规范', () => {
    it('生成符合规范的文件名（包含序号）', () => {
      const name = generateMediaFilename('elonmusk', '1899999999999999999', 'jpg', 1)
      expect(name).toBe('x_elonmusk_1899999999999999999_1.jpg')
    })

    it('单个媒体不传序号时不含下划线序号后缀', () => {
      const name = generateMediaFilename('test_user', '123456', 'mp4')
      expect(name).toBe('x_test_user_123456.mp4')
    })

    it('自动过滤作者名与推文 ID 中的特殊符号及拓展名点号', () => {
      const name = generateMediaFilename('@bad-name!', 'id#1234', '.PNG', 0)
      expect(name).toBe('x_badname_1234_0.png')
    })

    it('缺失作者或推文 ID 时提供合理默认兜底', () => {
      const name = generateMediaFilename(null, null, 'jpg')
      expect(name).toMatch(/^x_user_\d+\.jpg$/)
    })
  })

  describe('extractTweetMediaFromGraphql 从 GraphQL 响应解析媒体', () => {
    it('正确解析包含多图、视频及 GIF 的推文并选出最高码率 MP4', () => {
      const mockPayload = {
        data: {
          tweetResult: {
            result: {
              __typename: 'Tweet',
              rest_id: '1234567890',
              core: {
                user_results: {
                  result: {
                    core: {
                      screen_name: 'test_creator',
                    },
                  },
                },
              },
              legacy: {
                extended_entities: {
                  media: [
                    {
                      id_str: 'img1',
                      type: 'photo',
                      media_url_https: 'https://pbs.twimg.com/media/photo1.jpg',
                      original_info: { width: 1920, height: 1080 },
                    },
                    {
                      id_str: 'img2',
                      type: 'photo',
                      media_url_https: 'https://pbs.twimg.com/media/photo2.jpg',
                      original_info: { width: 800, height: 600 },
                    },
                    {
                      id_str: 'vid1',
                      type: 'video',
                      media_url_https: 'https://pbs.twimg.com/video/thumb.jpg',
                      video_info: {
                        variants: [
                          { bitrate: 256000, content_type: 'video/mp4', url: 'https://video.twimg.com/low.mp4' },
                          { bitrate: 2176000, content_type: 'video/mp4', url: 'https://video.twimg.com/high.mp4' },
                          { bitrate: 832000, content_type: 'video/mp4', url: 'https://video.twimg.com/med.mp4' },
                          { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/master.m3u8' },
                        ],
                      },
                    },
                    {
                      id_str: 'gif1',
                      type: 'animated_gif',
                      media_url_https: 'https://pbs.twimg.com/gif/thumb.jpg',
                      video_info: {
                        variants: [
                          { bitrate: 0, content_type: 'video/mp4', url: 'https://video.twimg.com/gif.mp4' },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      }

      const res = extractTweetMediaFromGraphql(mockPayload)
      expect(res).not.toBeNull()
      expect(res?.tweetId).toBe('1234567890')
      expect(res?.authorHandle).toBe('test_creator')
      expect(res?.photos.length).toBe(2)
      expect(res?.photos[0].origUrl).toContain('name=orig')

      expect(res?.videos.length).toBe(1)
      expect(res?.videos[0].bestMp4Url).toBe('https://video.twimg.com/high.mp4')
      expect(res?.videos[0].bitrate).toBe(2176000)

      expect(res?.gifs.length).toBe(1)
      expect(res?.gifs[0].bestMp4Url).toBe('https://video.twimg.com/gif.mp4')
    })

    it('正确解包 TweetWithVisibilityResults 嵌套结构', () => {
      const mockWrapped = {
        data: {
          tweetResult: {
            result: {
              __typename: 'TweetWithVisibilityResults',
              tweet: {
                rest_id: '998877',
                core: {
                  user_results: {
                    result: {
                      legacy: { screen_name: 'wrapped_user' },
                    },
                  },
                },
                legacy: {
                  extended_entities: {
                    media: [
                      {
                        id_str: 'p1',
                        type: 'photo',
                        media_url_https: 'https://pbs.twimg.com/media/single.jpg',
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      }

      const res = extractTweetMediaFromGraphql(mockWrapped)
      expect(res?.tweetId).toBe('998877')
      expect(res?.authorHandle).toBe('wrapped_user')
      expect(res?.photos.length).toBe(1)
    })

    it('当传入 targetTweetId 不匹配时返回 null', () => {
      const mockPayload = {
        data: {
          tweetResult: {
            result: {
              rest_id: '111',
              legacy: {},
            },
          },
        },
      }
      expect(extractTweetMediaFromGraphql(mockPayload, '999')).toBeNull()
    })
  })

  describe('extractTweetInfoFromDom 从 DOM 节点嗅探媒体', () => {
    let dom: JSDOM

    beforeEach(() => {
      dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`)
    })

    it('正确提取 DOM 中的推文 ID、作者、图片及视频', () => {
      const container = dom.window.document.createElement('article')
      container.innerHTML = `
        <div data-testid="User-Name">
          <span>Display Name</span>
          <span>@tech_insider</span>
        </div>
        <div>
          <a href="/tech_insider/status/1888888888888888888">2 小时前</a>
        </div>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/media/photo_a.jpg?format=jpg&name=medium" />
        </div>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/media/photo_b.jpg?format=png&name=small" />
        </div>
        <div data-testid="videoPlayer">
          <video src="blob:https://x.com/fake-stream"></video>
        </div>
      `
      const info = extractTweetInfoFromDom(container as unknown as HTMLElement)
      expect(info.tweetId).toBe('1888888888888888888')
      expect(info.authorHandle).toBe('tech_insider')
      expect(info.hasVideo).toBe(true)
      expect(info.photos.length).toBe(2)
      expect(info.photos[0].origUrl).toContain('name=orig')
      expect(info.photos[1].origUrl).toContain('name=orig')
    })

    it('详情页无直接时间链接时通过 currentHref 兜底推文 ID', () => {
      const container = dom.window.document.createElement('article')
      container.innerHTML = `
        <div data-testid="User-Name">
          <span>@detail_author</span>
        </div>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/media/solo.jpg?format=jpg" />
        </div>
      `
      const info = extractTweetInfoFromDom(
        container as unknown as HTMLElement,
        'https://x.com/detail_author/status/1777777777777777777'
      )
      expect(info.tweetId).toBe('1777777777777777777')
      expect(info.authorHandle).toBe('detail_author')
      expect(info.photos.length).toBe(1)
    })

    it('自动过滤头像图片 (profile_images) 和 emoji 图片', () => {
      const container = dom.window.document.createElement('article')
      container.innerHTML = `
        <a href="/test/status/123">link</a>
        <img src="https://pbs.twimg.com/profile_images/123/avatar.jpg" />
        <img src="https://abs-0.twimg.com/emoji/v2/svg/1f525.svg" />
        <img src="https://pbs.twimg.com/media/real_post.jpg?name=large" />
      `
      const info = extractTweetInfoFromDom(container as unknown as HTMLElement)
      expect(info.photos.length).toBe(1)
      expect(info.photos[0].url).toContain('real_post.jpg')
    })

    it('当 tweetPhoto 包裹视频播放器时排除封面缩略图，不误判为普通照片', () => {
      const container = dom.window.document.createElement('article')
      container.innerHTML = `
        <a href="/xuanyuanfamai/status/2113171130613899750">2026-10-22</a>
        <div data-testid="tweetPhoto">
          <div data-testid="videoPlayer">
            <div data-testid="videoComponent">
              <img src="https://pbs.twimg.com/amplify_video_thumb/2113171087345504256/img/qUj70NOcxhcjW1D0.jpg" />
              <video src="blob:https://x.com/fake-stream"></video>
            </div>
          </div>
        </div>
      `
      const info = extractTweetInfoFromDom(container as unknown as HTMLElement)
      expect(info.tweetId).toBe('2113171130613899750')
      expect(info.authorHandle).toBe('xuanyuanfamai')
      expect(info.hasVideo).toBe(true)
      expect(info.photos.length).toBe(0)
    })
  })

  describe('harvestAllTweetMediaFromGraphql 深度多推文媒体提取', () => {
    it('正确从包含 instructions 的复杂时间线/详情树中提取推文视频与照片', () => {
      const complexTimelinePayload = {
        data: {
          threaded_conversation_with_injections_v2: {
            instructions: [
              {
                type: 'TimelineAddEntries',
                entries: [
                  {
                    entryId: 'tweet-2113171130613899750',
                    content: {
                      itemContent: {
                        tweet_results: {
                          result: {
                            __typename: 'Tweet',
                            rest_id: '2113171130613899750',
                            core: {
                              user_results: {
                                result: {
                                  core: { screen_name: 'xuanyuanfamai' },
                                },
                              },
                            },
                            legacy: {
                              extended_entities: {
                                media: [
                                  {
                                    id_str: 'vid_999',
                                    type: 'video',
                                    media_url_https: 'https://pbs.twimg.com/thumb.jpg',
                                    video_info: {
                                      variants: [
                                        { bitrate: 632000, content_type: 'video/mp4', url: 'https://video.twimg.com/low.mp4' },
                                        { bitrate: 2176000, content_type: 'video/mp4', url: 'https://video.twimg.com/best_1080p.mp4' },
                                      ],
                                    },
                                  },
                                ],
                              },
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
      }

      const harvested = harvestAllTweetMediaFromGraphql(complexTimelinePayload)
      expect(harvested.length).toBe(1)
      expect(harvested[0].tweetId).toBe('2113171130613899750')
      expect(harvested[0].authorHandle).toBe('xuanyuanfamai')
      expect(harvested[0].videos.length).toBe(1)
      expect(harvested[0].videos[0].bestMp4Url).toBe('https://video.twimg.com/best_1080p.mp4')
    })
  })

  describe('adjustButtonPositionForControls 敏感内容控制按钮避让', () => {
    let dom: JSDOM

    beforeEach(() => {
      dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`)
    })

    it('当推文右上角存在「隐藏」按钮时，悬浮下载按钮自动向左平移避让', () => {
      const tweet = dom.window.document.createElement('article')
      tweet.setAttribute('data-testid', 'tweet')
      const media = dom.window.document.createElement('div')
      media.setAttribute('data-testid', 'videoPlayer')
      const btn = dom.window.document.createElement('button')
      btn.className = 'xf-media-hover-btn'

      const hideBtn = dom.window.document.createElement('button')
      hideBtn.innerHTML = '<span>隐藏</span>'

      tweet.appendChild(media)
      tweet.appendChild(hideBtn)
      media.appendChild(btn)

      // Mock bounding rects in JSDOM
      media.getBoundingClientRect = () => ({
        top: 100,
        right: 500,
        bottom: 400,
        left: 200,
        width: 300,
        height: 300,
        x: 200,
        y: 100,
        toJSON: () => {},
      })

      hideBtn.getBoundingClientRect = () => ({
        top: 110,
        right: 485,
        bottom: 142,
        left: 425,
        width: 60,
        height: 32,
        x: 425,
        y: 110,
        toJSON: () => {},
      })

      btn.getBoundingClientRect = () => ({
        top: 108,
        right: 492,
        bottom: 140,
        left: 460,
        width: 32,
        height: 32,
        x: 460,
        y: 108,
        toJSON: () => {},
      })

      adjustButtonPositionForControls(media, btn)

      expect(btn.classList.contains('xf-shift-left')).toBe(true)
      // right offset should be >= 86px
      const rightVal = parseInt(btn.style.getPropertyValue('right'), 10)
      expect(rightVal).toBeGreaterThanOrEqual(85)
    })

    it('当推文右上角不存在遮罩按钮时，恢复标准右上角位置', () => {
      const tweet = dom.window.document.createElement('article')
      tweet.setAttribute('data-testid', 'tweet')
      const media = dom.window.document.createElement('div')
      media.setAttribute('data-testid', 'videoPlayer')
      const btn = dom.window.document.createElement('button')
      btn.className = 'xf-media-hover-btn xf-shift-left'
      btn.style.setProperty('right', '86px', 'important')

      tweet.appendChild(media)
      media.appendChild(btn)

      media.getBoundingClientRect = () => ({
        top: 100,
        right: 500,
        bottom: 400,
        left: 200,
        width: 300,
        height: 300,
        x: 200,
        y: 100,
        toJSON: () => {},
      })

      btn.getBoundingClientRect = () => ({
        top: 108,
        right: 414,
        bottom: 140,
        left: 382,
        width: 32,
        height: 32,
        x: 382,
        y: 108,
        toJSON: () => {},
      })

      adjustButtonPositionForControls(media, btn)

      expect(btn.classList.contains('xf-shift-left')).toBe(false)
      expect(btn.style.getPropertyValue('right')).toBe('')
    })
  })
})
