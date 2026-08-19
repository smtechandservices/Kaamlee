'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Save, CheckCircle2, Briefcase, Globe, ExternalLink, Link as LinkIcon } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import PricingModal from '@/components/PricingModal';
import Link from 'next/link';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG, SECONDARY_BTN_CLS, CARD_CLS } from '@/components/ui/landing-kit';

type Template = 'classic' | 'bento';
type Theme = 'minimal' | 'noir' | 'noir-violet' | 'minimal-violet' | 'noir-blue' | 'minimal-blue';

const TEMPLATES: {
  id: Template; label: string; preview: string; themes: { id: Theme; label: string; dark: boolean; accent: string }[];
}[] = [
  {
    id: 'classic', label: 'Classic',
    preview: 'Timeless layout with clean sections',
    themes: [
      { id: 'noir',    label: 'Noir',    dark: true,  accent: '#444' },
      { id: 'minimal', label: 'Minimal', dark: false, accent: '#ccc' },
    ],
  },
  {
    id: 'bento', label: 'Bento',
    preview: 'Asymmetric grid · glassmorphism',
    themes: [
      { id: 'noir-violet',    label: 'Noir Violet',    dark: true,  accent: '#7c3aed' },
      { id: 'minimal-violet', label: 'Minimal Violet', dark: false, accent: '#7c3aed' },
      { id: 'noir-blue',      label: 'Noir Blue',       dark: true,  accent: '#3b82f6' },
      { id: 'minimal-blue',   label: 'Minimal Blue',    dark: false, accent: '#2563eb' },
    ],
  },
];

export default function PortfolioSettingsPage() {
  const { user, token } = useAuth();
  const { isReady, isSubscribed } = useSubscriptionGate({ allowUnsubscribed: true });

  const [portfolioPublic, setPortfolioPublic] = useState(false);
  const [portfolioTemplate, setPortfolioTemplate] = useState<Template>('classic');
  const [portfolioTheme, setPortfolioTheme] = useState<Theme>('noir');
  const [portfolioHasResume, setPortfolioHasResume] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [portfolioSuccess, setPortfolioSuccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    setIsFetching(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/me/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setPortfolioPublic(d.is_public ?? false);
        setPortfolioTemplate(TEMPLATES.some(t => t.id === d.template) ? d.template : 'classic');
        setPortfolioTheme(d.theme ?? 'noir');
        setPortfolioHasResume(d.has_resume ?? false);
      })
      .catch(() => {})
      .finally(() => setIsFetching(false));
  }, [token]);

  const handleSelectTemplate = (tmpl: typeof TEMPLATES[number]) => {
    if (!isSubscribed && tmpl.id !== portfolioTemplate) {
      setIsPricingOpen(true);
      return;
    }
    setPortfolioTemplate(tmpl.id);
    const validThemeIds = tmpl.themes.map((th) => th.id);
    if (validThemeIds.length && !validThemeIds.includes(portfolioTheme)) {
      setPortfolioTheme(validThemeIds[0]);
    }
  };

  const handleSelectTheme = (themeId: Theme) => {
    if (!isSubscribed && themeId !== portfolioTheme) {
      setIsPricingOpen(true);
      return;
    }
    setPortfolioTheme(themeId);
  };

  const handleTogglePublic = async () => {
    const next = !portfolioPublic;
    if (next && !isSubscribed) {
      setIsPricingOpen(true);
      return;
    }
    setPortfolioPublic(next);
    setIsTogglingPublic(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/me/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({ is_public: next }),
      });
      setPortfolioSuccess(true);
      setTimeout(() => setPortfolioSuccess(false), 3000);
    } catch {
      setPortfolioPublic(!next);
    } finally {
      setIsTogglingPublic(false);
    }
  };

  const handleSavePortfolio = async () => {
    setIsSavingPortfolio(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/me/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({ is_public: portfolioPublic, template: portfolioTemplate, theme: portfolioTheme }),
      });
      setPortfolioSuccess(true);
      setTimeout(() => setPortfolioSuccess(false), 3000);
    } catch {
    } finally {
      setIsSavingPortfolio(false);
    }
  };

  if (!isReady) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#16a34a] animate-spin" />
      </div>
    );
  }

  return (
    <main className="h-screen flex bg-[#f2f3f5] text-[#0b0b0c] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/dashboard" title="Portfolio" />

        {!isSubscribed && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 bg-[#16a34a]/10 border-b border-[#16a34a]/20 shrink-0">
            <span className="text-[10px] sm:text-[11px] text-[#16a34a] font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
              Subscribe to make your portfolio public.
            </span>
            <button
              onClick={() => setIsPricingOpen(true)}
              className="cursor-pointer shrink-0 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold text-white transition-transform hover:-translate-y-0.5"
              style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}
            >
              Unlock
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#16a34a]/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="mx-auto z-10 relative">
            <div className={`${CARD_CLS} p-6 sm:p-8 md:p-10`}>
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-5 h-5 text-[#16a34a]" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>Public Portfolio</h2>
              </div>

              {isFetching ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-[#16a34a] animate-spin" />
                </div>
              ) : !portfolioHasResume ? (
                <div className="bg-[#f2f3f5] border border-dashed border-black/[0.12] rounded-2xl p-6 text-center">
                  <Briefcase className="w-8 h-8 text-black/25 mx-auto mb-3" />
                  <p className="text-xs text-[rgba(61,61,61,0.72)] font-medium mb-4">Upload a resume to unlock your public portfolio.</p>
                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-1 text-[10px] text-[#16a34a] hover:text-[#15803d] font-bold uppercase tracking-widest"
                    style={{ fontFamily: 'var(--font-outfit)' }}
                  >
                    Go to profile <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {portfolioSuccess && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="bg-[#16a34a]/10 border border-[#16a34a]/20 text-[#15803d] text-sm py-3 px-5 rounded-2xl flex items-center gap-3">
                      <CheckCircle2 size={16} /> Portfolio settings saved!
                    </motion.div>
                  )}

                  {/* Public toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>Make portfolio public</p>
                      <p className="text-[10px] text-black/45 mt-0.5">
                        {!isSubscribed && !portfolioPublic ? 'Subscribe to unlock' : 'Anyone with your link can view it'}
                      </p>
                    </div>
                    <button type="button" onClick={handleTogglePublic} disabled={isTogglingPublic}
                      className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${portfolioPublic ? 'bg-[#16a34a]' : 'bg-black/15'}`}>
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${portfolioPublic ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* Portfolio link */}
                  {user?.username && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-[#f2f3f5] border border-black/[0.08] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-black/55 truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
                        kaamlee.in/portfolio/{user.username}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`https://kaamlee.in/portfolio/${user.username}`);
                            setLinkCopied(true);
                            setTimeout(() => setLinkCopied(false), 2000);
                          }}
                          className={`cursor-pointer ${SECONDARY_BTN_CLS} !px-3.5 !py-1.5 !text-[11px]`}
                          style={{ fontFamily: 'var(--font-outfit)' }}>
                          {linkCopied ? <CheckCircle2 className="w-3 h-3 text-[#16a34a]" /> : <LinkIcon className="w-3 h-3" />}
                          {linkCopied ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const authToken = sessionStorage.getItem('kaamlee_token');
                            if (authToken) localStorage.setItem('kaamlee_edit_token', authToken);
                            window.open(`/portfolio/${user.username}?edit=1`, '_blank');
                          }}
                          className={`cursor-pointer ${SECONDARY_BTN_CLS} !px-3.5 !py-1.5 !text-[11px]`}
                          style={{ fontFamily: 'var(--font-outfit)' }}>
                          <ExternalLink className="w-3 h-3" /> Preview
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Template + theme picker */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-semibold text-black/45 uppercase tracking-widest" style={{ fontFamily: 'var(--font-outfit)' }}>Choose a template</p>
                    <div className="grid grid-cols-2 gap-3">
                      {TEMPLATES.map((tmpl) => (
                        <button key={tmpl.id} type="button" onClick={() => handleSelectTemplate(tmpl)}
                          className={`cursor-pointer rounded-2xl p-4 text-left transition-all border ${
                            portfolioTemplate === tmpl.id ? 'border-[#16a34a] bg-[#16a34a]/5' : 'border-black/[0.08] bg-[#f2f3f5] hover:border-black/20'
                          } ${!isSubscribed && tmpl.id !== portfolioTemplate ? 'opacity-50' : ''}`}>
                          {/* Mini preview */}
                          {tmpl.id === 'bento' ? (
                            <div className="w-full h-12 rounded-lg mb-3 overflow-hidden"
                              style={{ background: '#07070c', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <div className="w-full h-full grid grid-cols-3 gap-[3px] p-[4px]">
                                {[2, 1, 1, 2, 1, 1, 1].map((span, i) => (
                                  <div key={i} className={`rounded-[3px] col-span-${span}`}
                                    style={{ background: i === 0 ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-12 rounded-lg mb-3 overflow-hidden flex"
                              style={{ background: '#0a0a0a', border: '1px solid #1f1f1f' }}>
                              <div className="w-8 h-full flex flex-col justify-center items-center gap-1"
                                style={{ background: '#111', borderRight: '1px solid #1f1f1f' }}>
                                <div className="w-3 h-3 rounded-sm" style={{ background: '#2a2a2a' }} />
                                <div className="w-4 h-0.5 rounded-full" style={{ background: '#444' }} />
                              </div>
                              <div className="flex-1 flex flex-col justify-center gap-1 px-2">
                                <div className="h-1 rounded-full w-10" style={{ background: '#2a2a2a' }} />
                                <div className="h-1 rounded-full w-8" style={{ background: '#1f1f1f' }} />
                              </div>
                            </div>
                          )}
                          <p className="text-xs font-semibold text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>{tmpl.label}</p>
                          <p className="text-[9px] text-black/45 mt-0.5">{tmpl.preview}</p>
                        </button>
                      ))}
                    </div>

                    {/* Theme picker — only for templates that have theme variants */}
                    {(TEMPLATES.find(t => t.id === portfolioTemplate) ?? TEMPLATES[0]).themes.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-black/45 uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>Color theme</p>
                        <div className="grid grid-cols-2 gap-3">
                          {(TEMPLATES.find(t => t.id === portfolioTemplate) ?? TEMPLATES[0]).themes.map((th) => (
                            <button key={th.id} type="button" onClick={() => handleSelectTheme(th.id)}
                              className={`cursor-pointer rounded-2xl p-4 text-left transition-all border ${
                                portfolioTheme === th.id ? 'border-[#16a34a] bg-[#16a34a]/5' : 'border-black/[0.08] bg-[#f2f3f5] hover:border-black/20'
                              } ${!isSubscribed && th.id !== portfolioTheme ? 'opacity-50' : ''}`}>
                              <div className="w-full h-8 rounded-lg mb-3 relative overflow-hidden"
                                style={{ background: th.dark ? '#0a0a0a' : '#f5f5f5', border: `1px solid ${th.dark ? '#222' : '#e0e0e0'}` }}>
                                <span className="absolute right-1.5 top-1.5 w-3 h-3 rounded-full" style={{ background: th.accent }} />
                              </div>
                              <p className="text-xs font-semibold text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>{th.label}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button type="button" onClick={handleSavePortfolio} disabled={isSavingPortfolio}
                    className={`cursor-pointer ${PRIMARY_BTN_CLS} w-full rounded-xl py-3.5 text-xs font-semibold uppercase tracking-widest`}
                    style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}>
                    {isSavingPortfolio ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                    Save Portfolio Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
    </main>
  );
}
