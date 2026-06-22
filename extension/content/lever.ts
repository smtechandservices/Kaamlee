import { LeverAdapter } from "../adapters/leverAdapter"

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
