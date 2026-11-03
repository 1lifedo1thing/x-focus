import { BOOKMARK_METRICS_TYPE, XF_BRIDGE_MARKER } from '../../shared/bridge'
import { KeyBookmarkCount } from '../../storage-keys'
import { getStorage } from '../utilities/storage'
import {
  extractBookmarkFromAriaLabel,
  formatBookmarkCount,
  getBookmarkOwnerIds,
} from '../../shared/bookmark-interceptor'

/**
 * 缓存推文/长文 ID 到书签计数的映射（内存级）
 */
const metricsCache: Record<string, number> = {}

/**
 * 从 sessionStorage 恢复历史缓存
 */
function restoreMetricsFromStorage(): void {
  try {
    const raw = sessionStorage.getItem('xf_bookmark_metrics_last')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        Object.assign(metricsCache, parsed)
      }
    }
  } catch {
    // ignore
  }
}

restoreMetricsFromStorage()

/** 弹窗「收藏量」开关；关闭时不显示数字，并移除已显示的数字 */
let bookmarkCountEnabled = true

export function isBookmarkCountEnabled(): boolean {
  return bookmarkCountEnabled
}

export function setBookmarkCountEnabled(enabled: boolean): void {
  if (bookmarkCountEnabled === enabled) return
  bookmarkCountEnabled = enabled
  if (!enabled) {
    removeBookmarkCounters()
  } else {
    updateBookmarkCounters()
  }
}

/**
 * 监听来自 MAIN world 拦截器的广播，接收推文/长文书签指标
 */
let listenerRegistered = false
export function listenForBookmarkMetricsApi(): void {
  if (listenerRegistered) return
  listenerRegistered = true

  // 尽早读取开关
  void getStorage(KeyBookmarkCount).then((value) => setBookmarkCountEnabled(value !== 'off'))

  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.type !== BOOKMARK_METRICS_TYPE) return
    if (event.data.__xf !== XF_BRIDGE_MARKER) return

    try {
      const payload = event.data.payload as Record<string, number>
      if (payload && typeof payload === 'object') {
        let changed = false
        for (const [id, count] of Object.entries(payload)) {
          if (metricsCache[id] !== count) {
            metricsCache[id] = count
            changed = true
          }
        }
        if (changed) {
          updateBookmarkCounters()
        }
      }
    } catch {
      // ignore
    }
  })
}

const COUNTER_CLASS = 'xf-bookmark-counter'
const BOUND_CLICK_ATTR = 'data-xf-bookmark-bound'
const STYLES_INJECTED_ID = 'xf-bookmark-counter-styles'
const STYLED_ATTR = 'data-xf-bookmark-styled'

// 记录被改过的内联样式原值，关闭功能时恢复
const originalInlineStyles = new WeakMap<HTMLElement, Map<string, string>>()

function setTrackedStyle(el: HTMLElement, prop: string, value: string): void {
  let saved = originalInlineStyles.get(el)
  if (!saved) {
    saved = new Map()
    originalInlineStyles.set(el, saved)
    el.setAttribute(STYLED_ATTR, '1')
  }
  if (!saved.has(prop)) saved.set(prop, el.style.getPropertyValue(prop))
  el.style.setProperty(prop, value)
}

function restoreTrackedStyles(): void {
  document.querySelectorAll<HTMLElement>(`[${STYLED_ATTR}]`).forEach((el) => {
    originalInlineStyles.get(el)?.forEach((value, prop) => {
      if (value) el.style.setProperty(prop, value)
      else el.style.removeProperty(prop)
    })
    originalInlineStyles.delete(el)
    el.removeAttribute(STYLED_ATTR)
  })
}

/**
 * 移除已显示的收藏数、注入的样式，并恢复按钮原有的内联样式
 */
export function removeBookmarkCounters(): void {
  document.querySelectorAll(`.${COUNTER_CLASS}`).forEach((el) => el.remove())
  document.getElementById(STYLES_INJECTED_ID)?.remove()
  restoreTrackedStyles()
}

/**
 * 注入书签数字的交互与过渡样式
 */
function ensureBookmarkCounterStyles(): void {
  if (document.getElementById(STYLES_INJECTED_ID)) return
  const styleEl = document.createElement('style')
  styleEl.id = STYLES_INJECTED_ID
  styleEl.textContent = `
    article[data-testid="tweet"] [role="group"] {
      max-width: none !important;
    }
    article[data-testid="tweet"] [role="group"] div:has(> [data-testid="bookmark"]),
    article[data-testid="tweet"] [role="group"] div:has(> [data-testid="removeBookmark"]),
    article[data-testid="tweet"] [role="group"] div:has(> button[data-testid="bookmark"]),
    article[data-testid="tweet"] [role="group"] div:has(> button[data-testid="removeBookmark"]),
    article[data-testid="tweet"] [role="group"] > div:has([data-testid="bookmark"]),
    article[data-testid="tweet"] [role="group"] > div:has([data-testid="removeBookmark"]) {
      width: auto !important;
      max-width: none !important;
      display: inline-flex !important;
      align-items: center !important;
    }
    [data-testid="bookmark"],
    [data-testid="removeBookmark"] {
      width: auto !important;
      max-width: none !important;
      min-width: unset !important;
      display: inline-flex !important;
      flex-direction: row !important;
      align-items: center !important;
      overflow: visible !important;
    }
    .${COUNTER_CLASS} {
      transition: color 0.15s ease-out !important;
      display: inline-flex !important;
      align-items: center !important;
      user-select: none !important;
      margin-left: 0 !important;
      padding-left: 4px !important;
      padding-right: 12px !important;
    }
    button[data-testid="bookmark"]:hover .${COUNTER_CLASS},
    button[data-testid="removeBookmark"]:hover .${COUNTER_CLASS},
    div[data-testid="bookmark"]:hover .${COUNTER_CLASS},
    div[data-testid="removeBookmark"]:hover .${COUNTER_CLASS} {
      color: rgb(29, 155, 240) !important;
    }
  `
  document.head.appendChild(styleEl)
}

/**
 * 从当前 DOM 上下文中提取推文或长文的所有候选 ID（包括推文自身 ID 与卡片内挂载的长文 ID）
 */
export function getContextCandidateIds(bookmarkBtn: Element): string[] {
  return getBookmarkOwnerIds(bookmarkBtn, typeof window !== 'undefined' ? window.location.pathname : undefined)
}

/**
 * 从同组左侧已有数字按钮中动态获取准确的文字样式（颜色、字号、字体、字重、行高）
 */
export function getReferenceStyle(btn: HTMLElement): {
  className: string
  color: string
  fontSize: string
  fontFamily: string
  fontWeight: string
  lineHeight: string
} | null {
  const group = btn.closest('[role="group"]') || btn.parentElement
  if (!group) return null

  const refBtn = group.querySelector<HTMLElement>(
    'button[data-testid="like"], button[data-testid="retweet"], button[data-testid="reply"], a[href*="/analytics"]',
  )
  if (!refBtn) return null

  const refContainer = refBtn.querySelector<HTMLElement>(
    '[data-testid="app-text-transition-container"]',
  )?.parentElement
  const refSpan =
    refBtn.querySelector<HTMLElement>('[data-testid="app-text-transition-container"] span') ||
    refContainer

  if (!refSpan) return null

  try {
    const comp = window.getComputedStyle(refSpan)
    return {
      className: refContainer?.className || '',
      color: comp.color || 'rgb(83, 100, 113)',
      fontSize: comp.fontSize || '13px',
      fontFamily: comp.fontFamily || 'TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontWeight: comp.fontWeight || '400',
      lineHeight: comp.lineHeight || '16px',
    }
  } catch {
    return null
  }
}

/**
 * 为书签按钮注入或更新数字显示
 */
export function applyBookmarkCountToButton(btn: HTMLElement, count: number): void {
  if (!bookmarkCountEnabled) return
  if (count < 0 || isNaN(count)) return
  ensureBookmarkCounterStyles()

  // 保证按钮本身自适应宽度与横向居中排列
  setTrackedStyle(btn, 'width', 'auto')
  setTrackedStyle(btn, 'max-width', 'none')
  setTrackedStyle(btn, 'display', 'inline-flex')
  setTrackedStyle(btn, 'flex-direction', 'row')
  setTrackedStyle(btn, 'align-items', 'center')

  let p = btn.parentElement
  let pDepth = 0
  while (p && pDepth < 3 && p.getAttribute('role') !== 'group') {
    setTrackedStyle(p, 'width', 'auto')
    setTrackedStyle(p, 'max-width', 'none')
    p = p.parentElement
    pDepth++
  }

  // 寻找图标容器后面的文字挂载位
  const iconWrapper = btn.querySelector('svg')?.closest('div')
  if (!iconWrapper || !iconWrapper.parentElement) return

  const containerParent = iconWrapper.parentElement
  setTrackedStyle(containerParent, 'display', 'inline-flex')
  setTrackedStyle(containerParent, 'flex-direction', 'row')
  setTrackedStyle(containerParent, 'align-items', 'center')

  let counterEl = btn.querySelector<HTMLElement>(`.${COUNTER_CLASS}`)
  const displayStr = formatBookmarkCount(count, 'zh')

  if (!displayStr) {
    if (counterEl) counterEl.style.display = 'none'
    return
  }

  // 检查是否处于已收藏激活态
  const ariaLabel = btn.getAttribute('aria-label') || ''
  const isBookmarked =
    ariaLabel.includes('从书签中删除') ||
    ariaLabel.includes('从书签中移除') ||
    ariaLabel.includes('Remove Bookmark') ||
    ariaLabel.includes('Remove post from Bookmarks') ||
    btn.getAttribute('data-testid') === 'removeBookmark' ||
    btn.querySelector('svg[data-testid="bookmark-filled"]') !== null

  const refStyle = getReferenceStyle(btn)
  const defaultSecondaryColor = 'rgb(83, 100, 113)'
  const twitterBlueColor = 'rgb(29, 155, 240)'

  const finalColor = isBookmarked ? twitterBlueColor : (refStyle?.color || defaultSecondaryColor)
  const finalFontSize = refStyle?.fontSize || '13px'
  const finalFontFamily =
    refStyle?.fontFamily ||
    'TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  const finalFontWeight = refStyle?.fontWeight || '400'
  const finalLineHeight = refStyle?.lineHeight || '16px'

  if (!counterEl) {
    counterEl = document.createElement('div')
    const baseClassName =
      refStyle?.className ||
      'css-146c3p1 r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41'
    counterEl.className = `${baseClassName} ${COUNTER_CLASS}`

    counterEl.innerHTML = `
      <span data-testid="app-text-transition-container" style="transition-property: transform; transition-duration: 0.2s;">
        <span class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3">${displayStr}</span>
      </span>
    `
    containerParent.appendChild(counterEl)
  } else {
    counterEl.style.display = 'inline-flex'
    const textSpan = counterEl.querySelector('.r-poiln3')
    if (textSpan && textSpan.textContent !== displayStr) {
      textSpan.textContent = displayStr
    }
  }

  // 应用与左侧完全对齐的视觉样式
  counterEl.style.color = finalColor
  counterEl.style.fontSize = finalFontSize
  counterEl.style.fontFamily = finalFontFamily
  counterEl.style.fontWeight = finalFontWeight
  counterEl.style.lineHeight = finalLineHeight

  // 记录当前绑定的数值
  btn.dataset.xfBookmarkCount = String(count)

  // 绑定点击增减逻辑（仅绑定一次）
  if (!btn.hasAttribute(BOUND_CLICK_ATTR)) {
    btn.setAttribute(BOUND_CLICK_ATTR, '1')
    btn.addEventListener('click', () => {
      setTimeout(() => {
        const currentCount = parseInt(btn.dataset.xfBookmarkCount || '0', 10)
        const updatedAria = btn.getAttribute('aria-label') || ''
        const updatedIsRemove =
          updatedAria.includes('从书签中删除') ||
          updatedAria.includes('从书签中移除') ||
          updatedAria.includes('Remove Bookmark') ||
          updatedAria.includes('Remove post from Bookmarks') ||
          btn.getAttribute('data-testid') === 'removeBookmark'

        let nextCount = currentCount
        if (updatedIsRemove) {
          nextCount = currentCount + 1
        } else if (currentCount > 0) {
          nextCount = currentCount - 1
        }

        applyBookmarkCountToButton(btn, nextCount)
      }, 50)
    })
  }
}

/**
 * 从推文详情页底部的原生统计文本中提取（如 "447 个书签" 或 "447 Bookmarks"）
 */
function extractBookmarkFromDetailStats(articleOrContainer: Element | null): number | null {
  if (!articleOrContainer) return null
  try {
    const spansAndLinks = articleOrContainer.querySelectorAll('a, span')
    for (const el of Array.from(spansAndLinks)) {
      const txt = el.textContent?.trim() || ''
      if (txt.includes('书签') || txt.toLowerCase().includes('bookmark')) {
        const m =
          txt.match(/(\d[\d,]*)\s*(?:个|次)?\s*(?:书签|bookmarks|bookmark|收藏)/i) ||
          txt.match(/(?:书签|bookmarks|bookmark|收藏)\s*[:：(（]?\s*(\d[\d,]*)/i)
        if (m && m[1]) {
          const num = parseInt(m[1].replace(/,/g, ''), 10)
          if (!isNaN(num) && num >= 0) return num
        }
      }
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * 扫描并更新页面上所有书签按钮的计数
 */
export function updateBookmarkCounters(): void {
  if (!bookmarkCountEnabled) return
  const bookmarkButtons = document.querySelectorAll<HTMLElement>(
    'button[data-testid="bookmark"], button[data-testid="removeBookmark"], [role="button"][data-testid="bookmark"], [role="button"][data-testid="removeBookmark"]',
  )

  bookmarkButtons.forEach((btn) => {
    // 1. 若已有原生容器且具有有效数字内容时跳过，避免冲突
    const existingNativeSpan = btn.querySelector('[data-testid="app-text-transition-container"]')
    if (existingNativeSpan && !existingNativeSpan.closest(`.${COUNTER_CLASS}`)) {
      const nativeText = existingNativeSpan.textContent?.trim() || ''
      if (nativeText && /\d/.test(nativeText)) {
        return
      }
    }

    // 2. 从自身的 aria-label 正则匹配
    const labelCount = extractBookmarkFromAriaLabel(btn.getAttribute('aria-label'))
    if (typeof labelCount === 'number' && labelCount > 0) {
      applyBookmarkCountToButton(btn, labelCount)
      return
    }

    // 3. 从缓存的推文/长文指标中匹配（检查当前卡片提取到的所有候选 ID）
    const candidateIds = getContextCandidateIds(btn)
    for (const id of candidateIds) {
      if (typeof metricsCache[id] === 'number') {
        applyBookmarkCountToButton(btn, metricsCache[id])
        return
      }
    }

    // 4. 详情页原生统计文本兜底
    const article =
      btn.closest('article[data-testid="tweet"]') ||
      btn.closest('article') ||
      btn.closest('[data-testid="twitterArticleReadView"]')
    if (article) {
      const statsCount = extractBookmarkFromDetailStats(article)
      if (typeof statsCount === 'number' && statsCount >= 0) {
        applyBookmarkCountToButton(btn, statsCount)
        return
      }
    }
  })
}
