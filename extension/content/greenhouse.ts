import { GreenhouseAdapter } from "../adapters/greenhouseAdapter"

const adapter = new GreenhouseAdapter()

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
