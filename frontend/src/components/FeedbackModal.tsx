'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, RotateCcw, CheckCircle2, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

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
            className="relative w-full max-w-[520px] border border-green-500/20 bg-[#050505] rounded-sm p-8 sm:p-12 overflow-hidden shadow-[0_0_100px_-12px_rgba(34,197,94,0.2)]"
          >
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-600/10 rounded-full blur-[60px]" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 cursor-pointer text-[#444] hover:text-white transition-colors"
            >
              <RotateCcw className="rotate-45 w-4.5 h-4.5" />
            </button>

            <div className="relative z-10">
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center text-center py-8"
                  >
                    <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mb-6 border border-green-500/50">
                      <CheckCircle2 size={36} className="text-green-500" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter text-white mb-2 uppercase">
                      {existingFeedback ? 'Updated' : 'Submitted'}
                    </h2>
                    <p className="text-[#666] text-sm">Thank you for your feedback.</p>
                  </motion.div>
                ) : existingFeedback && !isEditing ? (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-white"
                  >
                    <h2 className="text-2xl font-black uppercase tracking-tight mb-1">Your Feedback</h2>
                    <p className="text-[#555] text-xs font-mono uppercase tracking-widest mb-8">
                      Submitted review
                    </p>

                    <div className="flex gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={24}
                          className={s <= existingFeedback.rating ? 'fill-green-500 text-green-500' : 'text-[#333]'}
                        />
                      ))}
                      <span className="ml-2 text-[#666] text-sm self-center">
                        {starLabels[existingFeedback.rating - 1]}
                      </span>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-sm p-4 mb-8 text-[#aaa] text-sm leading-relaxed">
                      {existingFeedback.message}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex-1 py-3 border border-white/10 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-white/5 transition-all rounded-sm cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex-1 py-3 border border-red-500/20 text-red-500/70 text-xs font-black uppercase tracking-[0.2em] hover:bg-red-500/5 transition-all rounded-sm cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-white"
                  >
                    <h2 className="text-2xl font-black uppercase tracking-tight mb-1">
                      {existingFeedback ? 'Edit Feedback' : 'Share Feedback'}
                    </h2>
                    <p className="text-[#555] text-xs font-mono uppercase tracking-widest mb-8">
                      How&apos;s your experience with Kaamlee?
                    </p>

                    {/* Star Rating */}
                    <div className="mb-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#444] mb-3">Rating</p>
                      <div className="flex gap-2 items-center">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            onClick={() => setRating(s)}
                            onMouseEnter={() => setHoveredRating(s)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="cursor-pointer transition-transform hover:scale-110"
                          >
                            <Star
                              size={28}
                              className={`transition-colors ${s <= displayRating ? 'fill-green-500 text-green-500' : 'text-[#333] hover:text-green-500/50'}`}
                            />
                          </button>
                        ))}
                        {displayRating > 0 && (
                          <span className="ml-2 text-[#666] text-xs font-mono uppercase tracking-widest">
                            {starLabels[displayRating - 1]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Message */}
                    <div className="mb-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#444] mb-3">Message</p>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        placeholder="Tell us what you think..."
                        className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-green-500/40 transition-colors resize-none"
                      />
                    </div>

                    {error && (
                      <p className="text-red-400 text-xs mb-4">{error}</p>
                    )}

                    <div className="flex gap-3">
                      {existingFeedback && (
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-5 py-3 border border-white/10 text-[#666] text-xs font-black uppercase tracking-[0.2em] hover:text-white transition-all rounded-sm cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 flex items-center justify-center gap-2 bg-white text-black py-3 text-xs font-black uppercase tracking-[0.2em] hover:bg-[#ededed] transition-all rounded-sm disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmitting ? (
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send size={14} />
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
