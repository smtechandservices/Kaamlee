const BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "http://localhost:8000"

const getHeaders = async (): Promise<HeadersInit> => {
  const token = await new Promise<string | null>((resolve) => {
    chrome.storage.local.get(["kaamlee_token"], (result) => {
      resolve(result.kaamlee_token ?? null)
    })
  })

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  }
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { 
      headers: await getHeaders(),
      credentials: "omit"
    })
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
    return res.json()
  },

  async post<T>(path: string, body: object): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify(body),
      credentials: "omit"
    })
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
    return res.json()
  },

  async login(username: string, password: string): Promise<{ token: string }> {
    try {
      const res = await fetch(`${BASE_URL}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "omit"
      })
      if (!res.ok) {
        const errorText = await res.text()
        console.error("Login failed response:", res.status, errorText)
        throw new Error(`Login failed: ${res.status}`)
      }
      return res.json()
    } catch (e) {
      console.error("Fetch login error:", e)
      throw e
    }
  },

  async tailorResume(jobId: string) {
    return this.post("/ai_apply/tailor/", { job_id: jobId })
  },

  async answerQuestions(questions: string[], jobId: string) {
    return this.post("/ai_apply/answer-questions/", { questions, job_id: jobId })
  },

  async createApplication(jobId: string) {
    return this.post("/applications/applications/", { job: jobId, status: "in_progress" })
  },

  async logEvent(applicationId: string, eventType: string, message: string) {
    return this.post(`/applications/applications/${applicationId}/add_event/`, {
      event_type: eventType,
      message,
    })
  },
}
