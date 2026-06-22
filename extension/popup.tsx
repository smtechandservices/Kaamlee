import React, { useEffect, useState } from "react"
import { storage } from "./lib/storage"
import { api } from "./lib/api"

type Screen = "login" | "main"

interface SessionState {
  isRunning: boolean
  isPaused: boolean
  currentPlatform: string | null
  applicationsToday: number
  lastActivity: string | null
}

const defaultSession: SessionState = {
  isRunning: false,
  isPaused: false,
  currentPlatform: null,
  applicationsToday: 0,
  lastActivity: null,
}

export default function Popup() {
  const [screen, setScreen] = useState<Screen>("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [session, setSession] = useState<SessionState>(defaultSession)

  useEffect(() => {
    storage.getToken().then((t) => {
      if (t) setScreen("main")
    })
    chrome.runtime.sendMessage({ action: "GET_STATUS" }, (res) => {
      if (res) setSession(res)
    })
  }, [])

  const handleLogin = async () => {
    try {
      const { token } = await api.login(username, password)
      await storage.setToken(token)
      setScreen("main")
    } catch {
      setError("Invalid credentials. Please try again.")
    }
  }

  const handleLogout = async () => {
    await storage.clearToken()
    setScreen("login")
  }

  const sendControl = (action: string) => {
    chrome.runtime.sendMessage({ action }, (res) => {
      if (res) setSession(res)
    })
  }

  if (screen === "login") {
    return (
      <div style={styles.container}>
        <h2 style={styles.logo}>Kaamlee AI</h2>
        <p style={styles.subtitle}>Sign in to start applying</p>
        {error && <p style={styles.error}>{error}</p>}
        <input
          style={styles.input}
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button style={styles.primaryBtn} onClick={handleLogin}>Login</button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.logo}>Kaamlee AI</h2>
        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div style={styles.statusCard}>
        <span style={{ ...styles.dot, backgroundColor: session.isRunning ? "#4ade80" : "#6b7280" }} />
        <span style={styles.statusText}>
          {session.isRunning
            ? `Running on ${session.currentPlatform}`
            : "Idle — visit a job page"}
        </span>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statBox}>
          <span style={styles.statNum}>{session.applicationsToday}</span>
          <span style={styles.statLabel}>Today</span>
        </div>
      </div>

      {session.lastActivity && (
        <p style={styles.activity}>Last: {session.lastActivity}</p>
      )}

      <div style={styles.controls}>
        {session.isRunning && !session.isPaused && (
          <button style={styles.warnBtn} onClick={() => sendControl("PAUSE_AUTOMATION")}>Pause</button>
        )}
        {session.isPaused && (
          <button style={styles.primaryBtn} onClick={() => sendControl("RESUME_AUTOMATION")}>Resume</button>
        )}
        {session.isRunning && (
          <button style={styles.dangerBtn} onClick={() => sendControl("STOP_AUTOMATION")}>Stop</button>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: 300, padding: 20, fontFamily: "system-ui, sans-serif", background: "#0f172a", color: "#f1f5f9", minHeight: 200 },
  logo: { margin: 0, fontSize: 20, fontWeight: 700, color: "#ff6b6b" },
  subtitle: { margin: "4px 0 16px", fontSize: 13, color: "#94a3b8" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  error: { color: "#f87171", fontSize: 12, marginBottom: 8 },
  input: { width: "100%", padding: "8px 10px", marginBottom: 10, borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#f1f5f9", fontSize: 14, boxSizing: "border-box" },
  primaryBtn: { width: "100%", padding: "10px", borderRadius: 6, background: "#ff6b6b", color: "white", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" },
  logoutBtn: { padding: "4px 10px", borderRadius: 4, background: "transparent", color: "#94a3b8", border: "1px solid #334155", cursor: "pointer", fontSize: 12 },
  warnBtn: { flex: 1, padding: "8px", borderRadius: 6, background: "#f59e0b", color: "#0f172a", fontWeight: 600, border: "none", cursor: "pointer" },
  dangerBtn: { flex: 1, padding: "8px", borderRadius: 6, background: "#ef4444", color: "white", fontWeight: 600, border: "none", cursor: "pointer" },
  statusCard: { display: "flex", alignItems: "center", gap: 8, padding: 12, background: "#1e293b", borderRadius: 8, marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  statusText: { fontSize: 13, color: "#cbd5e1" },
  statsRow: { display: "flex", gap: 10, marginBottom: 12 },
  statBox: { flex: 1, padding: 10, background: "#1e293b", borderRadius: 8, textAlign: "center" },
  statNum: { display: "block", fontSize: 24, fontWeight: 700, color: "#ff6b6b" },
  statLabel: { fontSize: 11, color: "#94a3b8" },
  activity: { fontSize: 11, color: "#64748b", marginBottom: 12 },
  controls: { display: "flex", gap: 8 },
}
