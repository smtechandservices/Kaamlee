const STORAGE_KEY = 'kaamlee_referral';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — matches typical ambassador outreach cycles

export function captureReferralCode() {
  if (typeof window === 'undefined') return;
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (!ref) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: ref, savedAt: Date.now() }));
}

export function getReferralCode(): string {
  if (typeof window === 'undefined') return '';
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return '';
  try {
    const { code, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return '';
    }
    return code || '';
  } catch {
    return '';
  }
}
