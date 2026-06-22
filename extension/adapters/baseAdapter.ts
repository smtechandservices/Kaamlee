export interface FormField {
  name: string;
  type: "text" | "select" | "radio" | "checkbox" | "file";
  label: string;
  selector: string;
  options?: string[];
}

export interface Adapter {
  platformName: string;
  detectJobPage(): boolean;
  extractJobDetails(): any;
  injectApplyButton(): void;
  fillField(field: FormField, value: string): Promise<void>;
  submitForm(): Promise<void>;
}

export abstract class BaseAdapter implements Adapter {
  abstract platformName: string;
  abstract detectJobPage(): boolean;
  abstract extractJobDetails(): any;
  abstract injectApplyButton(): void;

  async fillField(field: FormField, value: string): Promise<void> {
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

  abstract submitForm(): Promise<void>;
}
