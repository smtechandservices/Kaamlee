export {}

import { getState, resetSession, setState } from "./session"

let jobQueue: any[] = []
let isQueueRunning = false

interface ApplyResult {
  submitted: boolean
  message?: string
}

function broadcastMessage(message: any) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message, () => {
          void chrome.runtime.lastError
        })
      }
    }
  })
}

function notifyJobStatus(jobId: string, status: string, message?: string, shouldRemove?: boolean) {
  try {
    if (!chrome?.runtime?.id) return

    chrome.tabs.query(
      { url: ["http://localhost/*", "https://*.kaamlee.com/*"] },
      (tabs) => {
        for (const tab of tabs) {
          if (!tab.id) continue

          try {
            chrome.tabs.sendMessage(
              tab.id,
              {
                action: "UPDATE_JOB_STATUS",
                payload: { jobId, status, message, shouldRemove }
              },
              () => {
                // Ignore errors from orphaned tabs
                void chrome.runtime.lastError
              }
            )
          } catch (err) {
            // Silently fail for individual tabs with invalidated contexts
          }
        }
      }
    )
  } catch (err) {
    console.error("Failed to notify job status:", err)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForTabLoad(tabId?: number, timeoutMs = 45000) {
  if (!tabId) throw new Error("Job tab could not be opened")

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error("LinkedIn tab did not finish loading"))
    }, timeoutMs)

    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve(true)
      }
    }

    chrome.tabs.onUpdated.addListener(listener)
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return
      if (tab.status === "complete") {
        clearTimeout(timeout)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve(true)
      }
    })
  })
}

async function startAutomation(tabId: number, platform: string): Promise<ApplyResult> {
  const action = `START_${platform.toUpperCase()}_APPLY`
  const startedAt = Date.now()
  
  while (Date.now() - startedAt < 60000) {
    if (!getState().isRunning || getState().isPaused) {
      return { submitted: false, message: "Automation stopped or paused" }
    }

    const result = await new Promise<ApplyResult | null>((resolve) => {
      chrome.tabs.sendMessage(tabId, { action }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null)
          return
        }
        resolve(response || null)
      })
    })

    if (result) return result
    await sleep(1000)
  }

  throw new Error(`${platform} content script did not respond`)
}

async function processQueue() {
  if (isQueueRunning || jobQueue.length === 0) return
  isQueueRunning = true

  while (jobQueue.length > 0 && getState().isRunning && !getState().isPaused) {
    const job = jobQueue.shift()
    notifyJobStatus(job.id, "applying")

    setState({
      isRunning: true,
      currentPlatform: job.platform || job.site || "unknown",
      lastActivity: `Applying to ${job.title} at ${job.company}...`
    })

    let tabId: number | undefined
    try {
      const tab = await chrome.tabs.create({ url: job.job_url, active: true })
      tabId = tab.id
      await waitForTabLoad(tabId)
      
      const platform = job.platform || job.site || "linkedin"
      const result = await startAutomation(tabId, platform)

      if (!result.submitted) {
        throw new Error(result.message || `${platform} application was not submitted`)
      }

      if (tabId) await chrome.tabs.remove(tabId)

      notifyJobStatus(job.id, "done")
      setState({
        applicationsToday: (getState().applicationsToday || 0) + 1,
        lastActivity: `Successfully applied to ${job.title}`
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      
      if (message === "Automation stopped or paused") {
        notifyJobStatus(job.id, "skipped", "Stopped by user", false)
        return
      }

      // If the job is not apply-able (e.g. no button or script timeout), suggest removal from DB
      const shouldRemove = 
        message.includes("No LinkedIn Easy Apply button found") || 
        message.includes("content script did not respond") ||
        message.includes("button not found") ||
        message.includes("External employer site")

      if (!shouldRemove) {
        console.error("Failed to apply to job:", error)
      } else {
        console.log(`Skipping and removing invalid job: ${job.title} (${message})`)
      }

      notifyJobStatus(job.id, shouldRemove ? "skipped" : "failed", message, shouldRemove)
      setState({ lastActivity: shouldRemove ? `Skipped ${job.title}: ${message}` : `Failed to apply to ${job.title}: ${message}` })

      if (tabId && chrome?.runtime?.id) {
        if (shouldRemove) {
          chrome.tabs.remove(tabId, () => void chrome.runtime.lastError)
        } else {
          chrome.tabs.get(tabId, (tab) => {
            if (!chrome.runtime.lastError && tab) {
              chrome.tabs.update(tabId, { active: true }, () => {
                void chrome.runtime.lastError
              })
            }
          })
        }
      }
    }

    // Wait a bit before starting the next job to prevent rate limiting
    await sleep(3000)
  }

  isQueueRunning = false
  if (jobQueue.length === 0) {
    setState({
      isRunning: false,
      currentPlatform: null,
      lastActivity: "All jobs processed"
    })
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const { action } = request

  if (action === "GET_STATUS") {
    sendResponse(getState())
    return true
  }

  if (action === "START_QUEUE") {
    jobQueue = request.jobs || []
    setState({
      isRunning: true,
      isPaused: false,
      lastActivity: `Queue started with ${jobQueue.length} jobs`
    })
    void processQueue()
    sendResponse(getState())
    return true
  }

  if (action === "START_AUTOMATION") {
    setState({
      isRunning: true,
      isPaused: false,
      currentPlatform: request.platform,
      lastActivity: `Started on ${request.platform}`
    })

    if (request.data) {
      // Ensure the job has an ID if it doesn't
      const job = { ...request.data, id: request.data.id || `single-${Date.now()}` }
      jobQueue = [job]
      void processQueue()
    }

    sendResponse(getState())
    return true
  }

  if (action === "PAUSE_AUTOMATION") {
    setState({ isPaused: true, lastActivity: "Paused by user" })
    sendResponse(getState())
    return true
  }

  if (action === "RESUME_AUTOMATION") {
    setState({ isPaused: false, lastActivity: "Resumed by user" })
    void processQueue()
    sendResponse(getState())
    return true
  }

  if (action === "STOP_AUTOMATION") {
    jobQueue = []
    setState({
      isRunning: false,
      isPaused: false,
      currentPlatform: null,
      lastActivity: "Stopped by user"
    })
    broadcastMessage({ action: "STOP_AUTOMATION" })
    sendResponse(getState())
    return true
  }

  if (action === "RESET_AUTOMATION") {
    jobQueue = []
    isQueueRunning = false
    resetSession()
    broadcastMessage({ action: "STOP_AUTOMATION" })
    sendResponse(getState())
    return true
  }

  if (action === "LOG_EVENT") {
    setState({ lastActivity: request.data?.message ?? "Activity logged" })
    sendResponse({ ok: true })
    return true
  }

  sendResponse({ ok: false, error: "Unknown action" })
  return true
})
