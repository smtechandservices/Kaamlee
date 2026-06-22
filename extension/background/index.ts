export {}

import { getState, setState, resetSession } from "./session"
import { api } from "../lib/api"

let jobQueue: any[] = []
let isQueueRunning = false

const processQueue = async () => {
function notifyJobStatus(jobId: string, status: string, message?: string) {
  chrome.tabs.query({ url: ["http://localhost/*", "https://*.kaamlee.com/*"] }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: "UPDATE_JOB_STATUS",
          payload: { jobId, status, message }
        }).catch(() => {}) // Ignore errors if content script not ready
      }
    }
  });
}

async function processQueue() {
  if (isQueueRunning || jobQueue.length === 0) return
  isQueueRunning = true
  
  while (jobQueue.length > 0 && !getState().isPaused) {
    const job = jobQueue.shift()
    notifyJobStatus(job.id, "applying")
    
    setState({ 
      isRunning: true, 
      currentPlatform: job.platform || "unknown", 
      lastActivity: `Applying to ${job.title} at ${job.company}...` 
    })

    try {
      // 1. Create a new tab for the job
      const tab = await chrome.tabs.create({ url: job.job_url, active: false })
      
      // 2. Wait for the content script to be ready and automation to complete
      await new Promise((resolve, reject) => {
        const listener = (message: any, sender: chrome.runtime.MessageSender) => {
          if (sender.tab?.id === tab.id && message.action === "JOB_COMPLETED") {
            chrome.runtime.onMessage.removeListener(listener)
            resolve(true)
          }
        }
        chrome.runtime.onMessage.addListener(listener)
        
        // Timeout after 60 seconds
        setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener)
          reject(new Error("Job timed out"))
        }, 60000)
      })

      // 3. Close the tab
      if (tab.id) await chrome.tabs.remove(tab.id)
      
      notifyJobStatus(job.id, "done")
      setState({ 
        applicationsToday: (getState().applicationsToday || 0) + 1,
        lastActivity: `Successfully applied to ${job.title}`
      })
    } catch (error) {
      console.error("Failed to apply to job:", error)
      notifyJobStatus(job.id, "failed", error.message)
      setState({ lastActivity: `Failed to apply to ${job.title}: ${error.message}` })
    }

    // Delay between jobs
    await new Promise(r => setTimeout(r, 5000))
  }
  
  isQueueRunning = false
  if (jobQueue.length === 0) {
    setState({ isRunning: false, currentPlatform: null, lastActivity: "All jobs processed" })
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
    setState({ isRunning: true, isPaused: false, lastActivity: `Queue started with ${jobQueue.length} jobs` })
    processQueue()
    sendResponse(getState())
    return true
  }

  if (action === "START_AUTOMATION") {
    setState({ isRunning: true, isPaused: false, currentPlatform: request.platform, lastActivity: `Started on ${request.platform}` })
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
    processQueue()
    sendResponse(getState())
    return true
  }

  if (action === "STOP_AUTOMATION") {
    jobQueue = []
    setState({ isRunning: false, isPaused: false, currentPlatform: null, lastActivity: "Stopped by user" })
    sendResponse(getState())
    return true
  }

  if (action === "LOG_EVENT") {
    setState({ lastActivity: request.data?.message ?? "Activity logged" })
    sendResponse({ ok: true })
    return true
  }

  return true
})
