'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Phone, Link as LinkIcon, Loader2, Save, CheckCircle2, Briefcase, X, Receipt, MessageSquare, Globe, ExternalLink } from 'lucide-react';
import FeedbackModal from '@/components/FeedbackModal';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

type Template = 'classic' | 'bento';
type Theme = 'minimal' | 'noir';

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
    preview: 'Asymmetric grid · glassmorphism · violet accent',
    themes: [],
  },
];

export default function ProfilePage() {
  const { user, token, refreshUser, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  
  const [resume, setResume] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Portfolio state
  const [portfolioPublic, setPortfolioPublic] = useState(false);
  const [portfolioTemplate, setPortfolioTemplate] = useState<Template>('classic');
  const [portfolioTheme, setPortfolioTheme] = useState<Theme>('noir');
  const [portfolioHasResume, setPortfolioHasResume] = useState(false);
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);
  const [portfolioSuccess, setPortfolioSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.push('/login');
    }
  }, [token, isAuthLoading, router]);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(user.phone || '');
      setLinkedinUrl(user.linkedin_url || '');
    }
  }, [user]);

  useEffect(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/me/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setPortfolioPublic(d.is_public ?? false);
        setPortfolioTemplate(d.template ?? 'classic');
        setPortfolioTheme(d.theme ?? 'noir');
        setPortfolioHasResume(d.has_resume ?? false);
      })
      .catch(() => {});
  }, [token]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('first_name', firstName);
      formData.append('last_name', lastName);
      formData.append('phone', phone);
      formData.append('linkedin_url', linkedinUrl);
      if (resume) {
        formData.append('resume', resume);
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`
        },
        body: formData,
      });

      if (response.ok) {
        await refreshUser();
        setResume(null);
        // Refresh portfolio state so has_resume reflects the new resume
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/me/`, {
          headers: { Authorization: `Token ${token}` },
        })
          .then((r) => r.json())
          .then((d) => {
            setPortfolioPublic(d.is_public ?? portfolioPublic);
            setPortfolioTemplate(d.template ?? portfolioTemplate);
            setPortfolioTheme(d.theme ?? portfolioTheme);
            setPortfolioHasResume(d.has_resume ?? false);
          })
          .catch(() => {});
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to update profile.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || !token) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-2xl mx-auto z-10 relative pt-8 sm:pt-12">
        <button 
          onClick={(e) => {
            e.preventDefault();
            if (!user?.is_subscribed) {
              router.push('/');
            } else {
              router.push('/explore');
            }
          }}
          className="cursor-pointer inline-flex items-center gap-2 text-[#888] hover:text-white transition-colors mb-4 group text-sm"
        >
          <ArrowLeft className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          Back to Explore
        </button>

        {/* Portfolio card */}
        <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 md:p-10 shadow-2xl mb-4">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Public Portfolio</h2>
          </div>

          {!portfolioHasResume ? (
            <div className="bg-[#0a0a0a] border border-dashed border-[#333] rounded-2xl p-6 text-center">
              <Briefcase className="w-8 h-8 text-[#444] mx-auto mb-3" />
              <p className="text-xs text-[#555] font-medium">Upload a resume above to unlock your public portfolio.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {portfolioSuccess && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm py-3 px-5 rounded-2xl flex items-center gap-3">
                  <CheckCircle2 size={16} /> Portfolio settings saved!
                </motion.div>
              )}

              {/* Public toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Make portfolio public</p>
                  <p className="text-[10px] text-[#555] mt-0.5">Anyone with your link can view it</p>
                </div>
                <button type="button" onClick={() => setPortfolioPublic((v) => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${portfolioPublic ? 'bg-green-500' : 'bg-[#333]'}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${portfolioPublic ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Portfolio link */}
              {user?.username && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-[#555] font-mono truncate">
                    kaamlee.in/portfolio/{user.username}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const token = sessionStorage.getItem('kaamlee_token');
                      if (token) localStorage.setItem('kaamlee_edit_token', token);
                      window.open(`/portfolio/${user.username}?edit=1`, '_blank');
                    }}
                    className="cursor-pointer shrink-0 flex items-center gap-1 text-[10px] text-green-500 hover:text-green-400 font-bold uppercase tracking-widest">
                    <ExternalLink className="w-3 h-3" /> Preview
                  </button>
                </motion.div>
              )}

              {/* Template + theme picker */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest">Choose a template</p>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map((tmpl) => (
                    <button key={tmpl.id} type="button" onClick={() => setPortfolioTemplate(tmpl.id)}
                      className={`cursor-pointer rounded-2xl p-4 text-left transition-all border ${
                        portfolioTemplate === tmpl.id ? 'border-green-500 bg-green-500/5' : 'border-[#222] bg-[#0a0a0a] hover:border-[#333]'
                      }`}>
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
                      <p className="text-xs font-black text-white">{tmpl.label}</p>
                      <p className="text-[9px] text-[#555] mt-0.5">{tmpl.preview}</p>
                    </button>
                  ))}
                </div>

                {/* Theme picker — only for templates that have theme variants */}
                {portfolioTemplate === 'classic' && (
                  <div>
                    <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-3">Color theme</p>
                    <div className="grid grid-cols-2 gap-3">
                      {TEMPLATES.find(t => t.id === 'classic')!.themes.map((th) => (
                        <button key={th.id} type="button" onClick={() => setPortfolioTheme(th.id)}
                          className={`cursor-pointer rounded-2xl p-4 text-left transition-all border ${
                            portfolioTheme === th.id ? 'border-green-500 bg-green-500/5' : 'border-[#222] bg-[#0a0a0a] hover:border-[#333]'
                          }`}>
                          <div className="w-full h-8 rounded-lg mb-3"
                            style={{ background: th.dark ? '#0a0a0a' : '#f5f5f5', border: `1px solid ${th.dark ? '#222' : '#e0e0e0'}` }} />
                          <p className="text-xs font-black text-white">{th.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button type="button" onClick={handleSavePortfolio} disabled={isSavingPortfolio}
                className="cursor-pointer w-full bg-white text-black font-black uppercase tracking-widest py-3.5 rounded-xl hover:bg-[#ededed] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs">
                {isSavingPortfolio ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                Save Portfolio Settings
              </button>
            </div>
          )}
        </div>

        <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 md:p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-4 px-5 rounded-2xl">
                {error}
              </div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm py-4 px-5 rounded-2xl flex items-center gap-3"
              >
                <CheckCircle2 size={18} />
                Profile updated successfully!
              </motion.div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              <div className="space-y-2 sm:space-y-3">
                <label className="text-[10px] sm:text-xs font-bold text-[#555] uppercase tracking-widest ml-1">First Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  <input 
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl sm:rounded-2xl pl-11 sm:pl-12 pr-4 py-3.5 sm:py-4 text-xs sm:text-sm focus:border-green-500/50 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <label className="text-[10px] sm:text-xs font-bold text-[#555] uppercase tracking-widest ml-1">Last Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  <input 
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl sm:rounded-2xl pl-11 sm:pl-12 pr-4 py-3.5 sm:py-4 text-xs sm:text-sm focus:border-green-500/50 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className="text-[10px] sm:text-xs font-bold text-[#555] uppercase tracking-widest ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <input 
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl sm:rounded-2xl pl-11 sm:pl-12 pr-4 py-3.5 sm:py-4 text-xs sm:text-sm focus:border-green-500/50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className="text-[10px] sm:text-xs font-bold text-[#555] uppercase tracking-widest ml-1">LinkedIn URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <input 
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl sm:rounded-2xl pl-11 sm:pl-12 pr-4 py-3.5 sm:py-4 text-xs sm:text-sm focus:border-green-500/50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className="text-[10px] sm:text-xs font-bold text-[#555] uppercase tracking-widest ml-1">Resume (PDF Recommended)</label>
              <div className="relative">
                {!user?.resume && !resume ? (
                  <div className="w-full bg-[#0a0a0a] border border-[#222] border-dashed rounded-xl sm:rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center gap-3 hover:border-green-500/50 transition-all cursor-pointer relative text-center">
                    <Briefcase size={24} className="text-[#444]" />
                    <span className="text-[10px] sm:text-xs font-medium text-[#888]">Click to upload or drag & drop</span>
                    <input 
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setResume(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="w-full bg-[#161616] border border-[#222] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                        <Briefcase className="text-green-500 w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[10px] sm:text-xs font-bold text-white truncate">
                          {resume ? resume.name : (user?.resume ? 'Resume uploaded' : '')}
                        </p>
                        {user?.resume_text && (
                          <p className="text-[9px] sm:text-[10px] text-green-500/60 font-medium">AI Matching Active</p>
                        )}
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={async () => {
                        if (resume) {
                          setResume(null);
                        } else if (user?.resume) {
                          if (confirm('Are you sure you want to remove your current resume? This will disable AI job matching.')) {
                            // Call API to remove
                            setIsSubmitting(true);
                            try {
                              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Token ${token}`
                                },
                                body: JSON.stringify({ resume: null }),
                              });
                              if (res.ok) {
                                await refreshUser();
                                setPortfolioHasResume(false);
                                setSuccess(true);
                                setTimeout(() => setSuccess(false), 3000);
                              }
                            } catch (e) {
                              setError('Failed to remove resume');
                            } finally {
                              setIsSubmitting(false);
                            }
                          }
                        }
                      }}
                      className="cursor-pointer p-1.5 sm:p-2 hover:bg-red-500/10 rounded-lg sm:rounded-xl transition-colors group"
                      title="Remove Resume"
                    >
                      <X className="text-[#444] group-hover:text-red-500 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                )}
                
                {resume && (
                  <p className="text-[9px] sm:text-[10px] text-green-500/60 mt-1 sm:mt-2 ml-1 italic">
                    Click "Save Changes" to upload the new resume.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer w-full bg-white text-black font-black uppercase tracking-widest py-3.5 sm:py-4 rounded-xl sm:rounded-2xl hover:bg-[#ededed] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm"
              >
                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5" />}
                Save Changes
              </button>

              <Link
                href="/transactions"
                className="cursor-pointer w-full mt-4 flex items-center justify-center gap-2 py-3 sm:py-4 text-[#555] hover:text-[#888] transition-colors text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]"
              >
                <Receipt className="w-4 h-4" />
                View Billing History
              </Link>

              <button
                type="button"
                onClick={() => setIsFeedbackModalOpen(true)}
                className="cursor-pointer w-full mt-2 flex items-center justify-center gap-2 py-3 sm:py-4 text-[#444] hover:text-green-500 transition-colors text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]"
              >
                <MessageSquare className="w-4 h-4" />
                Give Feedback
              </button>
            </div>
          </form>
        </div>
      </div>

      <FeedbackModal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} />
    </main>
  );
}
