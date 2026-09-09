// ─── 主题检测 ──────────────────────────────────────

export function isDarkTheme(): boolean {
  const cs = document.documentElement.style.getPropertyValue('color-scheme')
  if (cs === 'dark') return true
  if (cs === 'light') return false
  // 兜底：取 body 背景亮度
  const bg = getComputedStyle(document.body).backgroundColor
  if (!bg || bg === 'rgba(0, 0, 0, 0)') return true
  const m = bg.match(/\d+/g)
  if (m) {
    const [r, g, b] = m.map(Number)
    return (r + g + b) / 3 < 128
  }
  return true
}
