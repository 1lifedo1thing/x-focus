import selectors from '../selectors'
import addStyles, { stylesExist } from '../utilities/addStyles'
import { getPrecomposeUrl, isComposeUrl } from './precompose'

// 用 WeakMap 保存每个编辑器「失焦前」的光标位置
// 点击工具栏按钮时编辑器已失焦，必须在 blur 时提前保存
const savedRangeMap = new WeakMap<HTMLElement, Range>()

// Only inject into modals that look like a compose modal
function isComposeModal(modal: Element): boolean {
  return !!(
    modal.querySelector('.DraftEditor-editorContainer') ||
    modal.querySelector('[data-testid="ScrollSnap-List"]') ||
    modal.querySelector('[data-testid^="tweetTextarea"]')
  )
}

export const addComposerInsertLinkButton = () => {
  try {
    const modals = Array.from(document.querySelectorAll(selectors.modalWrapper))
      .filter(isComposeModal)

    modals.forEach((modal) => {
      const modalEl = modal as HTMLElement

      if (modalEl.dataset.xfInsertLinkAdded === '1') return

      const tablist = modalEl.querySelector('[role="tablist"], [data-testid="ScrollSnap-List"]') as HTMLElement | null

      if (!stylesExist('insertLinkButton')) {
        addStyles(
          'insertLinkButton',
          '.xf-insert-link-presentation{display:inline-flex!important}.xf-insert-link-inner{display:inline-flex!important;align-items:center!important}.xf-insert-link-button{background:transparent!important;border:0!important;padding:6px!important;margin-left:4px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;color:inherit!important}.xf-insert-link-button svg{width:20px!important;height:20px!important;color:inherit!important}'
        )
      }

      const btn = document.createElement('button')
      btn.setAttribute('type', 'button')
      btn.setAttribute('aria-label', '插入帖子链接')
      btn.setAttribute('data-testid', 'xf-insert-link-button')
      btn.className = 'xf-insert-link-button'

      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M11.75 22q-2.6 0-4.425-1.825T5.5 15.75V6.5q0-1.875 1.313-3.187T10 2t3.188 1.313T14.5 6.5V13q0 .425-.288.713T13.5 14t-.712-.288T12.5 13V6.5q-.025-1.05-.737-1.775T10 4t-1.775.725T7.5 6.5v9.25q-.025 1.775 1.225 3.013T11.75 20q.425 0 .8-.088t.725-.212q.4-.15.775.013t.525.562t-.012.775t-.563.525q-.525.2-1.087.313T11.75 22M17 21q-.425 0-.712-.288T16 20v-2h-2q-.425 0-.712-.288T13 17t.288-.712T14 16h2v-2q0-.425.288-.712T17 13t.713.288T18 14v2h2q.425 0 .713.288T21 17t-.288.713T20 18h-2v2q0 .425-.288.713T17 21m-7-4q-.425 0-.712-.288T9 16V7q0-.425.288-.712T10 6t.713.288T11 7v9q0 .425-.288.713T10 17m7-6q-.425 0-.712-.288T16 10V7q0-.425.288-.712T17 6t.713.288T18 7v3q0 .425-.288.713T17 11"/>
        </svg>
      `

      // 找到编辑器并监听 blur，在失焦时保存光标位置
      const attachBlurSaver = (editorEl: HTMLElement) => {
        if ((editorEl as any).__xfBlurSaverAttached) return
        ;(editorEl as any).__xfBlurSaverAttached = true
        editorEl.addEventListener('blur', () => {
          const sel = window.getSelection()
          if (sel && sel.rangeCount > 0) {
            savedRangeMap.set(editorEl, sel.getRangeAt(0).cloneRange())
          }
        }, true)
      }

      const findAndAttach = () => {
        const editors = [
          modalEl.querySelector('.DraftEditor-editorContainer [contenteditable="true"]'),
          modalEl.querySelector('[data-testid^="tweetTextarea"]'),
        ].filter(Boolean) as HTMLElement[]
        editors.forEach(attachBlurSaver)
      }

      // 立即尝试一次，编辑器可能还未渲染则等 DOM ready
      findAndAttach()
      if (!modalEl.querySelector('[contenteditable="true"]')) {
        const obs = new MutationObserver(() => { findAndAttach(); obs.disconnect() })
        obs.observe(modalEl, { childList: true, subtree: true })
      }

      btn.addEventListener('mousedown', (ev) => {
        // mousedown 时编辑器还有焦点，提前保存一次以防 blur 事件来不及触发
        const sel = window.getSelection()
        const activeEditor = [
          modalEl.querySelector('.DraftEditor-editorContainer [contenteditable="true"]'),
          modalEl.querySelector('[data-testid^="tweetTextarea"]'),
        ].find((el) => el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) as HTMLElement | undefined
        if (activeEditor && sel && sel.rangeCount > 0) {
          savedRangeMap.set(activeEditor, sel.getRangeAt(0).cloneRange())
        }
        ev.preventDefault() // 阻止默认 focus 转移（不影响 click 事件触发）
      })

      btn.addEventListener('click', (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        insertCurrentUrlIntoEditor(modalEl)
      })

      if (tablist) {
        const presentation = document.createElement('div')
        presentation.setAttribute('role', 'presentation')
        presentation.setAttribute('data-testid', 'xf-insert-link-presentation')
        presentation.className = 'xf-insert-link-presentation'

        const inner1 = document.createElement('div')
        inner1.className = 'xf-insert-link-inner'
        inner1.appendChild(btn)
        presentation.appendChild(inner1)

        tablist.appendChild(presentation)
        modalEl.dataset.xfInsertLinkAdded = '1'
        return
      }

      let toolbarContainer: HTMLElement | null = null
      const fileInput = modalEl.querySelector('input[data-testid="fileInput"], input[type="file"]') as HTMLElement | null
      if (fileInput && fileInput.parentElement) toolbarContainer = fileInput.parentElement as HTMLElement

      if (!toolbarContainer) {
        const svgButtons = Array.from(modalEl.querySelectorAll('button')).filter((b) => b.querySelector('svg'))
        if (svgButtons.length) {
          const candidate = svgButtons[0].parentElement as HTMLElement | null
          if (candidate) toolbarContainer = candidate
        }
      }

      if (!toolbarContainer) return

      toolbarContainer.appendChild(btn)
      modalEl.dataset.xfInsertLinkAdded = '1'
    })
  } catch {
    // Silent fail
  }
}

function insertCurrentUrlIntoEditor(modal: Element) {
  const urlToInsert = getPrecomposeUrl()

  // 严格原则：只插入真实捕获到的推文链接，没有就静默返回，绝对不瞎猜、坚决不兜底 https://x.com/
  if (!urlToInsert) return

  // Prefer the DraftEditor-editorContainer inside the modal
  let editor: HTMLElement | null = null
  const localDraft = modal.querySelector('.DraftEditor-editorContainer') as HTMLElement | null
  if (localDraft) editor = localDraft.querySelector('[contenteditable="true"]') as HTMLElement | null

  // Fallback to any DraftEditor-editorContainer in the document
  if (!editor) {
    const docDraft = document.querySelector('.DraftEditor-editorContainer [contenteditable="true"]') as HTMLElement | null
    if (docDraft) editor = docDraft
  }

  // Final fallbacks: data-testid based editors
  if (!editor) {
    const testEditor = (modal.querySelector('[data-testid^="tweetTextarea"]') as HTMLElement | null) || (document.querySelector('[data-testid^="tweetTextarea"]') as HTMLElement | null)
    if (testEditor) editor = testEditor
  }

  if (!editor) return

  // 智能空格：如果编辑器当前末尾已有文本且非空白，则加空格分隔；若为空或行首则不添加多余前置空格
  const currentContent = editor.innerText || editor.textContent || ''
  const prefix = currentContent.trim().length > 0 && !currentContent.endsWith(' ') ? ' ' : ''

  insertTextIntoContentEditable(editor, prefix + urlToInsert)

  // 注意：不要在插入后清除 sessionStorage！
  // 保持缓存持续可用，允许用户在同一次发帖编辑中输入内容后再插入、多次插入或撤销重插。
}

function insertTextIntoContentEditable(editor: HTMLElement, text: string) {
  // 优先取 blur 时保存的光标（点击按钮后编辑器已失焦，实时 getSelection 此时无效）
  const savedRange = savedRangeMap.get(editor) ?? null

  // focus 回编辑器，然后立即恢复光标到保存的位置
  editor.focus()

  const sel = window.getSelection()
  if (savedRange && sel) {
    sel.removeAllRanges()
    sel.addRange(savedRange)
  }

  // 1. 标准 ClipboardEvent ('paste')
  // Twitter 的 DraftJS 编辑器内置 editOnPaste 处理器，监听到 paste 事件后会自动解析 URL、格式化为蓝色链接并更新 React State，同时调用 e.preventDefault()
  try {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', text)
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
      composed: true,
    })

    const handledByDraftJS = !editor.dispatchEvent(pasteEvent)
    if (handledByDraftJS) {
      savedRangeMap.delete(editor)
      return
    }
  } catch (e) {
    // ignore
  }

  // 2. 尝试 execCommand 插入文本
  try {
    const worked = document.execCommand('insertText', false, text)
    if (worked) {
      savedRangeMap.delete(editor)
      return
    }
  } catch (e) {
    // ignore and fallback
  }

  // 3. Fallback: 手动操作 Range 插入文本节点（仅用于非 DraftJS 的普通 contenteditable）
  let range: Range
  if (savedRange) {
    range = savedRange.cloneRange()
  } else if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
    range = sel.getRangeAt(0)
  } else {
    range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false) // 移到末尾
  }

  // 若有选区则先清除（只清选区范围内内容，不影响其他文字）
  range.deleteContents()
  const textNode = document.createTextNode(text)
  range.insertNode(textNode)

  // 将光标移到插入内容之后
  range.setStartAfter(textNode)
  range.collapse(true)
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(range)
  }

  savedRangeMap.delete(editor)

  // 通知普通 DOM 状态更新
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
}
