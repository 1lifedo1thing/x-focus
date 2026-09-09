function extractColor(selector: string, varName: string) {
  const element = document.querySelector(selector) as HTMLElement | null
  if (!element) return

  let color: string
  if (varName.includes('bg')) {
    color = window.getComputedStyle(element).backgroundColor
  } else if (varName.includes('border')) {
    color = window.getComputedStyle(element).borderColor
  } else {
    color = window.getComputedStyle(element).color
  }

  const root = document.documentElement
  if (!color) return

  if (root.style.getPropertyValue(`--${varName}-color`)) return

  const colorRgb = color.replace('rgb(', '').replace(')', '')
  root.style.setProperty(`--${varName}-color`, color)
  root.style.setProperty(`--${varName}-color-rgb`, colorRgb)
}

export function extractColorsAsRootVars() {
  extractColor('body', 'body-bg')
  extractColor('[data-testid="primaryColumn"]', 'border')
  extractColor('h2 > span', 'main-text')
  extractColor('div > span', 'main-text')
  extractColor('a > time', 'secondary-text')
  extractColor("[data-testid='primaryColumn'] div[aria-haspopup='menu'] > div > div > svg", 'secondary-text')
  extractColor('a', 'accent')
  extractColor('div > svg', 'glyphs')
}

export function getThemeColors() {
  const bodyBg = window.getComputedStyle(document.body).backgroundColor
  let isDark = false

  if (bodyBg) {
    const rgb = bodyBg.match(/\d+/g)
    if (rgb && rgb.length >= 3) {
      const [r, g, b] = rgb.map(Number)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      if (brightness < 128) {
        isDark = true
      }
    }
  }

  return {
    isDark,
    bg: isDark ? (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' ? bodyBg : 'rgb(21, 32, 43)') : '#ffffff',
    fg: isDark ? 'rgb(247, 249, 249)' : 'rgb(15, 20, 25)',
    fgSecondary: isDark ? 'rgb(142, 150, 157)' : 'rgb(83, 100, 113)',
    border: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
    hoverBg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    shadow: isDark ? '0 6px 24px rgba(0, 0, 0, 0.5)' : '0 6px 24px rgba(0, 0, 0, 0.15)',
    accent: 'rgb(29, 155, 240)',
    accentBg: 'rgba(29, 155, 240, 0.12)',
    black: 'rgb(239, 68, 68)',
    blackBg: 'rgba(239, 68, 68, 0.12)',
    green: 'rgb(0, 186, 124)',
  }
}
