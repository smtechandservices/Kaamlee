export const storage = {
  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] ?? null)
      })
    })
  },

  async set(key: string, value: unknown): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve)
    })
  },

  async remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve)
    })
  },

  async getToken(): Promise<string | null> {
    return this.get<string>("kaamlee_token")
  },

  async setToken(token: string): Promise<void> {
    return this.set("kaamlee_token", token)
  },

  async clearToken(): Promise<void> {
    return this.remove("kaamlee_token")
  },
}
