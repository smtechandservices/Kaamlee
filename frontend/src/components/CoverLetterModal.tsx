'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Sparkles, Copy, Check, Loader2, RefreshCw, Download } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

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
  const [kit, setKit] = React.useState<ApplicationKit | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copiedCoverLetter, setCopiedCoverLetter] = React.useState(false);
  const [copiedQaIndex, setCopiedQaIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!isOpen || !token) return;
    setIsLoading(true);
    setError('');
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${job.id}/application-kit/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then(async (r) => {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-[480px] max-h-[80vh] overflow-y-auto custom-scrollbar border border-green-500/20 bg-[#050505] rounded-sm p-6 sm:p-8 shadow-[0_0_100px_-12px_rgba(34,197,94,0.2)]"
          >
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-600/10 rounded-full blur-[60px] pointer-events-none" />

            <button
              onClick={onClose}
              className="cursor-pointer absolute top-5 right-5 text-[#444] hover:text-white transition-colors"
            >
              <RotateCcw className="rotate-45 w-4 h-4" />
            </button>

            <div className="relative z-10 text-white">
              <h2 className="text-lg font-black uppercase tracking-tight mb-1">Cover Letter &amp; Prep</h2>
              <p className="text-[#555] text-xs font-mono uppercase tracking-widest mb-5 truncate">
                {job.title}{job.company ? ` · ${job.company}` : ''}
              </p>

              {error && (
                <p className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2.5 px-3.5 rounded-sm mb-4">{error}</p>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                </div>
              ) : !kit ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto mb-4 bg-green-600/10 rounded-full flex items-center justify-center border border-green-500/20">
                    <Sparkles size={20} className="text-green-500" />
                  </div>
                  <p className="text-[#888] text-xs mb-5 max-w-[320px] mx-auto leading-relaxed">
                    Generate a personalized cover letter and answers to common application questions, based on your resume and this job.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={onClose}
                      className="cursor-pointer px-5 py-2.5 border border-white/10 text-[#888] text-xs font-black uppercase tracking-[0.2em] hover:text-white hover:bg-white/5 transition-all rounded-sm"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="cursor-pointer inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-[#ededed] transition-all rounded-sm disabled:opacity-50"
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
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#444]">Cover Letter</p>
                      <div className="flex items-center gap-3">
                        <button onClick={handleDownload} className="cursor-pointer flex items-center gap-1 text-[10px] text-[#888] hover:text-white font-bold uppercase tracking-widest">
                          <Download className="w-3 h-3" /> Download
                        </button>
                        <button onClick={handleCopyCoverLetter} className="cursor-pointer flex items-center gap-1 text-[10px] text-[#888] hover:text-white font-bold uppercase tracking-widest">
                          {copiedCoverLetter ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          {copiedCoverLetter ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-sm p-3 max-h-[220px] overflow-y-auto custom-scrollbar text-[#ccc] text-xs leading-relaxed whitespace-pre-wrap">
                      {kit.cover_letter}
                    </div>
                  </div>

                  {kit.qa && kit.qa.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#444] mb-2">Common Questions</p>
                      <div className="space-y-2">
                        {kit.qa.map((pair, i) => (
                          <div key={i} className="bg-white/5 border border-white/10 rounded-sm p-3">
                            <div className="flex items-start justify-between gap-3 mb-1.5">
                              <p className="text-[11px] font-bold text-green-400">{pair.question}</p>
                              <button
                                onClick={() => handleCopyAnswer(i, pair.answer)}
                                className="cursor-pointer shrink-0 text-[#555] hover:text-white transition-colors"
                              >
                                {copiedQaIndex === i ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            <p className="text-[#aaa] text-xs leading-relaxed">{pair.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={onClose}
                      className="cursor-pointer px-5 py-2.5 border border-white/10 text-[#888] text-xs font-black uppercase tracking-[0.2em] hover:text-white hover:bg-white/5 transition-all rounded-sm"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="cursor-pointer flex-1 flex items-center justify-center gap-2 border border-white/10 text-[#888] py-2.5 text-xs font-black uppercase tracking-[0.2em] hover:text-white hover:bg-white/5 transition-all rounded-sm disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {isGenerating ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
