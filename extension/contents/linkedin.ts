import type { PlasmoCSConfig } from "plasmo"
import { LinkedInAdapter } from "../adapters/linkedinAdapter"

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/jobs/*"]
}

const adapter = new LinkedInAdapter()

// Global error handler to swallow "Extension context invalidated" errors
window.addEventListener('error', (e) => {
  if (e.message?.includes('Extension context invalidated')) {
    e.stopImmediatePropagation();
  }
}, true);

const sendToBackground = <T = unknown,>(
  message: Record<string, unknown>,
  callback?: (response: T | undefined) => void
) => {
  try {
    if (!chrome?.runtime?.id) {
      callback?.(undefined)
      return
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.debug(
          "Kaamlee extension background unavailable:",
          chrome.runtime.lastError.message
        )
        callback?.(undefined)
        return
      }

      callback?.(response)
    })
  } catch (error) {
    console.debug("Kaamlee extension context is no longer available:", error)
    callback?.(undefined)
  }
}

const postToPage = (action: string) => {
  window.postMessage({ source: "kaamlee-extension", action }, "*")
}

let automationInFlight = false

const runLinkedInApply = async () => {
  if (automationInFlight) {
    return {
      submitted: false,
      message: "LinkedIn automation is already running on this tab"
    }
  }

  automationInFlight = true
  try {
    console.log("Kaamlee: starting LinkedIn apply flow")
    return await adapter.submitForm()
  } finally {
    automationInFlight = false
  }
}

const initialize = async () => {
  if (adapter.detectJobPage()) {
    adapter.injectApplyButton()
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "STOP_AUTOMATION") {
    adapter.abort()
    automationInFlight = false
    return false
  }

  if (message.action !== "START_LINKEDIN_APPLY") return false

  runLinkedInApply()
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({
        submitted: false,
        message: error instanceof Error ? error.message : "LinkedIn automation failed"
      })
    })

  return true
})

// Listen for messages from the Kaamlee frontend (window.postMessage)
window.addEventListener("message", (event) => {
  if (
    event.source === window &&
    event.data?.source === "kaamlee-frontend"
  ) {
    if (event.data.action === "PING") {
      postToPage("PONG")
    } else if (event.data.action === "KAAMLEE_AI_APPLY") {
      const { jobUrl } = event.data.payload
      // If the job URL is a LinkedIn URL, open it and start automation
      if (jobUrl && jobUrl.includes("linkedin.com")) {
        sendToBackground({
          action: "START_AUTOMATION",
          platform: "linkedin",
          data: event.data.payload,
        })
        // Open the job URL in a new tab if not already there
        if (!window.location.href.includes(jobUrl)) {
          window.open(jobUrl, "_blank")
        }
      }
    } else if (event.data.action === "START_QUEUE") {
      sendToBackground({
        action: "START_QUEUE",
        jobs: event.data.payload.jobs,
      })
    } else if (event.data.action === "STOP_AUTOMATION") {
      sendToBackground({
        action: "STOP_AUTOMATION",
      })
    } else if (event.data.action === "RESET_AUTOMATION") {
      sendToBackground({
        action: "RESET_AUTOMATION",
      })
    }
  }
})


const observer = new MutationObserver(() => {
  initialize()
})

observer.observe(document.body, { childList: true, subtree: true })
initialize()
