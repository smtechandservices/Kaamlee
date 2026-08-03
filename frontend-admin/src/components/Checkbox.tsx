'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';

const ACCENT_ACTIVE: Record<'purple' | 'blue', string> = {
  purple: 'bg-purple-600 border-purple-600',
  blue: 'bg-blue-600 border-blue-600',
};

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  accent?: 'purple' | 'blue';
  className?: string;
  title?: string;
}

export default function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  accent = 'purple',
  className = '',
  title,
}: CheckboxProps) {
  const active = checked || indeterminate;

  return (
    <label
      className={`group relative inline-flex items-center justify-center w-[18px] h-[18px] shrink-0 cursor-pointer ${className}`}
      title={title}
    >
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`absolute inset-0 rounded-[6px] border transition-all duration-150 ${
          active
            ? ACCENT_ACTIVE[accent]
            : 'bg-[#161616] border-[#333] group-hover:border-[#555]'
        }`}
      />
      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="relative text-white pointer-events-none"
          >
            {indeterminate ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
          </motion.span>
        )}
      </AnimatePresence>
    </label>
  );
}
