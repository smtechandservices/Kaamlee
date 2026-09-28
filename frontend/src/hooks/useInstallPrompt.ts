'use client';

import { useSyncExternalStore } from 'react';

// Chrome/Edge/Android fire `beforeinstallprompt` once per page load, often
// before any install button has mounted. We capture it at module load (this
// module is imported by ServiceWorkerRegister in the root layout) and expose
// it through a tiny external store.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * - `available`: browser supports a native install prompt (Chrome, Edge, Android)
 * - `ios`: iPhone/iPad — no prompt API, user must use Share → Add to Home Screen
 * - `installed`: already running as the installed app
 * - `unavailable`: anything else (Firefox, desktop Safari, or criteria not met)
 */
export type InstallStatus = 'available' | 'ios' | 'installed' | 'unavailable';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // suppress Chrome's own mini-infobar; we show our button instead
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so also check for touch.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function getSnapshot(): InstallStatus {
  if (installed || isStandalone()) return 'installed';
  if (deferredPrompt) return 'available';
  if (isIOS()) return 'ios';
  return 'unavailable';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function install() {
  const event = deferredPrompt;
  if (!event) return;
  // The captured event can only be used once.
  deferredPrompt = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') {
    installed = true;
    notify();
  }
}

export function useInstallPrompt() {
  const status = useSyncExternalStore(subscribe, getSnapshot, () => 'unavailable' as InstallStatus);
  return { status, install };
}
