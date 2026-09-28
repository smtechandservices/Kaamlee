'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Eye, EyeOff, Check, ChevronRight, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import EmailVerificationGate from '@/components/EmailVerificationGate';
import AuthSplitLayout, {
  AUTH_INPUT_CLS, AUTH_SUBMIT_CLS, AUTH_SUBMIT_BG, AUTH_SECONDARY_CLS, AuthError, AuthDivider, AuthNote,
} from '@/components/AuthSplitLayout';
import { withNext } from '@/lib/redirect';

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login } = useAuth();

  const checkExistence = async (field: string, value: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/check-existence/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      });
      const data = await response.json();
      return data.exists;
    } catch (err) {
      console.error(`Error checking ${field}:`, err);
      return false;
    }
  };

  const handleNext = async () => {
    setError('');

    if (step === 1) {
      if (!firstName || !lastName || !username) {
        setError('Please fill in all required fields.');
        return;
      }
      setIsValidating(true);
      const exists = await checkExistence('username', username);
      setIsValidating(false);
      if (exists) {
        setError('Username is already taken.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!email || !phone) {
        setError('Please fill in all required fields.');
        return;
      }
      if (!emailVerified) {
        setError('Please verify your email address before continuing.');
        return;
      }
      setIsValidating(true);
      const emailExists = await checkExistence('email', email);
      const phoneExists = await checkExistence('phone', phone);
      setIsValidating(false);

      if (emailExists) {
        setError('Email is already registered.');
        return;
      }
      if (phoneExists) {
        setError('Phone number is already registered.');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/signup/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
          confirm_password: confirmPassword,
          phone,
          linkedin_url: linkedinUrl,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.token);
      } else {
        setError(data.username?.[0] || data.email?.[0] || data.confirm_password?.[0] || data.non_field_errors?.[0] || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 1, title: 'Personal info' },
    { id: 2, title: 'Contact' },
    { id: 3, title: 'Security' },
  ];

  return (
    <AuthSplitLayout
      title={<>Create <span className="italic font-normal">account.</span></>}
      subtitle="Join Kaamlee in 3 simple steps."
      headline={
        <>
          Your next job,
          <br />
          <span className="italic font-normal">on the map.</span>
        </>
      }
    >
      {/* Step progress */}
      <ol className="mt-7 flex items-center gap-2 sm:gap-3">
        {steps.map((s, i) => {
          const done = step > s.id;
          const current = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <li className="flex items-center gap-2 shrink-0">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold transition-all duration-500 ${
                    done || current
                      ? 'text-white shadow-[0_6px_16px_-6px_rgba(22,163,74,.7)]'
                      : 'border border-black/[0.12] bg-white text-black/40'
                  }`}
                  style={done || current ? AUTH_SUBMIT_BG : undefined}
                >
                  {done ? <Check size={15} strokeWidth={3} /> : s.id}
                </span>
                <span
                  className={`text-[10.5px] font-semibold uppercase tracking-wider ${current ? 'inline text-[#0b0b0c]' : 'hidden sm:inline text-black/40'}`}
                  style={{ fontFamily: 'var(--font-outfit)' }}
                >
                  {s.title}
                </span>
              </li>
              {i < steps.length - 1 && (
                <li aria-hidden className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-black/[0.08]">
                  <motion.div
                    initial={false}
                    animate={{ width: done ? '100%' : '0%' }}
                    className="absolute inset-y-0 left-0 bg-[#16a34a]"
                  />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="mt-6 sm:mt-7 space-y-3.5 sm:space-y-4"
        >
          <AuthError message={error} />

          {step === 1 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <input
                  type="text"
                  required
                  autoComplete="given-name"
                  aria-label="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className={AUTH_INPUT_CLS}
                />
                <input
                  type="text"
                  required
                  autoComplete="family-name"
                  aria-label="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className={AUTH_INPUT_CLS}
                />
              </div>
              <input
                type="text"
                required
                autoComplete="username"
                aria-label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className={AUTH_INPUT_CLS}
              />
              <input
                type="url"
                autoComplete="url"
                aria-label="LinkedIn profile (optional)"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="LinkedIn profile URL (optional)"
                className={AUTH_INPUT_CLS}
              />
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2.5">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  aria-label="Email address"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailVerified(false); }}
                  placeholder="Email address"
                  className={AUTH_INPUT_CLS}
                />
                <EmailVerificationGate
                  email={email}
                  verified={emailVerified}
                  onVerified={() => setEmailVerified(true)}
                  onError={setError}
                  purpose="signup"
                />
              </div>
              <input
                type="tel"
                required
                autoComplete="tel"
                aria-label="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className={AUTH_INPUT_CLS}
              />
            </>
          )}

          {step === 3 && (
            <>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  aria-label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className={`${AUTH_INPUT_CLS} pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="cursor-pointer absolute right-5 top-1/2 -translate-y-1/2 text-black/45 hover:text-black/70 transition-colors"
                >
                  {showPassword ? <Eye size={19} /> : <EyeOff size={19} />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  aria-label="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className={`${AUTH_INPUT_CLS} pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="cursor-pointer absolute right-5 top-1/2 -translate-y-1/2 text-black/45 hover:text-black/70 transition-colors"
                >
                  {showConfirmPassword ? <Eye size={19} /> : <EyeOff size={19} />}
                </button>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-3">
            {step > 1 && (
              <button type="button" onClick={handleBack} className={`${AUTH_SECONDARY_CLS} flex-1`}>
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isValidating || (step === 2 && !emailVerified)}
                className={`${AUTH_SUBMIT_CLS} flex-[2]`}
                style={AUTH_SUBMIT_BG}
              >
                {isValidating ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    Continue
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`${AUTH_SUBMIT_CLS} flex-[2]`}
                style={AUTH_SUBMIT_BG}
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    <UserPlus size={17} />
                    Create account
                  </>
                )}
              </button>
            )}
          </div>

          {step === 1 && (
            <>
              <div className="pt-3">
                <AuthDivider />
              </div>
              <GoogleSignInButton onError={setError} setLoading={setIsValidating} />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <AuthNote>
        Already have an account?{' '}
        <Link href={withNext('/login')} className="font-medium text-[#16a34a] hover:underline">
          Sign in
        </Link>{' '}
        instead.
      </AuthNote>
    </AuthSplitLayout>
  );
}
