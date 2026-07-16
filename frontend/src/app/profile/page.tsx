'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Phone, Link as LinkIcon, Loader2, Save, CheckCircle2, Briefcase, X, Globe, ExternalLink } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import SidebarToggle from '@/components/SidebarToggle';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

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

export default function ProfilePage() {
  const { user, token, refreshUser, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Resume card state — separate from the personal details form above
  const [resume, setResume] = useState<File | null>(null);
  const [isSubmittingResume, setIsSubmittingResume] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [resumeSuccess, setResumeSuccess] = useState(false);
  const [localResumePreview, setLocalResumePreview] = useState<string | null>(null);

  // Portfolio state
  const [portfolioPublic, setPortfolioPublic] = useState(false);
  const [portfolioTemplate, setPortfolioTemplate] = useState<Template>('classic');
  const [portfolioTheme, setPortfolioTheme] = useState<Theme>('noir');
  const [portfolioHasResume, setPortfolioHasResume] = useState(false);
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [portfolioSuccess, setPortfolioSuccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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

  // Local object URL for a newly-selected (not yet saved) resume file, so
  // the inline preview updates immediately without waiting on a save.
  useEffect(() => {
    if (!resume) {
      setLocalResumePreview(null);
      return;
    }
    const url = URL.createObjectURL(resume);
    setLocalResumePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [resume]);

  const resumePreviewUrl = localResumePreview || user?.resume || null;

  const handleTogglePublic = async () => {
    const next = !portfolioPublic;
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

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          linkedin_url: linkedinUrl,
        }),
      });

      if (response.ok) {
        await refreshUser();
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

  const handleSubmitResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume) return;
    setIsSubmittingResume(true);
    setResumeError('');
    setResumeSuccess(false);

    try {
      const formData = new FormData();
      formData.append('resume', resume);

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
        setResumeSuccess(true);
        setTimeout(() => setResumeSuccess(false), 3000);
      } else {
        const data = await response.json();
        setResumeError(data.detail || 'Failed to update resume.');
      }
    } catch (err) {
      setResumeError('An error occurred. Please try again.');
    } finally {
      setIsSubmittingResume(false);
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
    <main className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-[#222] px-4 sm:px-6 flex items-center justify-between glass z-20 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 overflow-hidden">
            <Link href="/explore" className="group flex md:hidden items-center gap-1.5 sm:gap-2 text-[#555] hover:text-white transition-colors mr-1 sm:mr-2 shrink-0">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] hidden sm:inline">Back</span>
            </Link>
            <div className="w-px h-4 bg-[#222] mr-1 sm:mr-2 shrink-0 md:hidden" />
            <h1 className="hidden sm:inline text-lg sm:text-xl font-black tracking-tighter text-white mr-2 sm:mr-4 cursor-default truncate">KAAMLEE</h1>
          </div>
          <SidebarToggle />
        </header>

        <div className="flex-1 overflow-y-auto p-6 relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto z-10 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Personal Details card */}
        <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Personal Details</h2>
          </div>

          <form onSubmit={handleSubmitDetails} className="space-y-6">
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

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer w-full bg-white text-black font-black uppercase tracking-widest py-3.5 sm:py-4 rounded-xl sm:rounded-2xl hover:bg-[#ededed] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm"
              >
                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Resume card */}
        <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Briefcase className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Resume</h2>
          </div>

          <form onSubmit={handleSubmitResume} className="space-y-6">
            {resumeError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-4 px-5 rounded-2xl">
                {resumeError}
              </div>
            )}

            {resumeSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm py-4 px-5 rounded-2xl flex items-center gap-3"
              >
                <CheckCircle2 size={18} />
                Resume updated successfully!
              </motion.div>
            )}

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
                  <div className="relative w-full h-[300px] sm:h-[400px] rounded-xl sm:rounded-2xl overflow-hidden border border-[#222] bg-white">
                    <iframe src={resumePreviewUrl || undefined} className="w-full h-full" title="Resume preview" />
                    <button
                      type="button"
                      onClick={async () => {
                        if (resume) {
                          setResume(null);
                        } else if (user?.resume) {
                          if (confirm('Are you sure you want to remove your current resume? This will disable AI job matching.')) {
                            // Call API to remove
                            setIsSubmittingResume(true);
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
                                setResumeSuccess(true);
                                setTimeout(() => setResumeSuccess(false), 3000);
                              }
                            } catch (e) {
                              setResumeError('Failed to remove resume');
                            } finally {
                              setIsSubmittingResume(false);
                            }
                          }
                        }
                      }}
                      className="cursor-pointer absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#0a0a0a]/90 border border-[#222] text-[#888] hover:text-red-400 hover:border-red-500/30 backdrop-blur-sm transition-colors"
                      title="Remove Resume"
                    >
                      <X className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                )}

                {resume && (
                  <p className="text-[9px] sm:text-[10px] text-green-500/60 mt-1 sm:mt-2 ml-1 italic">
                    Click &quot;Update Resume&quot; to upload the new file.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={isSubmittingResume || !resume}
                className="cursor-pointer w-full bg-white text-black font-black uppercase tracking-widest py-3.5 sm:py-4 rounded-xl sm:rounded-2xl hover:bg-[#ededed] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm"
              >
                {isSubmittingResume ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5" />}
                Update Resume
              </button>
            </div>
          </form>
        </div>

        {/* Portfolio card */}
        <div className="md:col-span-2 bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 md:p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Public Portfolio</h2>
          </div>

          {!portfolioHasResume ? (
            <div className="bg-[#0a0a0a] border border-dashed border-[#333] rounded-2xl p-6 text-center">
              <Briefcase className="w-8 h-8 text-[#444] mx-auto mb-3" />
              <p className="text-xs text-[#555] font-medium">Upload a resume below to unlock your public portfolio.</p>
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
                <button type="button" onClick={handleTogglePublic} disabled={isTogglingPublic}
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${portfolioPublic ? 'bg-green-500' : 'bg-[#333]'}`}>
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
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://kaamlee.in/portfolio/${user.username}`);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className="cursor-pointer flex items-center gap-1 text-[10px] text-[#888] hover:text-white font-bold uppercase tracking-widest">
                      {linkCopied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <LinkIcon className="w-3 h-3" />}
                      {linkCopied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const token = sessionStorage.getItem('kaamlee_token');
                        if (token) localStorage.setItem('kaamlee_edit_token', token);
                        window.open(`/portfolio/${user.username}?edit=1`, '_blank');
                      }}
                      className="cursor-pointer flex items-center gap-1 text-[10px] text-green-500 hover:text-green-400 font-bold uppercase tracking-widest">
                      <ExternalLink className="w-3 h-3" /> Preview
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Template + theme picker */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest">Choose a template</p>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map((tmpl) => (
                    <button key={tmpl.id} type="button" onClick={() => {
                        setPortfolioTemplate(tmpl.id);
                        const validThemeIds = tmpl.themes.map(th => th.id);
                        if (validThemeIds.length && !validThemeIds.includes(portfolioTheme)) {
                          setPortfolioTheme(validThemeIds[0]);
                        }
                      }}
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
                {TEMPLATES.find(t => t.id === portfolioTemplate)!.themes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-3">Color theme</p>
                    <div className="grid grid-cols-2 gap-3">
                      {TEMPLATES.find(t => t.id === portfolioTemplate)!.themes.map((th) => (
                        <button key={th.id} type="button" onClick={() => setPortfolioTheme(th.id)}
                          className={`cursor-pointer rounded-2xl p-4 text-left transition-all border ${
                            portfolioTheme === th.id ? 'border-green-500 bg-green-500/5' : 'border-[#222] bg-[#0a0a0a] hover:border-[#333]'
                          }`}>
                          <div className="w-full h-8 rounded-lg mb-3 relative overflow-hidden"
                            style={{ background: th.dark ? '#0a0a0a' : '#f5f5f5', border: `1px solid ${th.dark ? '#222' : '#e0e0e0'}` }}>
                            <span className="absolute right-1.5 top-1.5 w-3 h-3 rounded-full" style={{ background: th.accent }} />
                          </div>
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
        </div>
      </div>
        </div>
      </div>
    </main>
  );
}
