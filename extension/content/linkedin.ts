import { LinkedInAdapter } from "../adapters/linkedinAdapter"

const adapter = new LinkedInAdapter()

const initialize = () => {
  if (adapter.detectJobPage()) {
    adapter.injectApplyButton()
  }
}

// Watch for DOM changes (for SPAs like LinkedIn)
const observer = new MutationObserver(() => {
  initialize()
})

observer.observe(document.body, { childList: true, subtree: true })

initialize()
