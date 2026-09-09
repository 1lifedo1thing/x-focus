const COMPOSE_PREFIXES = ['/compose/', '/intent/']
const COMPOSE_PATH = '/compose/post'
const SYSTEM_PREFIXES = [
  '/home',
  '/explore',
  '/notifications',
  '/messages',
  '/settings',
  '/i/bookmarks',
  '/i/search',
  '/tos',
  '/privacy',
]

const STORAGE_KEY = 'xf.preComposeUrl'
const LAST_TWEET_KEY = 'xf.lastTweetUrl'

/**
 * 判断 URL 是否属于推文详情页 (如 /username/status/123456 或长文章)
 */
export function isTweetUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr) return false
  try {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://x.com'
    const url = new URL(urlStr, origin)
    return /\/[A-Za-z0-9_]+\/status\/\d+/.test(url.pathname) || url.pathname.startsWith('/i/article/')
  } catch {
    return false
  }
}

/**
 * 判断 URL 是否属于发帖/回复/意图等 compose 状态页面
 */
export function isComposeUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr) return false
  try {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://x.com'
    const url = new URL(urlStr, origin)
    return COMPOSE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  } catch {
    return false
  }
}

/**
 * 判断是否为非推文的系统功能页面（如首页、通知、设置等）
 */
export function isSystemUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr) return false
  try {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://x.com'
    const url = new URL(urlStr, origin)
    if (url.pathname === '/' || url.pathname === '') return true
    return SYSTEM_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  } catch {
    return false
  }
}

/**
 * 判断当前 DOM 中是否已经打开了短推发帖弹窗
 */
export function isComposeModalOpen(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(
    document.querySelector('[role="dialog"] [data-testid^="tweetTextarea"]') ||
    document.querySelector('[role="dialog"] .DraftEditor-editorContainer') ||
    document.querySelector('[role="dialog"] [data-testid="ScrollSnap-List"]')
  )
}

/**
 * 保存推文链接策略：
 * 1. 弹窗打开期间（用户打字、编辑），绝对不覆盖！
 * 2. compose / intent 页面，绝对不覆盖！
 * 3. 核心原则（用户定制）：只有真正进入推文详情页（/status/ID）时才优先更新保存；
 *    如果只是在首页、通知等系统页，绝不覆盖之前保存好的推文链接！
 * 4. 插入后绝不销毁缓存，支持同一弹窗内多次插入、撤销再插。
 */
export function savePrecomposeUrl(url = typeof window !== 'undefined' ? window.location.href : '') {
  try {
    if (!url) return
    // 弹窗已打开或处于发帖路由时，严禁写入覆盖！
    if (isComposeUrl(url) || isComposeModalOpen()) return

    // 命中推文详情页：最高优先级更新，双重存储（sessionStorage + localStorage 兜底）
    if (isTweetUrl(url)) {
      sessionStorage.setItem(STORAGE_KEY, url)
      try {
        localStorage.setItem(LAST_TWEET_KEY, url)
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined') {
        ;(window as any).__xf_preComposeUrl = url
      }
      return
    }

    // 若当前不在推文详情页（如 /home 等），先检查是否已有保存好的推文链接
    // 若已有推文链接，绝不覆盖！牢牢保住上一条推文
    const existing = getPrecomposeUrl()
    if (existing && isTweetUrl(existing)) {
      return
    }

    // 若此前完全没有任何推文链接，且当前不是系统页（例如特定个人主页），才暂存
    if (!isSystemUrl(url)) {
      sessionStorage.setItem(STORAGE_KEY, url)
      if (typeof window !== 'undefined') {
        ;(window as any).__xf_preComposeUrl = url
      }
    }
  } catch {
    if (typeof window !== 'undefined') {
      ;(window as any).__xf_preComposeUrl = url
    }
  }
}

/**
 * 读取当前有效的推文 URL（多级持久存储：sessionStorage -> localStorage -> 内存）
 */
export function getPrecomposeUrl(): string | null {
  let url: string | null = null
  try {
    url = sessionStorage.getItem(STORAGE_KEY)
  } catch {}
  if (!url) {
    try {
      url = localStorage.getItem(LAST_TWEET_KEY)
    } catch {}
  }
  if (!url) {
    try {
      url = sessionStorage.getItem('mt.preComposeUrl')
    } catch {}
  }
  if (!url && typeof window !== 'undefined' && (window as any).__xf_preComposeUrl) {
    url = (window as any).__xf_preComposeUrl
  }
  if (!url && typeof window !== 'undefined' && (window as any).__mt_preComposeUrl) {
    url = (window as any).__mt_preComposeUrl
  }

  // 严格过滤：compose 路由或根域名均视为无效，绝不返回无效地址
  if (url) {
    if (isComposeUrl(url) || isSystemUrl(url)) {
      url = null
    }
  }
  return url
}

function isComposeNavigation(href: string | null | undefined): boolean {
  if (!href) return false
  return (
    href === COMPOSE_PATH ||
    href.startsWith(COMPOSE_PATH + '?') ||
    href.startsWith(COMPOSE_PATH + '#') ||
    isComposeUrl(href)
  )
}

export function attachPrecomposeUrlCapture() {
  try {
    if ((window as any).__xf_precompose_listener_installed) return
    ;(window as any).__xf_precompose_listener_installed = true

    // 1. 初始化时保存
    savePrecomposeUrl()

    // 2. 捕获点击发帖按钮：在路由跳转前立即检查并保存
    document.addEventListener('click', (ev) => {
      try {
        const target = ev.target as HTMLElement | null
        if (!target) return

        let el: HTMLElement | null = target
        while (el && el !== document.documentElement) {
          if (el instanceof HTMLAnchorElement) {
            const href = el.getAttribute('href')
            if (isComposeNavigation(href)) {
              savePrecomposeUrl()
              break
            }
          }

          const dataHref = el.getAttribute('data-href')
          if (isComposeNavigation(dataHref)) {
            savePrecomposeUrl()
            break
          }

          if (el.getAttribute('role') === 'link' && isComposeNavigation(dataHref)) {
            savePrecomposeUrl()
            break
          }

          el = el.parentElement
        }
      } catch {
        // ignore
      }
    }, true)

    // 3. 监听键盘发帖快捷键 N：弹窗已打开或处于输入状态时严格排斥
    document.addEventListener('keydown', (ev) => {
      try {
        if (ev.key !== 'n' && ev.key !== 'N') return
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return
        if (isComposeModalOpen()) return

        const target = ev.target as HTMLElement | null
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target?.isContentEditable ||
          Boolean(target?.closest?.('[contenteditable="true"]'))
        ) {
          return
        }

        const composeLink = document.querySelector<HTMLAnchorElement>(`a[href="${COMPOSE_PATH}"]`)
        if (composeLink) {
          savePrecomposeUrl()
        }
      } catch {
        // ignore
      }
    })

    // 4. 监听客户端历史与路由变化事件
    window.addEventListener('popstate', () => {
      savePrecomposeUrl()
    })
    window.addEventListener('hashchange', () => {
      savePrecomposeUrl()
    })
  } catch {
    // ignore
  }
}
