import { BaseAdapter, type SubmitResult } from "./baseAdapter"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class LinkedInAdapter extends BaseAdapter {
  platformName = "LinkedIn"

  detectJobPage(): boolean {
    return window.location.href.includes("linkedin.com/jobs/view")
  }

  extractJobDetails() {
    return {
      title: document.querySelector(".job-details-jobs-unified-top-card__job-title")?.textContent?.trim(),
      company: document.querySelector(".job-details-jobs-unified-top-card__company-name")?.textContent?.trim()
    }
  }

  injectApplyButton(): void {
    const existingButton = document.querySelector(".kaamlee-apply-btn")
    if (existingButton) return

    const container = document.querySelector(".jobs-apply-button--top-card")?.parentElement
    if (container) {
      const btn = document.createElement("button")
      btn.className = "kaamlee-apply-btn"
      btn.innerText = "Apply with Kaamlee AI"
      btn.style.backgroundColor = "#ff6b6b"
      btn.style.color = "white"
      btn.style.padding = "10px 20px"
      btn.style.borderRadius = "5px"
      btn.style.marginLeft = "10px"
      btn.onclick = () => {
        if (chrome?.runtime?.id) {
          chrome.runtime.sendMessage({ 
            action: "START_AUTOMATION", 
            platform: "linkedin",
            data: {
              id: `linkedin-${Date.now()}`,
              title: this.extractJobDetails().title,
              company: this.extractJobDetails().company,
              job_url: window.location.href,
              platform: "linkedin"
            }
          })
        } else {
          console.error("Kaamlee extension context invalidated. Please reload the page.")
          alert("Extension updated. Please reload the page to continue.")
        }
      }
      container.appendChild(btn)
    }
  }

  private getVisibleButtons(): HTMLButtonElement[] {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']")).filter((button) => {
      const rect = button.getBoundingClientRect()
      const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(button).display !== 'none';
      return isVisible && !(button as HTMLButtonElement).disabled
    }) as HTMLButtonElement[]
    return buttons;
  }

  private findButton(labels: string[]): HTMLButtonElement | null {
    const normalizedLabels = labels.map((label) => label.toLowerCase())

    // 1. Try finding by text/aria-label in all buttons
    const btn = this.getVisibleButtons().find((button) => {
      const text = button.innerText?.trim().toLowerCase() || ""
      const ariaLabel = button.getAttribute("aria-label")?.toLowerCase() || ""
      return normalizedLabels.some((label) => text.includes(label) || ariaLabel.includes(label))
    })
    if (btn) return btn

    // 2. Try finding by specific LinkedIn Easy Apply classes
    const easyApplyClasses = [
      ".jobs-apply-button",
      ".jobs-apply-button--top-card button",
      "button.jobs-apply-button"
    ]
    for (const cls of easyApplyClasses) {
      const el = document.querySelector(cls) as HTMLButtonElement
      if (el && el.offsetParent !== null && !el.disabled) {
        const text = el.innerText?.toLowerCase() || ""
        if (text.includes("apply")) return el
      }
    }

    return null
  }

  private async waitForButton(labels: string[], timeout = 30000): Promise<HTMLButtonElement | null> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const button = this.findButton(labels)
      if (button) return button
      await sleep(500)
    }
    return null
  }

  private getLinkedInError(): string | null {
    return (
      document.querySelector(
        ".artdeco-inline-feedback--error, .fb-dash-form-element__error-text, .jobs-easy-apply-content [role='alert'], .jobs-easy-apply-error-section"
      )?.textContent?.trim() || null
    )
  }

  private hasApplicationConfirmation(): boolean {
    const text = document.body.innerText.toLowerCase()
    return (
      text.includes("application submitted") ||
      text.includes("your application was sent") ||
      text.includes("your application has been submitted") ||
      text.includes("application has been sent")
    )
  }

  async submitForm(): Promise<SubmitResult> {
    this.isAborted = false // Reset abort state
    console.log("Kaamlee: Starting LinkedIn automation...");

    // Fast check for both Easy Apply and External Apply
    const start = Date.now()
    const timeout = 15000
    while (Date.now() - start < timeout) {
      if (this.isAborted) return { submitted: false, message: "Automation aborted" }

      const easyApplyBtn = this.findButton(["easy apply"])
      if (easyApplyBtn) {
        console.log("Kaamlee: Found Easy Apply button, clicking...");
        await this.clickElement(easyApplyBtn)
        await sleep(2500) // Wait for modal to open
        break
      }

      const externalBtn = this.getVisibleButtons().find(btn => {
        const text = btn.innerText?.toLowerCase() || ""
        // It's external if it says "apply" but NOT "easy apply"
        return (text.includes("apply") || text.includes("company site")) && !text.includes("easy")
      })

      if (externalBtn) {
        console.log("Kaamlee: External employer site detected (via 'Apply' without 'Easy').");
        return { submitted: false, message: "External employer site - skipping" }
      }

      await sleep(1000)
    }

    // Re-check for Easy Apply if we broke out or timed out
    const easyApplyBtn = this.findButton(["easy apply"])
    if (!easyApplyBtn) {
      const allButtons = this.getVisibleButtons().map(b => b.innerText?.trim() || "unlabeled").join(", ")
      console.log(`Kaamlee: Easy Apply button NOT found. Visible buttons: [${allButtons}]`);
      return { submitted: false, message: "No LinkedIn Easy Apply button found" }
    }

    let submitClicked = false
    let lastClickedBtn: HTMLButtonElement | null = null
    let repeatCount = 0

    for (let step = 0; step < 30; step += 1) {
      if (this.isAborted) return { submitted: false, message: "Automation aborted" }
      console.log(`Kaamlee: Step ${step}/30`);

      if (this.hasApplicationConfirmation()) {
        console.log("Kaamlee: Confirmation detected!");
        return { submitted: true, message: "Submitted on LinkedIn" }
      }

      const error = this.getLinkedInError()
      if (error) {
        console.log(`Kaamlee: LinkedIn error found: ${error}`);
        return { submitted: false, message: `LinkedIn error: ${error}` }
      }

      const buttons = [
        { label: ["submit application"], isSubmit: true },
        { label: ["review your application", "review"], isSubmit: false },
        { label: ["continue to next step", "next", "continue"], isSubmit: false },
        { label: ["done", "dismiss"], isSubmit: false }
      ]

      let actionTaken = false
      for (const btnDef of buttons) {
        const btn = this.findButton(btnDef.label)
        if (btn) {
          console.log(`Kaamlee: Found ${btnDef.label.join("/")} button`);
          
          if (btnDef.label.includes("done") || btnDef.label.includes("dismiss")) {
            if (submitClicked || this.hasApplicationConfirmation()) {
              return { submitted: true, message: "Submitted on LinkedIn" }
            }
            return { submitted: false, message: "LinkedIn stopped before submit confirmation" }
          }

          if (btn === lastClickedBtn) {
            repeatCount++
            if (repeatCount > 3) {
              console.log("Kaamlee: Stuck on same button, aborting.");
              return { submitted: false, message: "Stuck on same button" }
            }
          } else {
            repeatCount = 0
            lastClickedBtn = btn
          }

          await this.clickElement(btn)
          if (btnDef.isSubmit) {
            submitClicked = true
            console.log("Kaamlee: Submit button clicked!");
          }
          actionTaken = true
          await sleep(2500)
          break
        }
      }

      if (!actionTaken) {
        await sleep(1000)
      }
    }

    return {
      submitted: false,
      message: submitClicked
        ? "Clicked submit, but LinkedIn did not show confirmation"
        : "LinkedIn Easy Apply form needs manual input"
    }
  }
}
