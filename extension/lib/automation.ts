import { humanType, waitForElement, selectOption, sleep } from "./dom"

export type FieldType = "text" | "textarea" | "select" | "radio" | "checkbox" | "file"

export interface FormFieldSpec {
  selector: string
  type: FieldType
  value: string
}

/** Classify a question label into a known answer key */
export const classifyQuestion = (label: string): string => {
  const l = label.toLowerCase()
  if (l.includes("year") && l.includes("experience")) return "experience_years"
  if (l.includes("sponsor")) return "sponsorship"
  if (l.includes("relocat")) return "relocation"
  if (l.includes("salary") || l.includes("compensation")) return "salary"
  if (l.includes("authorized") || l.includes("authorised")) return "work_authorization"
  if (l.includes("linkedin")) return "linkedin_url"
  if (l.includes("website") || l.includes("portfolio")) return "portfolio_url"
  if (l.includes("cover letter")) return "cover_letter"
  return "generic"
}

/** Fill a single field */
export const fillField = async (spec: FormFieldSpec): Promise<void> => {
  const el = await waitForElement(spec.selector)
  if (!el) return

  if (spec.type === "text" || spec.type === "textarea") {
    await humanType(el as HTMLInputElement, spec.value)
  } else if (spec.type === "select") {
    selectOption(spec.selector, spec.value)
  } else if (spec.type === "radio") {
    const radios = document.querySelectorAll<HTMLInputElement>(spec.selector)
    for (const r of radios) {
      if (r.value.toLowerCase() === spec.value.toLowerCase() || r.labels?.[0]?.textContent?.toLowerCase().includes(spec.value.toLowerCase())) {
        r.click()
        break
      }
    }
  } else if (spec.type === "checkbox") {
    const cb = el as HTMLInputElement
    if (!cb.checked) cb.click()
  }
}

/** Fill multiple fields with randomised delays */
export const fillForm = async (fields: FormFieldSpec[]): Promise<void> => {
  for (const field of fields) {
    await fillField(field)
    await sleep(300 + Math.random() * 500)
  }
}
