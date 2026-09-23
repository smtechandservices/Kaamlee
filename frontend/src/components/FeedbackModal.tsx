'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, CheckCircle2, Send, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG, SECONDARY_BTN_CLS } from '@/components/ui/landing-kit';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { token } = useAuth();
  const [rating, setRating] = React.useState(0);
  const [hoveredRating, setHoveredRating] = React.useState(0);
  const [message, setMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [error, setError] = React.useState('');
  const [existingFeedback, setExistingFeedback] = React.useState<{ rating: number; message: string } | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && token) {
      fetchExistingFeedback();
    }
  }, [isOpen, token]);

  React.useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setIsSuccess(false);
        setError('');
        setIsEditing(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const fetchExistingFeedback = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback/`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setExistingFeedback(data);
          setRating(data.rating);
          setMessage(data.message);
          setIsEditing(false);
        } else {
          setExistingFeedback(null);
          setRating(0);
          setMessage('');
          setIsEditing(true);
        }
      }
    } catch {
      setIsEditing(true);
    }
  };

  const handleSubmit = async () => {
    if (!rating) {
      setError('Please select a rating.');
      return;
    }
    if (!message.trim()) {
      setError('Please write a message.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating, message }),
      });
      if (res.ok) {
        const data = await res.json();
        setExistingFeedback(data);
        setIsSuccess(true);
        setIsEditing(false);
        setTimeout(() => setIsSuccess(false), 2500);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to submit feedback.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      setExistingFeedback(null);
      setRating(0);
      setMessage('');
      setIsEditing(true);
    } catch {
      setError('Failed to delete feedback.');
    }
  };

  const starLabels = ['Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];
  const displayRating = hoveredRating || rating;

  const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45 mb-2.5';

  return (
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="relative w-full max-w-[480px] border border-black/[0.08] bg-white rounded-[28px] p-7 sm:p-9 overflow-hidden shadow-[0_30px_80px_-30px_rgba(16,18,26,.45)] text-[#0b0b0c]"
          >
            <div className="pointer-events-none absolute -top-24 -left-24 w-48 h-48 rounded-full opacity-60 blur-[70px]" style={{ background: 'radial-gradient(circle, rgba(22,163,74,.20), transparent 65%)' }} />

            <button
              onClick={onClose}
              aria-label="Close"
              className="cursor-pointer absolute top-5 right-5 z-20 grid h-9 w-9 place-items-center rounded-full border border-black/[0.08] bg-white text-black/45 hover:text-[#0b0b0c] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative z-10" style={{ fontFamily: 'var(--font-outfit)' }}>
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center text-center py-6"
                  >
                    <div className="w-16 h-16 bg-[#16a34a]/10 rounded-full flex items-center justify-center mb-5 border border-[#16a34a]/25">
                      <CheckCircle2 size={30} className="text-[#16a34a]" />
                    </div>
                    <h2 className="text-2xl font-medium tracking-[-0.02em] mb-1.5">
                      Thanks for the feedback
                    </h2>
                    <p className="text-black/55 text-sm">Your review has been saved.</p>
                  </motion.div>
                ) : existingFeedback && !isEditing ? (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <h2 id="feedback-title" className="text-2xl font-medium tracking-[-0.02em] mb-1 pr-10">Your feedback</h2>
                    <p className="text-black/50 text-sm mb-7">Here&apos;s the review you shared with us.</p>

                    <div className="flex items-center gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={22}
                          className={s <= existingFeedback.rating ? 'fill-[#16a34a] text-[#16a34a]' : 'text-black/15'}
                        />
                      ))}
                      <span className="ml-2 text-black/55 text-sm">
                        {starLabels[existingFeedback.rating - 1]}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-black/[0.08] bg-[#fafafa] p-4 mb-7 text-[15px] text-black/75 leading-relaxed whitespace-pre-wrap break-words">
                      {existingFeedback.message}
                    </div>

                    {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                    <div className="flex gap-3">
                      <button onClick={() => setIsEditing(true)} className={`${SECONDARY_BTN_CLS} flex-1 cursor-pointer`}>
                        <Pencil size={15} /> Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="cursor-pointer flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-red-500/20 bg-red-500/[0.04] px-6 py-3 text-[14.5px] font-medium text-red-600 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <h2 id="feedback-title" className="text-2xl font-medium tracking-[-0.02em] mb-1 pr-10">
                      {existingFeedback ? 'Edit feedback' : 'Share feedback'}
                    </h2>
                    <p className="text-black/50 text-sm mb-7">
                      How&apos;s your experience with Kaamlee?
                    </p>

                    <div className="mb-6">
                      <p className={labelCls}>Rating</p>
                      <div className="flex gap-1.5 items-center">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            aria-label={`${s} star${s > 1 ? 's' : ''} — ${starLabels[s - 1]}`}
                            onClick={() => setRating(s)}
                            onMouseEnter={() => setHoveredRating(s)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="cursor-pointer transition-transform hover:scale-110"
                          >
                            <Star
                              size={28}
                              className={`transition-colors ${s <= displayRating ? 'fill-[#16a34a] text-[#16a34a]' : 'text-black/15'}`}
                            />
                          </button>
                        ))}
                        {displayRating > 0 && (
                          <span className="ml-2 text-black/55 text-sm">
                            {starLabels[displayRating - 1]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className={labelCls}>Message</p>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        placeholder="Tell us what you think..."
                        className="w-full rounded-2xl border border-black/[0.10] bg-[#fafafa] px-4 py-3 text-[15px] text-[#0b0b0c] placeholder:text-black/35 focus:outline-none focus:border-[#16a34a]/50 focus:bg-white transition-colors resize-none"
                      />
                    </div>

                    {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                    <div className="flex gap-3">
                      {existingFeedback && (
                        <button
                          onClick={() => {
                            setRating(existingFeedback.rating);
                            setMessage(existingFeedback.message);
                            setError('');
                            setIsEditing(false);
                          }}
                          className={`${SECONDARY_BTN_CLS} cursor-pointer`}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`${PRIMARY_BTN_CLS} flex-1 cursor-pointer`}
                        style={PRIMARY_BTN_BG}
                      >
                        {isSubmitting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <>
                            <Send size={15} />
                            {existingFeedback ? 'Update' : 'Submit'}
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
