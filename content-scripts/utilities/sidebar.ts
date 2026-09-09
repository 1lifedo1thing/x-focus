interface SidebarButtonOptions {
  name: string
  href?: string
  userHref?: string
  onClick?: (el: HTMLElement) => void
  svgAsset: string
}

export function addSidebarButton({ name, href, userHref, onClick, svgAsset }: SidebarButtonOptions) {
  const existingElements = [
    ...document.querySelectorAll(`nav[role="navigation"] > [aria-label="${name}"]`),
    ...document.querySelectorAll(`nav[role="navigation"] > [aria-label="${name.toLowerCase()}"]`),
  ]

  const profileNode = document.querySelector('nav[role="navigation"] > a[role="link"][data-testid="AppTabBar_Profile_Link"]')
  if (!profileNode) return

  if (existingElements.length > 1) {
    existingElements.slice(1).forEach((el) => el.remove())
  }

  const existingElement = existingElements[0] as HTMLElement | undefined

  if (existingElement) {
    const hasChanged =
      (profileNode.querySelector('span') && !existingElement.querySelector('span')) ||
      (!profileNode.querySelector('span') && !!existingElement.querySelector('span'))

    if (!hasChanged) return

    const newNode = createNewElement({ name, href, userHref, onClick, svgAsset, profileNode })
    existingElement.replaceWith(newNode)
  } else {
    const newNode = createNewElement({ name, href, userHref, onClick, svgAsset, profileNode })
    profileNode.insertAdjacentElement('beforebegin', newNode)
  }
}

function createNewElement({ profileNode, name, href, userHref, onClick, svgAsset }: SidebarButtonOptions & { profileNode: Element }) {
  let newNode: HTMLElement

    if (href || userHref) {
      newNode = profileNode.cloneNode(true) as HTMLElement
      if (href) (newNode as HTMLAnchorElement).href = href
      if (userHref) (newNode as HTMLAnchorElement).href += userHref
    } else if (onClick) {
      newNode = document.createElement('div')
      newNode.innerHTML = profileNode.innerHTML
      newNode.style.cursor = 'pointer'
      newNode.onclick = () => onClick(newNode)
      newNode.setAttribute('role', 'button')
      newNode.setAttribute('tabindex', '0')
      newNode.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(newNode)
        }
      })
    } else {
      throw new Error('Either href/userHref or onClick must be provided')
    }

    newNode.setAttribute('aria-label', name)
    newNode.removeAttribute('data-testid')
    newNode.classList.add('xf-sidebar-button')
    const inner = newNode.firstChild?.firstChild?.firstChild as HTMLElement | null
    if (inner) inner.innerHTML = svgAsset
    const label = newNode.firstChild?.lastChild?.firstChild
    if (label) label.textContent = name

  return newNode
}
