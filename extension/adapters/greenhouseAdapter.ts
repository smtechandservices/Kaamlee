import { BaseAdapter, type SubmitResult } from "./baseAdapter"

export class GreenhouseAdapter extends BaseAdapter {
  platformName = "Greenhouse"

  detectJobPage(): boolean {
    return window.location.href.includes("boards.greenhouse.io")
  }

  extractJobDetails() {
    return {
      title: document.querySelector(".app-title")?.textContent?.trim(),
      company: document.querySelector(".company-name")?.textContent?.trim()
    }
  }

  injectApplyButton(): void {
    const existingButton = document.querySelector(".kaamlee-apply-btn")
    if (existingButton) return

    const container = document.querySelector("#apply_button")?.parentElement
    if (container) {
      const btn = document.createElement("button")
      btn.className = "kaamlee-apply-btn"
      btn.innerText = "Apply with Kaamlee AI"
      btn.style.backgroundColor = "#2bb673"
      btn.style.color = "white"
      btn.style.padding = "12px 24px"
      btn.style.borderRadius = "4px"
      btn.style.marginBottom = "20px"
      btn.style.width = "100%"
      btn.onclick = (e) => {
        e.preventDefault()
        if (chrome?.runtime?.id) {
          chrome.runtime.sendMessage({ 
            action: "START_AUTOMATION", 
            platform: "greenhouse",
            data: {
              id: `greenhouse-${Date.now()}`,
              title: this.extractJobDetails().title,
              company: this.extractJobDetails().company,
              job_url: window.location.href,
              platform: "greenhouse"
            }
          })
        } else {
          alert("Extension updated. Please reload the page to continue.")
        }
      }
      container.prepend(btn)
    }
  }

  async submitForm(): Promise<SubmitResult> {
    const submitBtn = document.querySelector("#submit_app") as HTMLButtonElement
    if (!submitBtn) return { submitted: false, message: "Submit button not found" }

    submitBtn.click()
    return { submitted: false, message: "Greenhouse confirmation detection is not implemented" }
  }
}
