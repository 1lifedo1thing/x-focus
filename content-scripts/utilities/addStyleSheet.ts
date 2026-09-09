export default function addStyleSheet(id: string, href?: string, text?: string) {
  const head = document.querySelector('head')!

  if (href) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.id = `xf-${id}-stylesheet`
    head.appendChild(link)
    return link
  }

  if (text) {
    const style = document.createElement('style')
    style.appendChild(document.createTextNode(text))
    style.id = `xf-${id}-stylesheet`
    head.appendChild(style)
    return style
  }

  throw new Error('addStyleSheet requires either href or text')
}
