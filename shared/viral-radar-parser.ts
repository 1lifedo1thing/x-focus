/**
 * 爆款雷达 - 推文流速（Impressions Velocity）解析与分类算法
 */

export type TweetVelocityCategory = 'normal' | 'potential' | 'viral'

/**
 * 从包含数字和单位后缀的字符串中提取数值
 * 支持:
 * - 纯数字 / 逗号分隔: "1,234" -> 1234
 * - K / M / B 英文后缀: "1.2K" -> 1200, "15.3M" -> 15300000, "2B" -> 2000000000
 * - 中文后缀: "1.2万" -> 12000, "1.5千" -> 1500, "1.2亿" -> 120000000
 * - 包含上下文描述: "1.2K Views", "1,234 次浏览", "500 次查看"
 */
export function parseNumberWithSuffix(str: string): number | null {
  if (!str) return null
  const cleaned = str.trim()
  if (!cleaned) return null

  // 1. 中文单位匹配 (亿 / 万 / 千)
  const cnMatch = cleaned.match(/([\d,]+(?:\.\d+)?)\s*([亿萬万千])/)
  if (cnMatch && cnMatch[1] && cnMatch[2]) {
    const val = parseFloat(cnMatch[1].replace(/,/g, ''))
    if (isNaN(val)) return null
    const unit = cnMatch[2]
    if (unit === '亿') return Math.round(val * 100000000)
    if (unit === '万' || unit === '萬') return Math.round(val * 10000)
    if (unit === '千') return Math.round(val * 1000)
  }

  // 2. 英文单位匹配 (K / M / B)
  const enMatch = cleaned.match(/([\d,]+(?:\.\d+)?)\s*([KMBkmb])\b/)
  if (enMatch && enMatch[1] && enMatch[2]) {
    const val = parseFloat(enMatch[1].replace(/,/g, ''))
    if (isNaN(val)) return null
    const unit = enMatch[2].toUpperCase()
    if (unit === 'K') return Math.round(val * 1000)
    if (unit === 'M') return Math.round(val * 1000000)
    if (unit === 'B') return Math.round(val * 1000000000)
  }

  // 3. 普通数字 (带或不带逗号)
  const numMatch = cleaned.match(/[\d,]+(?:\.\d+)?/)
  if (numMatch && numMatch[0]) {
    const val = parseFloat(numMatch[0].replace(/,/g, ''))
    return isNaN(val) ? null : Math.round(val)
  }

  return null
}

/**
 * 从推文底部互动操作组（role="group"）的 aria-label 提取浏览量。
 * 例如：
 * - 中文："3 喜欢、已喜欢、388 次观看" -> 388
 * - 中文："33 回复、4 次转帖、50 喜欢、13 书签、7478 次观看" -> 7478
 * - 英文："3 likes, 388 Views" -> 388
 * - 英文："33 replies, 4 reposts, 50 likes, 13 bookmarks, 7478 views" -> 7478
 * 这是 Twitter 官方在容器层聚合渲染的 ARIA 文本，最稳定且完全不受数字滚动动画 DOM 拼接影响。
 */
export function extractViewsFromGroupAria(aria: string): number | null {
  if (!aria) return null
  // 1. 词缀在后模式：数字在前，后跟关键词
  // 例："388 次观看", "7478 次查看", "1.2万 次浏览", "388件の表示", "388회 조회"
  const prefixMatch = aria.match(
    /([\d,]+(?:\.\d+)?\s*[KMBkmb万萬亿千]?)\s*(?:次观看|次浏览|次查看|次瀏覽|次觀看|views?|件の表示|회\s*조회|vues?|visualizaciones|visualizações|mal angezeigt)/i,
  )
  if (prefixMatch && prefixMatch[1]) {
    return parseNumberWithSuffix(prefixMatch[1])
  }
  // 2. 词缀在前模式（如部分语言 "조회 388회"）
  const suffixMatch = aria.match(/(?:views?|조회)\s*([\d,]+(?:\.\d+)?\s*[KMBkmb万萬亿千]?)/i)
  if (suffixMatch && suffixMatch[1]) {
    return parseNumberWithSuffix(suffixMatch[1])
  }
  return null
}

/**
 * 从可能包含 Twitter 数字滚动动画（app-text-transition-container）的元素中安全提取文本。
 * 当数字发生变化（如从 330 变为 388）时，Twitter 的动画组件在 0.3s 动画期内会同时存在旧节点和新节点。
 * 若直接调用父容器的 textContent 会导致文字无缝拼接（如 "330" + "388" -> "330388"）。
 * 此函数优先提取动画容器中最新的非隐藏子节点文本，防范拼接。
 */
export function getSafeElementText(el: HTMLElement): string {
  const transitionContainer = el.querySelector<HTMLElement>('[data-testid="app-text-transition-container"]')
  if (transitionContainer) {
    const children = Array.from(transitionContainer.children) as HTMLElement[]
    // 过滤掉明确被标记为隐藏退场的节点
    const activeChildren = children.filter((c) => c.getAttribute('aria-hidden') !== 'true')
    const target = activeChildren.length > 0 ? activeChildren[activeChildren.length - 1] : children[children.length - 1]
    if (target) {
      const text = target.textContent?.trim()
      if (text) return text
    }
  }
  return el.textContent?.trim() || ''
}

/**
 * 从 article[data-testid="tweet"] 中提取浏览量（Impressions / Views）
 */
export function extractTweetViews(article: HTMLElement): number | null {
  // 1. 优先尝试从推文底部操作组 role="group" 的 aria-label 提取
  //    这是 Twitter 官方聚合生成的 ARIA 文本，不受前端滚动动画 DOM 拼接影响
  const actionGroup = article.querySelector<HTMLElement>('[role="group"]')
  if (actionGroup) {
    const groupAria = actionGroup.getAttribute('aria-label')
    if (groupAria) {
      const parsed = extractViewsFromGroupAria(groupAria)
      if (parsed !== null) return parsed
    }
  }

  // 2. 查找包含 analytics / view 信息的节点
  const analyticsLink =
    article.querySelector<HTMLElement>('a[href*="/analytics"]') ||
    article.querySelector<HTMLElement>('[data-testid="analytics"]') ||
    article.querySelector<HTMLElement>('a[aria-label*="View" i]') ||
    article.querySelector<HTMLElement>('a[aria-label*="view" i]') ||
    article.querySelector<HTMLElement>('a[aria-label*="浏览"]') ||
    article.querySelector<HTMLElement>('a[aria-label*="查看"]')

  if (analyticsLink) {
    // 优先检查 aria-label
    const ariaLabel = analyticsLink.getAttribute('aria-label')
    if (ariaLabel) {
      const parsed = parseNumberWithSuffix(ariaLabel)
      if (parsed !== null) return parsed
    }

    // 检查 visible text（防动画拼接安全提取）
    const text = getSafeElementText(analyticsLink)
    if (text) {
      const parsed = parseNumberWithSuffix(text)
      if (parsed !== null) return parsed
    }
  }

  // 3. 备选方案：在 article 内部查找可能显示 Views 的链接元素
  const statusLinks = article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')
  for (const link of Array.from(statusLinks)) {
    const aria = link.getAttribute('aria-label') || ''
    if (aria.includes('View') || aria.includes('view') || aria.includes('浏览') || aria.includes('查看')) {
      const parsed = parseNumberWithSuffix(aria)
      if (parsed !== null) return parsed
    }
    const text = getSafeElementText(link)
    if (text.includes('View') || text.includes('view') || text.includes('浏览') || text.includes('查看')) {
      const parsed = parseNumberWithSuffix(text)
      if (parsed !== null) return parsed
    }
  }

  return null
}

/**
 * 从 article[data-testid="tweet"] 中提取发布时间戳 (ms)
 */
export function extractTweetPublishTime(article: HTMLElement): number | null {
  const timeEl = article.querySelector<HTMLElement>('time[datetime]')
  if (!timeEl) return null
  const datetimeStr = timeEl.getAttribute('datetime')
  if (!datetimeStr) return null
  const ts = Date.parse(datetimeStr)
  return isNaN(ts) ? null : ts
}

/**
 * 计算推文的每小时流速 (Views / hour)
 */
export function calculateTweetVelocity(
  views: number,
  publishTimeMs: number,
  nowMs: number = Date.now(),
): number {
  if (views <= 0 || publishTimeMs <= 0) return 0
  const elapsedMs = Math.max(nowMs - publishTimeMs, 1000)
  const elapsedHours = elapsedMs / (1000 * 60 * 60)
  // 避免刚发出的推文（如 30 秒内有 5 次浏览）暴增极值：限制最小时间为 1 分钟 (1/60 小时)
  const effectiveHours = Math.max(elapsedHours, 1 / 60)
  return Math.round(views / effectiveHours)
}

/**
 * 根据阈值判断推文流速分类
 */
export function classifyTweetVelocity(
  viewsPerHour: number,
  potentialThreshold: number = 1000,
  viralThreshold: number = 10000,
): TweetVelocityCategory {
  if (viewsPerHour >= viralThreshold) return 'viral'
  if (viewsPerHour >= potentialThreshold) return 'potential'
  return 'normal'
}

/**
 * 格式化每小时流速显示文本
 * e.g. 500 -> "500/h", 1200 -> "1.2k/h", 15800 -> "15.8k/h", 1200000 -> "1.2m/h"
 */
export function formatVelocityBadge(viewsPerHour: number): string {
  if (viewsPerHour >= 10000) {
    const wan = (viewsPerHour / 10000).toFixed(1).replace(/\.0$/, '')
    return `${wan}万/h`
  }
  if (viewsPerHour >= 1000) {
    const k = (viewsPerHour / 1000).toFixed(1).replace(/\.0$/, '')
    return `${k}k/h`
  }
  return `${viewsPerHour}/h`
}
