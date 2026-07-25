'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, FileQuestion, Layers, Building2 } from 'lucide-react';
import { searchAll } from '@/services/preparation';
import type { SearchResultItem } from '@/components/jobprep/types';

const TYPE_ICON = { question: FileQuestion, topic: Layers, company: Building2 } as const;

export default function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    let active = true;
    searchAll(query).then((r) => {
      if (active) setResults(r);
    });
    return () => {
      active = false;
    };
  }, [query]);

  const handleSelect = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-24">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            className="relative w-full max-w-xl bg-[#111] border border-[#222] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#222]">
              <Search className="w-4 h-4 text-[#555] shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions, topics or companies…"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-[#555]"
              />
              <button type="button" onClick={onClose} className="cursor-pointer text-[#555] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto no-scrollbar">
              {query.trim() === '' ? (
                <p className="text-xs text-[#555] px-4 py-6 text-center">Start typing to search across Job Preparation.</p>
              ) : results.length === 0 ? (
                <p className="text-xs text-[#555] px-4 py-6 text-center">No results for &ldquo;{query}&rdquo;.</p>
              ) : (
                <div className="p-2">
                  {results.map((r, i) => {
                    const Icon = TYPE_ICON[r.type];
                    return (
                      <button
                        key={`${r.href}-${i}`}
                        type="button"
                        onClick={() => handleSelect(r.href)}
                        className="cursor-pointer w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <Icon className="w-4 h-4 text-green-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-white truncate">{r.label}</p>
                          <p className="text-[10px] text-[#555] truncate">{r.sublabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
