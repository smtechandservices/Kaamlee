import type { PlasmoCSConfig } from "plasmo"
import { LeverAdapter } from "../adapters/leverAdapter"

export const config: PlasmoCSConfig = {
  matches: ["https://jobs.lever.co/*"]
}

const adapter = new LeverAdapter()

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
