export default function isMutationSkippable(mutationsList: MutationRecord[]) {
  if (!mutationsList.length) return false

  try {
    return mutationsList.every((mutation) => {
      const t = mutation.target as HTMLElement | null
      const changedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)]

      if (!changedNodes.length && !t) return false
      return changedNodes.length
        ? changedNodes.every((node) => isSingleMutationSkippable(node as HTMLElement, t))
        : isSingleMutationSkippable(null, t)
    })
  } catch {
    return false
  }
}

function isSingleMutationSkippable(el: HTMLElement | null, t: HTMLElement | null) {
  try {
    if (!el && !t) return false

    // SVG 元素的 className 是 SVGAnimatedString（非字符串），直接 .startsWith 会抛；
    // 用 classList 更稳妥，兼容 HTML 与 SVG。
    const tClass = typeof t?.className === 'string' ? t.className : (t?.getAttribute('class') ?? '')
    const elClass = typeof el?.className === 'string' ? el.className : (el?.getAttribute('class') ?? '')

    if (
      el?.id?.startsWith('xf-') ||
      t?.id?.startsWith('xf-') ||
      tClass.startsWith('xf-') ||
      elClass.startsWith('xf-')
    )
      return true

    if (t?.closest('[data-testid="like"]') || t?.closest('[data-testid="retweet"]') || t?.closest('[data-testid="reply"]'))
      return true

    // 导航变更由 dynamic feature scope 精确派发，不能在这里整体跳过；
    // 否则 X 重建导航后缺失按钮和标签模式不会恢复。
    if (t?.closest('head')) return true

    if (el?.closest("[data-testid^='UserAvatar-Container']") || t?.closest("[data-testid^='UserAvatar-Container']"))
      return true

    if (el?.closest("[data-testid='tweetPhoto']")) return true

    if (
      el?.nodeName === 'IMG' ||
      t?.nodeName === 'IMG' ||
      el?.nodeName === 'VIDEO' ||
      el?.firstChild?.nodeName === 'VIDEO' ||
      el?.querySelector(':scope > img') ||
      el?.getAttribute('data-testid') === 'tweetPhoto' ||
      (el?.parentElement?.getAttribute('data-testid') === 'tweetPhoto') ||
      t?.closest("[data-testid='videoPlayer']")
    )
      return true

    if (el?.closest("[data-testid='card.wrapper']")) return true
    if (el?.nodeName === 'SCRIPT') return true
    if (el?.nodeName === 'STYLE') return true
    if (el?.closest("[data-testid='DMDrawer']") || t?.closest("[data-testid='DMDrawer']")) return true
    if (el?.closest("[data-testid='sidebarColumn']") || t?.closest("[data-testid='sidebarColumn']")) return true
    if (el?.nodeName === '#text') return true

    if (
      el?.nodeName === 'DIV' &&
      el?.firstChild?.firstChild?.firstChild &&
      (el.firstChild.firstChild as HTMLElement)?.getAttribute('data-testid') === 'caret'
    )
      return true

    if (el?.nodeName === 'path') return true

    return false
  } catch {
    return false
  }
}
