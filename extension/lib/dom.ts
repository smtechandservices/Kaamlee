/** Wait for an element to appear in the DOM */
export const waitForElement = (
  selector: string,
  timeout = 5000
): Promise<Element | null> => {
  return new Promise((resolve) => {
    const el = document.querySelector(selector)
    if (el) return resolve(el)

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector)
      if (found) {
        observer.disconnect()
        resolve(found)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

/** Simulate human-like typing into an input */
export const humanType = async (
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string
): Promise<void> => {
  el.focus()
  el.value = ""
  for (const char of text) {
    el.value += char
    el.dispatchEvent(new Event("input", { bubbles: true }))
    await sleep(30 + Math.random() * 70)
  }
  el.dispatchEvent(new Event("change", { bubbles: true }))
}

/** Select a dropdown option by value or label */
export const selectOption = (
  selector: string,
  value: string
): void => {
  const el = document.querySelector(selector) as HTMLSelectElement
  if (!el) return
  const option = Array.from(el.options).find(
    (o) => o.value === value || o.text.toLowerCase().includes(value.toLowerCase())
  )
  if (option) {
    el.value = option.value
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))
