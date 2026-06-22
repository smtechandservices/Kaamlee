import type { PlasmoCSConfig } from "plasmo"
import { GreenhouseAdapter } from "../adapters/greenhouseAdapter"

export const config: PlasmoCSConfig = {
  matches: ["https://boards.greenhouse.io/*"]
}

const adapter = new GreenhouseAdapter()

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

const runGreenhouseApply = async () => {
  if (automationInFlight) {
    return { submitted: false, message: "Greenhouse automation is already running" }
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

  if (message.action === "START_GREENHOUSE_APPLY") {
    runGreenhouseApply().then(sendResponse)
    return true
  }
})

const observer = new MutationObserver(() => {
  initialize()
})

observer.observe(document.body, { childList: true, subtree: true })
initialize()
