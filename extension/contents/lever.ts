import type { PlasmoCSConfig } from "plasmo"
import { LeverAdapter } from "../adapters/leverAdapter"

export const config: PlasmoCSConfig = {
  matches: ["https://jobs.lever.co/*"]
}

const adapter = new LeverAdapter()

// Global error handler to swallow "Extension context invalidated" errors
window.addEventListener('error', (e) => {
  if (e.message?.includes('Extension context invalidated')) {
    e.stopImmediatePropagation();
  }
}, true);

const initialize = () => {
  if (adapter.detectJobPage()) {
    adapter.injectApplyButton()
  }
}

let automationInFlight = false

const runLeverApply = async () => {
  if (automationInFlight) {
    return { submitted: false, message: "Lever automation is already running" }
  }
  automationInFlight = true
  try {
    return await adapter.submitForm()
  } finally {
    automationInFlight = false
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "STOP_AUTOMATION") {
    adapter.abort()
    automationInFlight = false
    return false
  }

  if (message.action === "START_LEVER_APPLY") {
    runLeverApply().then(sendResponse)
    return true
  }
})

const observer = new MutationObserver(() => {
  initialize()
})

observer.observe(document.body, { childList: true, subtree: true })
initialize()
