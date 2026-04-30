'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Mail, Lock, Loader2, Phone, Link as LinkIcon, Eye, EyeOff, CheckCircle2, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
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
    { id: 1, title: 'Personal Info' },
    { id: 2, title: 'Contact Details' },
    { id: 3, title: 'Security' },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <Link href="/" className="absolute top-6 left-6 sm:top-8 sm:left-8 text-[#888] hover:text-white transition-colors flex items-center gap-2 text-xs sm:text-sm font-medium z-20">
        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Back to Home</span>
        <span className="sm:hidden">Back</span>
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="hidden md:block text-center my-6">
          <h1 className="text-3xl sm:text-4xl font-black font-heading tracking-tight mb-2">Create an account</h1>
          <p className="text-sm sm:text-base text-[#a1a1a1]">Join Kaamlee in 3 simple steps</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-between my-4 px-4">
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 ${
                  step >= s.id ? 'bg-blue-600 border-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-transparent border-[#222] text-[#444]'
                }`}>
                  {step > s.id ? <CheckCircle2 size={20} /> : s.id}
                </div>
                <span className={`text-center text-[10px] uppercase tracking-wider font-bold ${step >= s.id ? 'text-white' : 'text-[#444]'}`}>{s.title}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-[2px] bg-[#222] mx-2 -mt-6 relative overflow-hidden">
                  <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ width: step > s.id ? '100%' : '0%' }}
                    className="absolute top-0 left-0 h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Animated Background Pulse */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/5 blur-3xl rounded-full animate-pulse" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl"
                >
                  {error}
                </motion.div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-bold text-[#a1a1a1] uppercase ml-1">First Name</label>
                      <input 
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder-[#333]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-bold text-[#a1a1a1] uppercase ml-1">Last Name</label>
                      <input 
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder-[#333]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#a1a1a1] uppercase ml-1">Username</label>
                    <div className="relative">
                      <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444]" />
                      <input 
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="johndoe"
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl pl-12 pr-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder-[#333]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#a1a1a1] uppercase ml-1">LinkedIn Profile</label>
                    <div className="relative">
                      <LinkIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444]" />
                      <input 
                        type="url"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl pl-12 pr-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder-[#333]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#a1a1a1] uppercase ml-1">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444]" />
                      <input 
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl pl-12 pr-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder-[#333]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#a1a1a1] uppercase ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444]" />
                      <input 
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="987..."
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl pl-12 pr-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder-[#333]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#a1a1a1] uppercase ml-1">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444]" />
                      <input 
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl pl-12 pr-12 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder-[#333]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#a1a1a1] uppercase ml-1">Confirm Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444]" />
                      <input 
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl pl-12 pr-12 py-3 text-sm focus:border-blue-500/50 outline-none transition-all placeholder-[#333]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 bg-[#1a1a1a] text-white font-bold py-3.5 rounded-xl border border-[#222] hover:bg-[#222] transition-all flex items-center justify-center gap-2"
                  >
                    Back
                  </button>
                )}
                
                {step < 3 ? (
                  <button 
                    type="button"
                    onClick={handleNext}
                    disabled={isValidating}
                    className="cursor-pointer flex-[2] bg-white text-black font-bold py-3.5 rounded-xl hover:bg-[#ededed] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
                    className="cursor-pointer flex-[2] bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Create Account'}
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 text-center text-sm text-[#a1a1a1]">
            Already have an account? <Link href="/login" className="text-white hover:underline">Log in</Link>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
