import type { PlasmoCSConfig } from "plasmo"
import { LinkedInAdapter } from "../adapters/linkedinAdapter"

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/jobs/*"]
}

const adapter = new LinkedInAdapter()

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

const initialize = async () => {
  if (adapter.detectJobPage()) {
    adapter.injectApplyButton()

    // Check if a queue is currently running
    const status = await new Promise<any>(resolve => {
      sendToBackground({ action: "GET_STATUS" }, resolve)
    })

    if (status && status.isRunning) {
      console.log("Kaamlee Queue is running. Auto-applying to job...")
      
      // Perform the actual application process
      await adapter.submitForm()
      
      console.log("Auto-apply complete. Sending JOB_COMPLETED.")
      sendToBackground({ action: "JOB_COMPLETED" })
    }
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
    }
  }
})


const observer = new MutationObserver(() => {
  initialize()
})

observer.observe(document.body, { childList: true, subtree: true })
initialize()
