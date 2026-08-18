'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Sparkles, Copy, Check, Loader2, RefreshCw, Download, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import PricingModal from '@/components/PricingModal';
import { PRIMARY_BTN_BG } from '@/components/ui/landing-kit';

interface QAPair {
  question: string;
  answer: string;
}

interface ApplicationKit {
  id: number;
  job: number;
  job_title: string;
  company: string;
  cover_letter: string;
  qa: QAPair[];
  created_at: string;
  updated_at: string;
}

interface CoverLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: { id: string | number; title: string; company: string | null };
}

export default function CoverLetterModal({ isOpen, onClose, job }: CoverLetterModalProps) {
  const { token } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const [kit, setKit] = React.useState<ApplicationKit | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isLockedOut, setIsLockedOut] = React.useState(false);
  const [isPricingOpen, setIsPricingOpen] = React.useState(false);
  const [copiedCoverLetter, setCopiedCoverLetter] = React.useState(false);
  const [copiedQaIndex, setCopiedQaIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!isOpen || !token) return;
    setIsLoading(true);
    setError('');
    setIsLockedOut(false);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${job.id}/application-kit/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then(async (r) => {
        if (r.status === 403) {
          setIsLockedOut(true);
          return;
        }
        if (r.status === 404) {
          setKit(null);
          return;
        }
        if (!r.ok) throw new Error('failed');
        setKit(await r.json());
      })
      .catch(() => setError('Could not load your application kit.'))
      .finally(() => setIsLoading(false));
  }, [isOpen, token, job.id]);

  React.useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setKit(null);
        setError('');
        setIsLockedOut(false);
        setCopiedCoverLetter(false);
        setCopiedQaIndex(null);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${job.id}/application-kit/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.status === 403) {
        setIsLockedOut(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate. Please try again.');
        return;
      }
      setKit(data);
    } catch {
      setError('An error occurred while generating. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCoverLetter = () => {
    if (!kit) return;
    navigator.clipboard.writeText(kit.cover_letter);
    setCopiedCoverLetter(true);
    setTimeout(() => setCopiedCoverLetter(false), 2000);
  };

  const handleCopyAnswer = (index: number, answer: string) => {
    navigator.clipboard.writeText(answer);
    setCopiedQaIndex(index);
    setTimeout(() => setCopiedQaIndex(null), 2000);
  };

  const handleDownload = () => {
    if (!kit) return;
    const blob = new Blob([kit.cover_letter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cover_Letter_${(job.company || job.title).replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!mounted) return null;

  const smallBtnCls = 'cursor-pointer px-5 py-2.5 rounded-full border border-black/[0.10] bg-white text-black/55 text-xs font-semibold uppercase tracking-[0.18em] hover:text-[#0b0b0c] hover:border-black/20 transition-all disabled:opacity-50';
  const smallPrimaryBtnCls = 'cursor-pointer inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_24px_-10px_rgba(22,163,74,.85)] transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-[480px] max-h-[80vh] overflow-y-auto custom-scrollbar border border-black/[0.08] bg-white rounded-[28px] p-6 sm:p-8 shadow-[0_30px_80px_-30px_rgba(16,18,26,.35)]"
          >
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#16a34a]/10 rounded-full blur-[60px] pointer-events-none" />

            <button
              onClick={onClose}
              className="cursor-pointer absolute top-5 right-5 text-black/35 hover:text-[#0b0b0c] transition-colors"
            >
              <RotateCcw className="rotate-45 w-4 h-4" />
            </button>

            <div className="relative z-10">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0b0b0c] mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>Cover Letter &amp; Prep</h2>
              <p className="text-black/45 text-xs mb-5 truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
                {job.title}{job.company ? ` · ${job.company}` : ''}
              </p>

              {error && (
                <p className="bg-red-50 border border-red-200 text-red-600 text-xs py-2.5 px-3.5 rounded-xl mb-4">{error}</p>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-[#16a34a] animate-spin" />
                </div>
              ) : isLockedOut ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto mb-4 bg-[#16a34a]/10 rounded-full flex items-center justify-center border border-[#16a34a]/20">
                    <Lock size={18} className="text-[#16a34a]" />
                  </div>
                  <p className="text-sm text-[#0b0b0c] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-outfit)' }}>Premium feature</p>
                  <p className="text-black/45 text-xs mb-5 max-w-[320px] mx-auto leading-relaxed">
                    Subscribe to generate a personalized cover letter and application prep for this job.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={onClose} className={smallBtnCls}>
                      Close
                    </button>
                    <button
                      onClick={() => setIsPricingOpen(true)}
                      className={smallPrimaryBtnCls}
                      style={PRIMARY_BTN_BG}
                    >
                      Unlock
                    </button>
                  </div>
                </div>
              ) : !kit ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto mb-4 bg-[#16a34a]/10 rounded-full flex items-center justify-center border border-[#16a34a]/20">
                    <Sparkles size={20} className="text-[#16a34a]" />
                  </div>
                  <p className="text-black/45 text-xs mb-5 max-w-[320px] mx-auto leading-relaxed">
                    Generate a personalized cover letter and answers to common application questions, based on your resume and this job.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={onClose} className={smallBtnCls}>
                      Close
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className={smallPrimaryBtnCls}
                      style={PRIMARY_BTN_BG}
                    >
                      {isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles size={14} />}
                      {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-black/40" style={{ fontFamily: 'var(--font-outfit)' }}>Cover Letter</p>
                      <div className="flex items-center gap-3">
                        <button onClick={handleDownload} className="cursor-pointer flex items-center gap-1 text-[10px] text-black/45 hover:text-[#0b0b0c] font-semibold uppercase tracking-widest" style={{ fontFamily: 'var(--font-outfit)' }}>
                          <Download className="w-3 h-3" /> Download
                        </button>
                        <button onClick={handleCopyCoverLetter} className="cursor-pointer flex items-center gap-1 text-[10px] text-black/45 hover:text-[#0b0b0c] font-semibold uppercase tracking-widest" style={{ fontFamily: 'var(--font-outfit)' }}>
                          {copiedCoverLetter ? <Check className="w-3 h-3 text-[#16a34a]" /> : <Copy className="w-3 h-3" />}
                          {copiedCoverLetter ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="bg-black/[0.02] border border-black/[0.08] rounded-2xl p-3 max-h-[220px] overflow-y-auto custom-scrollbar text-black/70 text-xs leading-relaxed whitespace-pre-wrap">
                      {kit.cover_letter}
                    </div>
                  </div>

                  {kit.qa && kit.qa.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-black/40 mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>Common Questions</p>
                      <div className="space-y-2">
                        {kit.qa.map((pair, i) => (
                          <div key={i} className="bg-black/[0.02] border border-black/[0.08] rounded-2xl p-3">
                            <div className="flex items-start justify-between gap-3 mb-1.5">
                              <p className="text-[11px] font-semibold text-[#16a34a]" style={{ fontFamily: 'var(--font-outfit)' }}>{pair.question}</p>
                              <button
                                onClick={() => handleCopyAnswer(i, pair.answer)}
                                className="cursor-pointer shrink-0 text-black/35 hover:text-[#0b0b0c] transition-colors"
                              >
                                {copiedQaIndex === i ? <Check className="w-3 h-3 text-[#16a34a]" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            <p className="text-black/60 text-xs leading-relaxed">{pair.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button onClick={onClose} className={smallBtnCls}>
                      Close
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="cursor-pointer flex-1 flex items-center justify-center gap-2 rounded-full border border-black/[0.10] bg-white text-black/55 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] hover:text-[#0b0b0c] hover:border-black/20 transition-all disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {isGenerating ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
