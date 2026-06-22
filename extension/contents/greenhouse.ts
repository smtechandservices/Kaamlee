import type { PlasmoCSConfig } from "plasmo"
import { GreenhouseAdapter } from "../adapters/greenhouseAdapter"

export const config: PlasmoCSConfig = {
  matches: ["https://boards.greenhouse.io/*"]
}

const adapter = new GreenhouseAdapter()

const initialize = () => {
  if (adapter.detectJobPage()) {
    adapter.injectApplyButton()
  }
}

const observer = new MutationObserver(() => {
  initialize()
})

observer.observe(document.body, { childList: true, subtree: true })
initialize()
