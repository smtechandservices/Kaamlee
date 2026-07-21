'use client';

import React, { useRef } from 'react';

interface OtpDigitInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
}

export default function OtpDigitInput({ length = 6, value, onChange, onComplete, autoFocus }: OtpDigitInputProps) {
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const commit = (next: string[]) => {
    const joined = next.join('');
    onChange(joined);
    if (joined.length === length && next.every(Boolean)) {
      onComplete?.(joined);
    }
  };

  const handleChange = (index: number, rawValue: string) => {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    commit(next);
    if (digit && index < length - 1) {
      boxRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length }, (_, i) => pasted[i] || digits[i] || '');
    commit(next);
    boxRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      commit(next);
      boxRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { boxRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          className="w-11 h-12 sm:w-12 sm:h-14 bg-[#0a0a0a] border border-[#222] rounded-xl text-center text-lg font-bold focus:border-green-500/50 outline-none transition-all"
        />
      ))}
    </div>
  );
}
