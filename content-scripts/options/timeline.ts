import selectors from '../selectors'
import addStyles, { removeStyles } from '../utilities/addStyles'
import waitForElement from '../utilities/waitForElement'
import {
  injectMediaHoverButtons,
  enhanceTweetMediaMenu,
} from '../features/tweet-media-download'

/**
 * 在 <body> 上维护一个标记属性，供 CSS 排除账号分析页面（/i/account_analytics）
 * 的时间线宽度限制（changeTimelineWidth 注入的 primaryColumn 宽度规则）。
 * SPA 路由切换时由动态功能循环调用以保持同步。
 */
export function syncAccountAnalyticsPageMarker() {
  const isAnalyticsPage = window.location.pathname.includes('/i/account_analytics')
  if (isAnalyticsPage) {
    document.body?.setAttribute('data-xf-account-analytics', '')
  } else {
    document.body?.removeAttribute('data-xf-account-analytics')
  }
}

export const changeTimelineWidth = (
  timelineWidth: string | number | boolean,
  navigationLabels: string | number | boolean = 'never',
  sidebarColumn: string | number | boolean = 'off',
) => {
  // 账号分析页（/i/account_analytics）不限制主列宽度，先同步 body 标记
  syncAccountAnalyticsPageMarker()
  const width = Number(timelineWidth)
  // 防御：未归一化的非法值（NaN）不应注入 CSS
  if (!Number.isFinite(width)) {
    removeStyles('timelineWidth')
    return
  }
  const isSidebarHidden = sidebarColumn === 'on' || sidebarColumn === 'hide'

  // 当右侧栏隐藏时，header 与 main 自然按 1:1 flex-grow 平分剩余空间达成居中，
  // 不再人为干预 header 宽度；主列右侧间距也置为 0；
  // 仅在右侧栏展示且导航栏非 never 且宽度 > 600 时，按原逻辑补偿侧栏宽度。
  const sidebarWidth =
    isSidebarHidden || navigationLabels === 'never' || width <= 600
      ? null
      : Math.round(200 + ((800 - width) / 50) * 25)

  const primaryMarginRight = isSidebarHidden ? '0px' : '20px'

  addStyles(
    'timelineWidth',
    `@media only screen and (min-width: 988px) {
      body:not([data-xf-account-analytics]) ${selectors.mainColumn} {
        width: ${width}px !important;
        max-width: ${width}px !important;
        margin-right: ${primaryMarginRight};
      }
      ${sidebarWidth ? `${selectors.leftSidebar} { width: ${sidebarWidth}px !important; }` : ''}
      /* Column shell only — do not force width:100% on arbitrary nested divs
         (bookmarks search uses ~95% width and must keep it). */
      body:not([data-xf-account-analytics]) ${selectors.mainColumn} > div,
      body:not([data-xf-account-analytics]) ${selectors.mainColumn} > div > div {
        max-width: ${width}px !important;
      }
      /* X caps the timeline wrapper and article interaction bars at 600px (e.g. .r-1ye8kvj). Override that
         parent + section and interaction bars so the feed fills the custom column width.
         Included selectors:
         - div:has(> section[role="region"]): Standard timeline feed container
         - div.r-13qz1uu.r-1ye8kvj: Timeline wrapper on profile, home, search, bookmarks, and tweet status
         - section[role="region"]: Timeline section itself
         - div[role="group"].r-1ye8kvj: Article top interaction bar and tweet action groups
         - [data-testid="twitterArticleReadView"] div[role="group"]: Article interaction bars
      */
      body:not([data-xf-account-analytics]) ${selectors.mainColumn} div:has(> section[role="region"]),
      body:not([data-xf-account-analytics]) ${selectors.mainColumn} div.r-13qz1uu.r-1ye8kvj,
      body:not([data-xf-account-analytics]) ${selectors.mainColumn} section[role="region"],
      body:not([data-xf-account-analytics]) ${selectors.mainColumn} div[role="group"].r-1ye8kvj,
      body:not([data-xf-account-analytics]) ${selectors.mainColumn} [data-testid="twitterArticleReadView"] div[role="group"] {
        max-width: ${width}px !important;
        width: 100% !important;
      }
    }`
  )
}


export const addMediaDownloadButtons = () => {
  void injectMediaHoverButtons()

  const dropdown = document.querySelector("div[data-testid='Dropdown'], div[role='menu']")
  if (dropdown) {
    void enhanceTweetMediaMenu(dropdown)
  }

  const bookmarkButtons = document.querySelectorAll("button[data-testid='bookmark']")

  bookmarkButtons.forEach((bookmarkButton) => {
    const parent = bookmarkButton.parentElement
    const ancestor = parent?.parentElement
    const sharePostButton = ancestor?.lastElementChild as HTMLElement | null
    if (!sharePostButton || sharePostButton.classList.contains('xf-enhanced-share')) return

    sharePostButton.classList.add('xf-enhanced-share')
    sharePostButton.addEventListener('click', () => {
      setTimeout(() => {
        void waitForElement("div[data-testid='Dropdown'], div[role='menu']", 3000).then((dropdown) => {
          if (!dropdown) return
          void enhanceTweetMediaMenu(dropdown)
        })
      }, 0)
    })
  })
}
