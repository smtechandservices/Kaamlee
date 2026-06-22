export interface FormField {
  name: string;
  type: "text" | "select" | "radio" | "checkbox" | "file";
  label: string;
  selector: string;
  options?: string[];
}

export interface SubmitResult {
  submitted: boolean;
  message?: string;
}

export interface Adapter {
  platformName: string;
  detectJobPage(): boolean;
  extractJobDetails(): any;
  injectApplyButton(): void;
  fillField(field: FormField, value: string): Promise<void>;
  submitForm(): Promise<SubmitResult>;
}

export abstract class BaseAdapter implements Adapter {
  abstract platformName: string;
  abstract detectJobPage(): boolean;
  abstract extractJobDetails(): any;
  abstract injectApplyButton(): void;

  protected isAborted = false;

  abort(): void {
    this.isAborted = true;
  }

  async fillField(field: FormField, value: string): Promise<void> {
    if (this.isAborted) return;
    const element = document.querySelector(field.selector) as HTMLInputElement;
    if (!element) return;

    if (field.type === "text") {
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (field.type === "select") {
      (element as unknown as HTMLSelectElement).value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    // ... handle other types
  }

  protected async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  protected async clickElement(el: HTMLElement) {
    console.log(`Kaamlee: Clicking element`, el);
    el.click();
    // Dispatch mouse events for better compatibility with framework-heavy sites (like LinkedIn)
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  abstract submitForm(): Promise<SubmitResult>;
}
