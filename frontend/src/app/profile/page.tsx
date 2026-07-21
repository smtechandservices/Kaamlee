'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Phone, Link as LinkIcon, Loader2, Save, CheckCircle2, Briefcase, X, AtSign, Lock } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import EmailVerificationGate from '@/components/EmailVerificationGate';
import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
  const { user, token, refreshUser, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  
  const [username, setUsername] = useState('');
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

  // Change Password card state — separate from the personal details form above
  const [otpVerified, setOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.push('/login');
    }
  }, [token, isAuthLoading, router]);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(user.phone || '');
      setLinkedinUrl(user.linkedin_url || '');
    }
  }, [user]);

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
          username,
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
        setError(data.username?.[0] || data.detail || 'Failed to update profile.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpVerified) {
      setPasswordError('Please verify your email before setting a new password.');
      return;
    }
    setIsSubmittingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/change-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setOtpVerified(false);
        setNewPassword('');
        setConfirmPassword('');
        setPasswordSuccess(true);
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        setPasswordError(
          data.new_password?.[0] ||
          data.confirm_password?.[0] ||
          data.non_field_errors?.[0] ||
          data.detail ||
          'Failed to update password.'
        );
      }
    } catch (err) {
      setPasswordError('An error occurred. Please try again.');
    } finally {
      setIsSubmittingPassword(false);
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
        <PageHeader backHref="/explore" title="Profile" wordmark />

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

            <div className="space-y-2 sm:space-y-3">
              <label className="text-[10px] sm:text-xs font-bold text-[#555] uppercase tracking-widest ml-1">Username</label>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl sm:rounded-2xl pl-11 sm:pl-12 pr-4 py-3.5 sm:py-4 text-xs sm:text-sm focus:border-green-500/50 outline-none transition-all"
                />
              </div>
              <p className="text-[9px] sm:text-[10px] text-[#555] ml-1">This is also your public portfolio link: kaamlee.in/portfolio/{username || '...'}</p>
            </div>

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
        </div>

        {/* Change Password card */}
        <div className="mt-4 max-w-xl bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Change Password</h2>
          </div>

          <form onSubmit={handleSubmitPassword} className="space-y-6">
            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-4 px-5 rounded-2xl">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm py-4 px-5 rounded-2xl flex items-center gap-3"
              >
                <CheckCircle2 size={18} />
                Password updated successfully!
              </motion.div>
            )}

            <div className="space-y-2 sm:space-y-3">
              <label className="text-[10px] sm:text-xs font-bold text-[#555] uppercase tracking-widest ml-1">Verify Your Identity</label>
              <EmailVerificationGate
                email={user?.email || ''}
                verified={otpVerified}
                onVerified={() => setOtpVerified(true)}
                onError={setPasswordError}
              />
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className="text-[10px] sm:text-xs font-bold text-[#555] uppercase tracking-widest ml-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl sm:rounded-2xl pl-11 sm:pl-12 pr-4 py-3.5 sm:py-4 text-xs sm:text-sm focus:border-green-500/50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className="text-[10px] sm:text-xs font-bold text-[#555] uppercase tracking-widest ml-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl sm:rounded-2xl pl-11 sm:pl-12 pr-4 py-3.5 sm:py-4 text-xs sm:text-sm focus:border-green-500/50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={isSubmittingPassword || !otpVerified}
                className="cursor-pointer w-full bg-white text-black font-black uppercase tracking-widest py-3.5 sm:py-4 rounded-xl sm:rounded-2xl hover:bg-[#ededed] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm"
              >
                {isSubmittingPassword ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5" />}
                Update Password
              </button>
            </div>
          </form>
        </div>
      </div>
        </div>
      </div>
    </main>
  );
}
