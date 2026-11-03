import { extractTweetCopyText } from '../../shared/parse-tweet'

export const COPY_BTN_ATTR = 'data-xf-copy-btn'

const COPY_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`

const SUCCESS_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`

/**
 * 复制文本到剪贴板：优先使用 Clipboard API，异常时降级为 textarea + execCommand('copy')
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 降级到 execCommand
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.left = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/**
 * 屏幕底部轻量 Toast 提示
 */
export function showCopyToast(message: string, type: 'success' | 'warning' | 'error' = 'success') {
  if (typeof document === 'undefined' || !document.body) return

  let container = document.getElementById('xf-toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'xf-toast-container'
    container.style.cssText = [
      'position:fixed',
      'bottom:32px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:9999999',
      'pointer-events:none',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:8px',
      'transition:all 0.2s ease',
    ].join(';')
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.style.cssText = [
    'background:rgba(15,20,25,0.92)',
    'color:#ffffff',
    'padding:8px 16px',
    'border-radius:9999px',
    'font-size:13px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    'font-weight:500',
    'box-shadow:0 4px 16px rgba(0,0,0,0.28)',
    'display:flex',
    'align-items:center',
    'gap:6px',
    'pointer-events:auto',
    'opacity:0',
    'transform:translateY(8px) scale(0.96)',
    'transition:opacity 0.2s ease, transform 0.2s ease',
    'backdrop-filter:blur(8px)',
  ].join(';')

  const icon =
    type === 'success'
      ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34A853" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`

  toast.innerHTML = `${icon}<span>${message}</span>`
  container.appendChild(toast)

  requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0) scale(1)'
  })

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px) scale(0.96)'
    setTimeout(() => {
      toast.remove()
      if (container && container.childElementCount === 0) {
        container.remove()
      }
    }, 200)
  }, 1600)
}

/**
 * 创建推文复制按钮
 */
export function createCopyTweetButton(article: HTMLElement): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.setAttribute(COPY_BTN_ATTR, '1')
  btn.type = 'button'
  btn.title = '复制推文'
  btn.ariaLabel = '复制推文'
  btn.innerHTML = COPY_ICON_SVG
  btn.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'width:34px',
    'height:34px',
    'border:none',
    'border-radius:9999px',
    'background:transparent',
    'cursor:pointer',
    'color:rgb(113,118,123)',
    'transition:background 0.15s,color 0.15s',
    'outline:none',
    'padding:0',
  ].join(';')

  btn.addEventListener('mouseenter', () => {
    if (btn.getAttribute('data-copied') === '1') return
    btn.style.background = 'rgba(29,155,240,0.1)'
    btn.style.color = 'rgb(29,155,240)'
  })

  btn.addEventListener('mouseleave', () => {
    if (btn.getAttribute('data-copied') === '1') return
    btn.style.background = 'transparent'
    btn.style.color = 'rgb(113,118,123)'
  })

  btn.addEventListener('click', async (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    const text = extractTweetCopyText(document, article)
    if (!text) {
      showCopyToast('该推文未包含文本内容', 'warning')
      return
    }

    const ok = await copyTextToClipboard(text)
    if (ok) {
      btn.setAttribute('data-copied', '1')
      btn.style.background = 'rgba(52,168,83,0.12)'
      btn.style.color = '#34A853'
      btn.innerHTML = SUCCESS_ICON_SVG
      btn.title = '已复制推文'
      btn.ariaLabel = '已复制推文'

      showCopyToast('推文已复制到剪贴板', 'success')

      setTimeout(() => {
        btn.removeAttribute('data-copied')
        btn.style.background = 'transparent'
        btn.style.color = 'rgb(113,118,123)'
        btn.innerHTML = COPY_ICON_SVG
        btn.title = '复制推文'
        btn.ariaLabel = '复制推文'
      }, 1500)
    } else {
      showCopyToast('复制失败，请重试', 'error')
    }
  })

  return btn
}
