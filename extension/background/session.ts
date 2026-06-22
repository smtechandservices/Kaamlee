export interface SessionState {
  isRunning: boolean
  isPaused: boolean
  currentPlatform: string | null
  applicationsToday: number
  lastActivity: string | null
}

let state: SessionState = {
  isRunning: false,
  isPaused: false,
  currentPlatform: null,
  applicationsToday: 0,
  lastActivity: null,
}

export const getState = (): SessionState => ({ ...state })

export const setState = (partial: Partial<SessionState>): void => {
  state = { ...state, ...partial }
}

export const resetSession = (): void => {
  state = {
    isRunning: false,
    isPaused: false,
    currentPlatform: null,
    applicationsToday: 0,
    lastActivity: null,
  }
}
