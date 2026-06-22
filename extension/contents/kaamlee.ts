import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["http://localhost/*", "https://*.kaamlee.com/*"]
}

const postToPage = (action: string, payload?: unknown) => {
  window.postMessage(
    {
      source: "kaamlee-extension",
      action,
      payload
    },
    "*"
  )
}

const sendToBackground = (message: Record<string, unknown>) => {
  try {
    if (!chrome?.runtime?.id) return

    chrome.runtime.sendMessage(message, () => {
      if (chrome.runtime.lastError) {
        console.debug(
          "Kaamlee extension background unavailable:",
          chrome.runtime.lastError.message
        )
      }
    })
  } catch (error) {
    console.debug("Kaamlee extension context is no longer available:", error)
  }
}

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
      if (jobUrl) {
        sendToBackground({
          action: "START_AUTOMATION",
          platform: "linkedin", // Or parse platform from URL
          data: event.data.payload,
        })
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

// Global error handler to swallow "Extension context invalidated" errors
// which are common during development reloads.
window.addEventListener('error', (e) => {
  if (e.message?.includes('Extension context invalidated')) {
    e.stopImmediatePropagation();
  }
}, true);

// Forward status updates from the background queue back to the frontend
const attachStatusListener = () => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      chrome.runtime.onMessage.addListener((message) => {
        // If context is invalidated, this might still fire once
        if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
        
        if (message.action === "UPDATE_JOB_STATUS") {
          postToPage("UPDATE_JOB_STATUS", message.payload)
        } else if (message.action === "STOP_AUTOMATION") {
          postToPage("STOP_AUTOMATION")
        }
      })
    }
  } catch (error) {
    // Silently ignore context errors
  }
}

attachStatusListener();
