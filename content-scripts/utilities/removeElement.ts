export function removeElementById(id: string) {
  const element = document.getElementById(id)
  element?.remove()
}

export function removeElement(selector: string) {
  const element = document.querySelector(selector)
  element?.remove()
}
