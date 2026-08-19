'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Phone, Link as LinkIcon, Loader2, Save, CheckCircle2, Briefcase, X, AtSign, Lock, AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import EmailVerificationGate from '@/components/EmailVerificationGate';
import { useAuth } from '@/context/AuthContext';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG } from '@/components/ui/landing-kit';

const OUTFIT = { fontFamily: 'var(--font-outfit)' };

const CARD_CLS =
  'bg-white border border-black/[0.08] rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]';

const LABEL_CLS = 'text-[10px] sm:text-xs font-semibold text-black/45 uppercase tracking-widest ml-1';

const INPUT_CLS =
  'w-full bg-black/[0.02] border border-black/[0.08] rounded-xl sm:rounded-2xl pl-11 sm:pl-12 pr-4 py-3.5 sm:py-4 text-xs sm:text-sm text-[#0b0b0c] placeholder:text-black/30 focus:border-[#16a34a]/50 focus:bg-white outline-none transition-all';

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
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#16a34a] animate-spin" />
      </div>
    );
  }

  return (
    <main className="h-screen flex bg-[#f2f3f5] text-[#0b0b0c] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/dashboard" title="Profile" wordmark />

        <div className="flex-1 overflow-y-auto p-6 relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#16a34a]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto z-10 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Personal Details card */}
        <div className={CARD_CLS}>
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-[#16a34a]" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#0b0b0c]" style={OUTFIT}>Personal Details</h2>
          </div>

          <form onSubmit={handleSubmitDetails} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm py-4 px-5 rounded-2xl" style={OUTFIT}>
                {error}
              </div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#16a34a]/10 border border-[#16a34a]/20 text-[#16a34a] text-sm py-4 px-5 rounded-2xl flex items-center gap-3"
                style={OUTFIT}
              >
                <CheckCircle2 size={18} />
                Profile updated successfully!
              </motion.div>
            )}

            <div className="space-y-2 sm:space-y-3">
              <label className={LABEL_CLS} style={OUTFIT}>Username</label>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={INPUT_CLS}
                  style={OUTFIT}
                />
              </div>
              <p className="text-[9px] sm:text-[10px] text-black/40 ml-1" style={OUTFIT}>This is also your public portfolio link: kaamlee.in/portfolio/{username || '...'}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              <div className="space-y-2 sm:space-y-3">
                <label className={LABEL_CLS} style={OUTFIT}>First Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={INPUT_CLS}
                    style={OUTFIT}
                  />
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <label className={LABEL_CLS} style={OUTFIT}>Last Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={INPUT_CLS}
                    style={OUTFIT}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className={LABEL_CLS} style={OUTFIT}>Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={INPUT_CLS}
                  style={OUTFIT}
                />
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className={LABEL_CLS} style={OUTFIT}>LinkedIn URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className={INPUT_CLS}
                  style={OUTFIT}
                />
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${PRIMARY_BTN_CLS} w-full py-3.5 sm:py-4 text-xs sm:text-sm`}
                style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}
              >
                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Resume card */}
        <div className={CARD_CLS}>
          <div className="flex items-center gap-3 mb-6">
            <Briefcase className="w-5 h-5 text-[#16a34a]" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#0b0b0c]" style={OUTFIT}>Resume</h2>
          </div>

          <form onSubmit={handleSubmitResume} className="space-y-6">
            {resumeError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm py-4 px-5 rounded-2xl" style={OUTFIT}>
                {resumeError}
              </div>
            )}

            {resumeSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#16a34a]/10 border border-[#16a34a]/20 text-[#16a34a] text-sm py-4 px-5 rounded-2xl flex items-center gap-3"
                style={OUTFIT}
              >
                <CheckCircle2 size={18} />
                Resume updated successfully!
              </motion.div>
            )}

            {resumeSuccess && user?.has_resume && !user?.resume_ai_parsed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-amber-50 border border-amber-200 text-amber-700 text-sm py-4 px-5 rounded-2xl flex items-center gap-3"
                style={OUTFIT}
              >
                <AlertTriangle size={18} />
                Resume uploaded, but AI parsing didn&apos;t go through — portfolio and AI cover letters won&apos;t reflect it yet. Try again in a bit.
              </motion.div>
            )}

            <div className="space-y-2 sm:space-y-3">
              <label className={LABEL_CLS} style={OUTFIT}>Resume (PDF Recommended)</label>
              <div className="relative">
                {!user?.resume && !resume ? (
                  <div className="w-full bg-black/[0.02] border border-black/[0.10] border-dashed rounded-xl sm:rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center gap-3 hover:border-[#16a34a]/50 transition-all cursor-pointer relative text-center">
                    <Briefcase size={24} className="text-black/30" />
                    <span className="text-[10px] sm:text-xs font-medium text-black/45" style={OUTFIT}>Click to upload or drag & drop</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setResume(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="relative w-full h-[300px] sm:h-[400px] rounded-xl sm:rounded-2xl overflow-hidden border border-black/[0.08] bg-white">
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
                      className="cursor-pointer absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white/90 border border-black/[0.08] text-black/45 hover:text-red-600 hover:border-red-200 backdrop-blur-sm transition-colors shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]"
                      title="Remove Resume"
                    >
                      <X className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                )}

                {resume && (
                  <p className="text-[9px] sm:text-[10px] text-[#16a34a] mt-1 sm:mt-2 ml-1 italic" style={OUTFIT}>
                    Click &quot;Update Resume&quot; to upload the new file.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={isSubmittingResume || !resume}
                className={`${PRIMARY_BTN_CLS} w-full py-3.5 sm:py-4 text-xs sm:text-sm`}
                style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}
              >
                {isSubmittingResume ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5" />}
                Update Resume
              </button>
            </div>
          </form>
        </div>
        </div>

        {/* Change Password card */}
        <div className={`mt-4 max-w-xl ${CARD_CLS}`}>
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-5 h-5 text-[#16a34a]" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#0b0b0c]" style={OUTFIT}>Change Password</h2>
          </div>

          <form onSubmit={handleSubmitPassword} className="space-y-6">
            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm py-4 px-5 rounded-2xl" style={OUTFIT}>
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#16a34a]/10 border border-[#16a34a]/20 text-[#16a34a] text-sm py-4 px-5 rounded-2xl flex items-center gap-3"
                style={OUTFIT}
              >
                <CheckCircle2 size={18} />
                Password updated successfully!
              </motion.div>
            )}

            <div className="space-y-2 sm:space-y-3">
              <label className={LABEL_CLS} style={OUTFIT}>Verify Your Identity</label>
              <EmailVerificationGate
                email={user?.email || ''}
                verified={otpVerified}
                onVerified={() => setOtpVerified(true)}
                onError={setPasswordError}
              />
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className={LABEL_CLS} style={OUTFIT}>New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={INPUT_CLS}
                  style={OUTFIT}
                />
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className={LABEL_CLS} style={OUTFIT}>Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={INPUT_CLS}
                  style={OUTFIT}
                />
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={isSubmittingPassword || !otpVerified}
                className={`${PRIMARY_BTN_CLS} w-full py-3.5 sm:py-4 text-xs sm:text-sm`}
                style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}
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
