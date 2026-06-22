'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Phone, Link as LinkIcon, Loader2, Save, CheckCircle2, Briefcase, X, Receipt, MessageSquare } from 'lucide-react';
import FeedbackModal from '@/components/FeedbackModal';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

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
        setSuccess(true);
        setResume(null); // Clear local file after success
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
