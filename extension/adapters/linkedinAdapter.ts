import { BaseAdapter } from "./baseAdapter"

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
        chrome.runtime.sendMessage({ action: "START_AUTOMATION", platform: "linkedin" })
      }
      container.appendChild(btn)
    }
  }

  async submitForm(): Promise<void> {
    return new Promise((resolve) => {
      // 1. Find and click the Easy Apply button
      const buttons = Array.from(document.querySelectorAll("button"));
      const easyApplyBtn = buttons.find(b => b.innerText.includes("Easy Apply"));
      
      if (!easyApplyBtn) {
        console.log("No Easy Apply button found.");
        resolve();
        return;
      }
      
      easyApplyBtn.click();

      // 2. Loop to click through the form modals
      const interval = setInterval(() => {
        const nextBtn = document.querySelector("button[aria-label='Continue to next step']") as HTMLButtonElement;
        const reviewBtn = document.querySelector("button[aria-label='Review your application']") as HTMLButtonElement;
        const submitBtn = document.querySelector("button[aria-label='Submit application']") as HTMLButtonElement;
        const doneBtn = document.querySelector("button span.artdeco-button__text") as HTMLSpanElement;

        if (submitBtn) {
          submitBtn.click();
          clearInterval(interval);
          setTimeout(resolve, 3000);
        } else if (reviewBtn) {
          reviewBtn.click();
        } else if (nextBtn) {
          nextBtn.click();
        } else if (doneBtn && doneBtn.innerText === "Done") {
          // If we reach the "Done" screen, we are finished.
          clearInterval(interval);
          resolve();
        }
      }, 2000); // Check every 2 seconds

      // Safety timeout: stop trying after 30 seconds
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 30000);
    });
  }
}
