/**
 * 推文媒体一键下载特性
 * 1. 单张悬浮下载：鼠标悬停在单张图片或视频右上角展示微型下载按钮
 * 2. 整推批量下载：推文分享/更多菜单注入「下载全部图片 / 下载高清视频」选项
 * 3. 双层闭环反馈：就地图标 Spinner/对勾 + 右上角微型 Toast 胶囊通知（严禁 emoji，纯现代矢量 SVG）
 */

import {
  extractTweetInfoFromDom,
  generateMediaFilename,
  toOriginalImageUrl,
  type ExtractedTweetMedia,
} from '../../shared/tweet-media'
import { KeyMediaDownloadEnabled } from '../../storage-keys'
import { getStorage } from '../utilities/storage'
import addStyles, { stylesExist } from '../utilities/addStyles'

// ── 矢量 SVG 图标定义（对齐 X 官方极简线条与填充风格，绝不使用 Emoji） ───────────

const ICON_DOWNLOAD = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3v12M6.5 10.5l5.5 5.5 5.5-5.5M4 17.5v2A2 2 0 0 0 6 21.5h12a2 2 0 0 0 2-2v-2"></path>
</svg>
`

const ICON_SPIN = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="xf-media-spin">
  <circle cx="12" cy="12" r="9" stroke-opacity="0.25"></circle>
  <path d="M12 3a9 9 0 0 1 9 9" stroke-linecap="round"></path>
</svg>
`

const ICON_CHECK = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 6L9 17l-5-5"></path>
</svg>
`

const ICON_ALERT = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="12" y1="8" x2="12" y2="12"></line>
  <line x1="12" y1="16" x2="12.01" y2="16"></line>
</svg>
`

const MENU_DOWNLOAD_ICON = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 12px; flex-shrink: 0;">
  <path d="M12 3v12M6.5 10.5l5.5 5.5 5.5-5.5M4 17.5v2A2 2 0 0 0 6 21.5h12a2 2 0 0 0 2-2v-2"></path>
</svg>
`

// ── 样式表注入 ────────────────────────────────────────────────────────────────

function ensureMediaDownloadStyles() {
  if (stylesExist('mediaDownloadStyles')) return

  addStyles(
    'mediaDownloadStyles',
    `
    @keyframes xf-media-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .xf-media-spin {
      animation: xf-media-spin 0.75s linear infinite !important;
    }

    /* 单张媒体右上角浮动下载按钮 */
    .xf-media-hover-btn {
      position: absolute !important;
      top: 8px !important;
      right: 8px !important;
      z-index: 10 !important;
      width: 32px !important;
      height: 32px !important;
      border-radius: 9999px !important;
      background: rgba(0, 0, 0, 0.35) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      color: #ffffff !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      opacity: 0 !important;
      transform: scale(0.92) !important;
      transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease, border-color 0.15s ease !important;
      pointer-events: auto !important;
      padding: 0 !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
      user-select: none !important;
    }

    div[data-testid="tweetPhoto"]:hover .xf-media-hover-btn,
    div[data-testid="videoPlayer"]:hover .xf-media-hover-btn,
    div[data-testid="videoComponent"]:hover .xf-media-hover-btn {
      opacity: 1 !important;
      transform: scale(1) !important;
    }

    /* 严防 DOM 重叠：若 tweetPhoto 包装了视频播放器，立刻强制隐藏图片按钮并禁用点击 */
    div[data-testid="tweetPhoto"]:has(video, [data-testid="videoPlayer"], [data-testid="videoComponent"]) > .xf-media-hover-btn {
      display: none !important;
      pointer-events: none !important;
    }

    /* 当媒体存在原生遮罩控制（如敏感内容「隐藏」按钮）时，平滑左移避让，防止点击遮挡与重叠 */
    .xf-media-hover-btn.xf-shift-left {
      top: 12px !important;
      right: 86px !important;
    }

    .xf-media-hover-btn:hover {
      background: rgba(0, 0, 0, 0.55) !important;
      border-color: rgba(255, 255, 255, 0.45) !important;
      transform: scale(1.08) !important;
    }

    .xf-media-hover-btn:active {
      transform: scale(0.95) !important;
    }

    .xf-media-hover-btn.xf-loading {
      opacity: 1 !important;
      cursor: default !important;
      pointer-events: none !important;
      border-color: rgba(29, 155, 240, 0.6) !important;
      color: rgb(29, 155, 240) !important;
      background: rgba(0, 0, 0, 0.5) !important;
    }

    .xf-media-hover-btn.xf-success {
      opacity: 1 !important;
      color: #10b981 !important;
      border-color: rgba(16, 185, 129, 0.6) !important;
      background: rgba(0, 0, 0, 0.5) !important;
    }

    /* 右上角 Toast 提示容器与胶囊 */
    #xf-media-toast-container {
      position: fixed !important;
      top: 18px !important;
      right: 18px !important;
      z-index: 999999 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-end !important;
      gap: 8px !important;
      pointer-events: none !important;
    }

    .xf-media-toast-capsule {
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      background: rgba(15, 20, 25, 0.92) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      border-radius: 9999px !important;
      padding: 7px 14px !important;
      color: #f7f9f9 !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35) !important;
      pointer-events: auto !important;
      opacity: 0 !important;
      transform: translateY(-8px) scale(0.96) !important;
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
      max-width: 380px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    .xf-media-toast-capsule.xf-show {
      opacity: 1 !important;
      transform: translateY(0) scale(1) !important;
    }

    .xf-media-menu-item:hover {
      background-color: var(--x-hover-subtle, rgba(127, 127, 127, 0.08)) !important;
    }
    `,
  )
}

// ── 右上角微型 Toast 胶囊通知控制器 ──────────────────────────────────────────

export interface ToastController {
  update: (text: string, type?: 'loading' | 'success' | 'error') => void
  dismiss: (delayMs?: number) => void
}

export function showMediaToast(
  initialText: string,
  initialType: 'loading' | 'success' | 'error' = 'loading',
): ToastController {
  ensureMediaDownloadStyles()

  let container = document.getElementById('xf-media-toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'xf-media-toast-container'
    document.body.appendChild(container)
  }

  const capsule = document.createElement('div')
  capsule.className = 'xf-media-toast-capsule'

  const iconSpan = document.createElement('span')
  iconSpan.style.display = 'inline-flex'
  iconSpan.style.alignItems = 'center'
  iconSpan.style.justifyContent = 'center'
  iconSpan.style.flexShrink = '0'

  const textSpan = document.createElement('span')
  textSpan.style.overflow = 'hidden'
  textSpan.style.textOverflow = 'ellipsis'

  capsule.appendChild(iconSpan)
  capsule.appendChild(textSpan)
  container.appendChild(capsule)

  const renderContent = (text: string, type: 'loading' | 'success' | 'error') => {
    textSpan.textContent = text
    if (type === 'loading') {
      iconSpan.innerHTML = ICON_SPIN
      capsule.style.borderColor = 'rgba(29, 155, 240, 0.4)'
    } else if (type === 'success') {
      iconSpan.innerHTML = ICON_CHECK
      capsule.style.borderColor = 'rgba(16, 185, 129, 0.4)'
    } else {
      iconSpan.innerHTML = ICON_ALERT
      capsule.style.borderColor = 'rgba(239, 68, 68, 0.4)'
    }
  }

  renderContent(initialText, initialType)

  // 触发渐入动画
  requestAnimationFrame(() => {
    capsule.classList.add('xf-show')
  })

  let dismissTimer: ReturnType<typeof setTimeout> | null = null

  const dismiss = (delayMs = 0) => {
    if (dismissTimer) clearTimeout(dismissTimer)
    dismissTimer = setTimeout(() => {
      capsule.classList.remove('xf-show')
      setTimeout(() => {
        capsule.remove()
        if (container && container.children.length === 0) {
          container.remove()
        }
      }, 250)
    }, delayMs)
  }

  if (initialType === 'success') dismiss(2500)
  if (initialType === 'error') dismiss(3500)

  return {
    update: (text, type = 'loading') => {
      renderContent(text, type)
      if (type === 'success') dismiss(2500)
      if (type === 'error') dismiss(3500)
    },
    dismiss,
  }
}

// ── 媒体解析辅助（优先利用 MAIN world 拦截器捕获的缓存，极速秒开） ───────────

async function resolveTweetMedia(tweetId: string): Promise<ExtractedTweetMedia | null> {
  // 1. 优先尝试从 MAIN world 拦截器写入的 sessionStorage 提取
  try {
    const raw = sessionStorage.getItem(`xf_media_${tweetId}`)
    if (raw) {
      const parsed = JSON.parse(raw) as ExtractedTweetMedia
      if (parsed && (parsed.videos?.length || parsed.gifs?.length || parsed.photos?.length)) {
        return parsed
      }
    }
  } catch {}

  // 2. 缓存未命中时走后台拉取（具备多 Query ID 轮询与 TweetDetail 兜底）
  try {
    const res = await browser.runtime.sendMessage({
      type: 'XF_GET_TWEET_MEDIA',
      tweetId,
    })
    return (res?.media as ExtractedTweetMedia) || null
  } catch {
    return null
  }
}

// ── 智能避让：检测右上角控制按钮（如敏感内容「隐藏」按钮） ────────────────────────

export function adjustButtonPositionForControls(mediaContainer: HTMLElement, btn: HTMLElement): void {
  const tweet = mediaContainer.closest('article[data-testid="tweet"]')
  const searchRoot = tweet || mediaContainer.parentElement || mediaContainer

  const mRect = mediaContainer.getBoundingClientRect()
  const buttons = Array.from(searchRoot.querySelectorAll<HTMLElement>('button, [role="button"]'))

  let collidingBtn: HTMLElement | null = null
  for (const b of buttons) {
    if (b === btn || b.classList.contains('xf-media-hover-btn')) continue
    // 严格排除底部静音/音量控件
    if (b.getAttribute('data-testid')?.includes('mute')) continue

    const bRect = b.getBoundingClientRect()
    if (bRect.width === 0 || bRect.height === 0) continue

    // 遮罩控制按钮必须位于媒体容器顶部（距顶部绝对值在 35px 以内）
    if (Math.abs(bRect.top - mRect.top) > 35) continue

    const text = b.textContent?.trim()
    const isHideText =
      text === '隐藏' ||
      text === 'Hide' ||
      b.getAttribute('aria-label') === '隐藏' ||
      b.getAttribute('aria-label') === 'Hide'

    // 水平位于容器右侧 150px 区域内
    const isTopRight =
      bRect.right <= mRect.right + 25 &&
      bRect.left >= mRect.right - 150

    if (isHideText || isTopRight) {
      collidingBtn = b
      break
    }
  }

  if (collidingBtn) {
    const bRect = collidingBtn.getBoundingClientRect()
    // 遮罩按钮宽度 + 距右边缘距离 + 10px 呼吸间距
    const rightOffset = Math.max(86, Math.round(mRect.right - bRect.left + 10))
    const topOffset = Math.max(8, Math.round(bRect.top - mRect.top))
    btn.classList.add('xf-shift-left')
    btn.style.setProperty('right', `${rightOffset}px`, 'important')
    btn.style.setProperty('top', `${topOffset}px`, 'important')
  } else {
    btn.classList.remove('xf-shift-left')
    btn.style.removeProperty('right')
    btn.style.removeProperty('top')
  }
}

// ── 单张图片/单视频悬浮下载按钮挂载 ──────────────────────────────────────────

/**
 * 遍历推文内的媒体容器，注入右上角浮动下载按钮
 */
export async function injectMediaHoverButtons(root: Element = document.body): Promise<void> {
  const enabled = (await getStorage(KeyMediaDownloadEnabled)) !== 'off'
  if (!enabled) {
    removeMediaHoverButtons()
    return
  }

  ensureMediaDownloadStyles()

  // 0. 主动清理：任何内部包含视频播放器/组件/video 标签的 tweetPhoto，立即拔除其直接挂载的图片下载按钮
  root.querySelectorAll<HTMLElement>('div[data-testid="tweetPhoto"]').forEach((p) => {
    if (p.querySelector('video, [data-testid="videoPlayer"], [data-testid="videoComponent"]')) {
      p.querySelectorAll(':scope > .xf-media-hover-btn').forEach((b) => b.remove())
    }
  })

  // 1. 照片容器：div[data-testid="tweetPhoto"]
  const photos = Array.from(root.querySelectorAll<HTMLElement>('div[data-testid="tweetPhoto"]'))
  photos.forEach((photoContainer) => {
    // 关键排查：如果照片容器内包含视频元素或其自身/外层是视频播放器，绝不挂载图片下载按钮！
    if (
      photoContainer.querySelector('video, [data-testid="videoPlayer"], [data-testid="videoComponent"]') ||
      photoContainer.closest('[data-testid="videoPlayer"], [data-testid="videoComponent"]')
    ) {
      return
    }

    if (photoContainer.querySelector('.xf-media-hover-btn')) return

    // 确保父容器具备相对定位
    const computedPosition = window.getComputedStyle(photoContainer).position
    if (!computedPosition || computedPosition === 'static') {
      photoContainer.style.position = 'relative'
    }

    const btn = document.createElement('button')
    btn.className = 'xf-media-hover-btn'
    btn.setAttribute('aria-label', '下载原图')
    btn.setAttribute('title', '下载原图 (最高画质)')
    btn.innerHTML = ICON_DOWNLOAD

    btn.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()

      // 提取图片直链
      const img = photoContainer.querySelector<HTMLImageElement>('img[src*="pbs.twimg.com/media/"], img')
      const rawSrc = img?.currentSrc || img?.src || ''
      if (!rawSrc) {
        showMediaToast('未找到有效图片链接', 'error')
        return
      }

      const origUrl = toOriginalImageUrl(rawSrc)
      const tweetEl = photoContainer.closest<HTMLElement>('article[data-testid="tweet"]')
      const info = tweetEl ? extractTweetInfoFromDom(tweetEl) : null

      // 计算该图片在多图中的次序（1-based）
      let photoIndex: number | undefined
      if (tweetEl) {
        const allPhotos = Array.from(tweetEl.querySelectorAll('div[data-testid="tweetPhoto"]')).filter(
          (c) => !c.querySelector('video, [data-testid="videoPlayer"], [data-testid="videoComponent"]'),
        )
        if (allPhotos.length > 1) {
          const idx = allPhotos.indexOf(photoContainer)
          if (idx !== -1) photoIndex = idx + 1
        }
      }

      // 就地图标 Loading 反馈
      btn.classList.add('xf-loading')
      btn.innerHTML = ICON_SPIN

      // 右上角 Toast 提示
      const toast = showMediaToast('正在下载原图...', 'loading')

      const filename = generateMediaFilename(info?.authorHandle, info?.tweetId, 'jpg', photoIndex)

      try {
        const res = await browser.runtime.sendMessage({
          type: 'XF_DOWNLOAD_MEDIA',
          url: origUrl,
          filename,
        })

        if (res && res.ok) {
          btn.classList.remove('xf-loading')
          btn.classList.add('xf-success')
          btn.innerHTML = ICON_CHECK
          toast.update(`已下载: ${filename}`, 'success')
          setTimeout(() => {
            btn.classList.remove('xf-success')
            btn.innerHTML = ICON_DOWNLOAD
          }, 1500)
        } else {
          throw new Error(res?.error || '下载失败')
        }
      } catch (err) {
        btn.classList.remove('xf-loading')
        btn.innerHTML = ICON_DOWNLOAD
        toast.update('下载原图失败，请重试', 'error')
      }
    })

    photoContainer.appendChild(btn)
    adjustButtonPositionForControls(photoContainer, btn)
    photoContainer.addEventListener('mouseenter', () => adjustButtonPositionForControls(photoContainer, btn))
  })

  // 2. 视频与 GIF 容器：仅注入最外层的视频播放容器，杜绝子容器重复注入
  const videos = Array.from(
    root.querySelectorAll<HTMLElement>(
      'div[data-testid="videoPlayer"], div[data-testid="videoComponent"]:not([data-testid="videoPlayer"] *)',
    ),
  )
  videos.forEach((videoContainer) => {
    // 销毁所有可能存在的父级 tweetPhoto 上残留的图片下载按钮
    const parentPhoto = videoContainer.closest('div[data-testid="tweetPhoto"]')
    if (parentPhoto) {
      parentPhoto.querySelectorAll(':scope > .xf-media-hover-btn').forEach((b) => b.remove())
    }

    // 若当前容器是某个已有 videoPlayer 的子元素，或者已经挂载了按钮，直接跳过
    if (
      videoContainer.querySelector('.xf-media-hover-btn') ||
      videoContainer.parentElement?.closest('[data-testid="videoPlayer"]')?.querySelector('.xf-media-hover-btn')
    ) {
      return
    }

    const computedPosition = window.getComputedStyle(videoContainer).position
    if (!computedPosition || computedPosition === 'static') {
      videoContainer.style.position = 'relative'
    }

    const btn = document.createElement('button')
    btn.className = 'xf-media-hover-btn'
    btn.setAttribute('aria-label', '下载高清视频')
    btn.setAttribute('title', '下载高清视频 (最高码率 MP4)')
    btn.innerHTML = ICON_DOWNLOAD

    btn.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()

      const tweetEl = videoContainer.closest<HTMLElement>('article[data-testid="tweet"]')
      const info = tweetEl ? extractTweetInfoFromDom(tweetEl) : null

      if (!info?.tweetId) {
        showMediaToast('未识别到推文 ID', 'error')
        return
      }

      // 就地图标 Loading 反馈
      btn.classList.add('xf-loading')
      btn.innerHTML = ICON_SPIN

      // 右上角 Toast
      const toast = showMediaToast('正在解析最高画质视频流...', 'loading')

      try {
        // 请求解析推文媒体数据（拦截缓存优先，GraphQL 轮询兜底）
        const media = await resolveTweetMedia(info.tweetId)
        const videoItem = media?.videos?.[0] || media?.gifs?.[0]
        const mp4Url = videoItem?.bestMp4Url

        if (!mp4Url) {
          throw new Error('未解析到有效 MP4 视频直链')
        }

        const isGif = videoItem.type === 'animated_gif'
        toast.update(isGif ? '正在下载 GIF 动图...' : '正在下载 1080P/720P 高清视频...', 'loading')

        const filename = generateMediaFilename(info.authorHandle, info.tweetId, 'mp4')

        const downloadRes = await browser.runtime.sendMessage({
          type: 'XF_DOWNLOAD_MEDIA',
          url: mp4Url,
          filename,
        })

        if (downloadRes && downloadRes.ok) {
          btn.classList.remove('xf-loading')
          btn.classList.add('xf-success')
          btn.innerHTML = ICON_CHECK
          toast.update(`已保存: ${filename}`, 'success')
          setTimeout(() => {
            btn.classList.remove('xf-success')
            btn.innerHTML = ICON_DOWNLOAD
          }, 1500)
        } else {
          throw new Error(downloadRes?.error || '下载失败')
        }
      } catch (err: any) {
        btn.classList.remove('xf-loading')
        btn.innerHTML = ICON_DOWNLOAD
        toast.update(err?.message || '下载视频失败，请重试', 'error')
      }
    })

    videoContainer.appendChild(btn)
    adjustButtonPositionForControls(videoContainer, btn)
    videoContainer.addEventListener('mouseenter', () => adjustButtonPositionForControls(videoContainer, btn))
  })
}

export function removeMediaHoverButtons() {
  document.querySelectorAll('.xf-media-hover-btn').forEach((el) => el.remove())
}

// ── 推文分享 / 更多下拉菜单注入「整推下载」选项 ─────────────────────────────

let lastClickedShareTweet: HTMLElement | null = null

/**
 * 监听用户在推文底部点击「分享」或「更多」按钮，精准记住对应的推文卡片
 */
export function trackShareButtonClick(): void {
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const actionBtn = target.closest(
        '[data-testid="shareTweet"], [data-testid="tweetButtonInline"], [data-testid="caret"], [data-testid="Dropdown"]',
      )
      if (actionBtn) {
        const article = actionBtn.closest<HTMLElement>('article[data-testid="tweet"]')
        if (article) {
          lastClickedShareTweet = article
        }
      }
    },
    true,
  )
}

/**
 * 扫描当前页面上的弹出菜单（Dropdown / role="menu"），并追加整推媒体下载选项
 */
export async function enhanceTweetMediaMenu(dropdown: Element): Promise<void> {
  const enabled = (await getStorage(KeyMediaDownloadEnabled)) !== 'off'
  if (!enabled) return

  if (dropdown.querySelector('.xf-media-menu-item')) return

  // 1. 确定目标推文
  let tweet = lastClickedShareTweet
  if (!tweet || !tweet.isConnected) {
    if (window.location.pathname.includes('/status/')) {
      tweet = document.querySelector<HTMLElement>('article[data-testid="tweet"]')
    }
  }
  if (!tweet) return

  const info = extractTweetInfoFromDom(tweet)
  const hasPhotos = Array.isArray(info.photos) && info.photos.length > 0
  if (!info.hasVideo && !info.hasGif && !hasPhotos) return

  const menuItems = Array.from(dropdown.querySelectorAll<HTMLElement>("div[role='menuitem']"))
  if (menuItems.length === 0) return
  const template = menuItems[menuItems.length - 1]

  ensureMediaDownloadStyles()

  // 2. 如果包含视频且菜单尚无原生下载选项
  if (info.hasVideo) {
    const videoOption = createMenuItemNode(template, '下载高清视频 (MP4)', async () => {
      const toast = showMediaToast('正在解析最高画质视频流...', 'loading')
      try {
        const media = await resolveTweetMedia(info.tweetId || '')
        const videoItem = media?.videos?.[0] || media?.gifs?.[0]
        const mp4Url = videoItem?.bestMp4Url
        if (!mp4Url) throw new Error('未解析到视频链接')

        toast.update('正在下载 1080P/720P 高清视频...', 'loading')
        const filename = generateMediaFilename(info.authorHandle, info.tweetId, 'mp4')
        const dRes = await browser.runtime.sendMessage({
          type: 'XF_DOWNLOAD_MEDIA',
          url: mp4Url,
          filename,
        })
        if (dRes && dRes.ok) {
          toast.update(`下载成功: ${filename}`, 'success')
        } else {
          throw new Error('下载失败')
        }
      } catch (err: any) {
        toast.update(err?.message || '下载视频失败', 'error')
      }
    })
    dropdown.appendChild(videoOption)
  }

  // 3. 如果包含多张图片：提供「下载全部图片」
  if (hasPhotos) {
    const count = info.photos.length
    const label = count > 1 ? `下载全部图片 (共 ${count} 张)` : '下载原图'
    const photoOption = createMenuItemNode(template, label, async () => {
      const toast = showMediaToast(count > 1 ? `正在下载 ${count} 张原图...` : '正在下载原图...', 'loading')
      let successCount = 0

      for (let i = 0; i < info.photos.length; i++) {
        const p = info.photos[i]
        const filename = generateMediaFilename(info.authorHandle, info.tweetId, 'jpg', count > 1 ? i + 1 : undefined)
        try {
          const dRes = await browser.runtime.sendMessage({
            type: 'XF_DOWNLOAD_MEDIA',
            url: p.origUrl,
            filename,
          })
          if (dRes && dRes.ok) successCount++
        } catch {}
        // 错开 150ms 避免浏览器拦截批量下载
        if (i < info.photos.length - 1) {
          await new Promise((r) => setTimeout(r, 150))
        }
      }

      if (successCount === count) {
        toast.update(count > 1 ? `全部 ${count} 张原图下载完成` : '原图下载完成', 'success')
      } else if (successCount > 0) {
        toast.update(`已下载 ${successCount}/${count} 张图片`, 'success')
      } else {
        toast.update('图片下载失败，请重试', 'error')
      }
    })
    dropdown.appendChild(photoOption)
  }

  // 4. 如果包含 GIF
  if (info.hasGif && !info.hasVideo) {
    const gifOption = createMenuItemNode(template, '下载 GIF 动图', async () => {
      const toast = showMediaToast('正在解析 GIF 资源...', 'loading')
      try {
        const media = await resolveTweetMedia(info.tweetId || '')
        const gifItem = media?.gifs?.[0]
        const mp4Url = gifItem?.bestMp4Url || gifItem?.url
        if (!mp4Url) throw new Error('未解析到动图直链')

        const filename = generateMediaFilename(info.authorHandle, info.tweetId, 'mp4')
        const dRes = await browser.runtime.sendMessage({
          type: 'XF_DOWNLOAD_MEDIA',
          url: mp4Url,
          filename,
        })
        if (dRes && dRes.ok) {
          toast.update(`动图已保存: ${filename}`, 'success')
        } else {
          throw new Error('下载动图失败')
        }
      } catch (err: any) {
        toast.update(err?.message || '下载 GIF 失败', 'error')
      }
    })
    dropdown.appendChild(gifOption)
  }
}

/**
 * 克隆 X 原生菜单项并组装极简无损样式
 */
function createMenuItemNode(template: HTMLElement, label: string, onClick: () => Promise<void>): HTMLElement {
  const node = template.cloneNode(true) as HTMLElement
  node.classList.add('xf-media-menu-item')
  node.style.cursor = 'pointer'
  node.style.userSelect = 'none'

  // 清除原生标识
  node.removeAttribute('id')
  node.removeAttribute('data-testid')
  node.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('id')
    el.removeAttribute('data-testid')
  })

  // 寻找图标与文字容器
  const svg = node.querySelector('svg')
  if (svg) {
    svg.outerHTML = MENU_DOWNLOAD_ICON
  }

  // 寻找放置文案的最深层有文字的节点
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (!(node instanceof Element)) return NodeFilter.FILTER_SKIP
      const el = node
      if (el.tagName.toLowerCase() === 'svg' || el.closest('svg')) return NodeFilter.FILTER_REJECT
      if (el.children.length === 0 && el.textContent?.trim()) return NodeFilter.FILTER_ACCEPT
      return NodeFilter.FILTER_SKIP
    },
  })
  const textLeaf = walker.nextNode() as HTMLElement | null
  if (textLeaf) {
    textLeaf.textContent = label
  } else {
    // 兜底重构内部
    node.innerHTML = `
      <div style="display: flex; align-items: center; width: 100%; padding: 12px 16px; font-weight: 600; font-size: 14px; color: inherit;">
        ${MENU_DOWNLOAD_ICON}
        <span>${label}</span>
      </div>
    `
  }

  node.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    // 关闭原生下拉菜单
    document.body.click()
    void onClick()
  })

  return node
}
