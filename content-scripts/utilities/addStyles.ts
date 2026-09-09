import { removeElementById } from './removeElement'

export default function addStyles(id: string, css: string) {
  removeElementById('xf-style-' + id)
  const head = document.querySelector('head')
  const style = document.createElement('style')
  style.id = 'xf-style-' + id
  style.textContent = css.trim().split('\n').join('')
  head!.appendChild(style)
}

export function removeStyles(id: string) {
  removeElementById('xf-style-' + id)
}

export function stylesExist(id: string) {
  return document.getElementById('xf-style-' + id)
}
