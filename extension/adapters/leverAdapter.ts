import { BaseAdapter, type SubmitResult } from "./baseAdapter"

export class LeverAdapter extends BaseAdapter {
  platformName = "Lever"

  detectJobPage(): boolean {
    return window.location.href.includes("jobs.lever.co")
  }

  extractJobDetails() {
    return {
      title: document.querySelector(".posting-header h2")?.textContent?.trim(),
      company: document.querySelector(".posting-header .posting-category")?.textContent?.trim()
    }
  }

  injectApplyButton(): void {
    const existingButton = document.querySelector(".kaamlee-apply-btn")
    if (existingButton) return

    const container = document.querySelector(".postings-btn-wrapper")
    if (container) {
      const btn = document.createElement("a")
      btn.className = "kaamlee-apply-btn"
      btn.innerText = "Apply with Kaamlee AI"
      btn.style.backgroundColor = "#2671ae"
      btn.style.color = "white"
      btn.style.padding = "12px 24px"
      btn.style.borderRadius = "4px"
      btn.style.display = "inline-block"
      btn.style.cursor = "pointer"
      btn.style.textDecoration = "none"
      btn.style.fontSize = "16px"
      btn.style.fontWeight = "600"
      btn.onclick = (e) => {
        e.preventDefault()
        if (chrome?.runtime?.id) {
          chrome.runtime.sendMessage({ 
            action: "START_AUTOMATION", 
            platform: "lever",
            data: {
              id: `lever-${Date.now()}`,
              title: this.extractJobDetails().title,
              company: this.extractJobDetails().company,
              job_url: window.location.href,
              platform: "lever"
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
    const submitBtn = document.querySelector("#application-button") as HTMLButtonElement
    if (!submitBtn) return { submitted: false, message: "Submit button not found" }

    submitBtn.click()
    return { submitted: false, message: "Lever confirmation detection is not implemented" }
  }
}
