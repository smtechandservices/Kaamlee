'use client';

import React from 'react';
import { CheckCircle2, Download, FileText, Loader2, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const templates = [
  {
    id: 'modern_ats',
    name: 'Modern ATS',
    description: 'Clean single-column with green accents',
    accent: '#16a34a',
    preview: (
      <div className="h-full w-full bg-white rounded p-2 text-black overflow-hidden">
        <div className="h-1.5 w-20 rounded-full mb-1" style={{ background: '#16a34a' }} />
        <div className="h-1 w-28 rounded bg-zinc-300 mb-3" />
        <div className="border-b mb-2" style={{ borderColor: '#16a34a' }}>
          <div className="h-1 w-10 rounded mb-1" style={{ background: '#16a34a' }} />
        </div>
        <div className="h-1 w-full rounded bg-zinc-200 mb-1" />
        <div className="h-1 w-4/5 rounded bg-zinc-200 mb-3" />
        <div className="border-b mb-2" style={{ borderColor: '#16a34a' }}>
          <div className="h-1 w-12 rounded mb-1" style={{ background: '#16a34a' }} />
        </div>
        <div className="h-1 w-full rounded bg-zinc-200 mb-1" />
        <div className="h-1 w-3/4 rounded bg-zinc-200" />
      </div>
    ),
  },
  {
    id: 'corporate_ats',
    name: 'Corporate ATS',
    description: 'Professional navy header, serif font',
    accent: '#1e3a5f',
    preview: (
      <div className="h-full w-full bg-white rounded overflow-hidden text-black">
        <div className="px-2 py-2" style={{ background: '#1e3a5f' }}>
          <div className="h-1.5 w-20 rounded bg-white/80 mb-1" />
          <div className="h-1 w-28 rounded bg-white/40" />
        </div>
        <div className="p-2">
          <div className="border-b mb-2" style={{ borderColor: '#1e3a5f' }}>
            <div className="h-1 w-16 rounded mb-1" style={{ background: '#1e3a5f' }} />
          </div>
          <div className="h-1 w-full rounded bg-zinc-200 mb-1" />
          <div className="h-1 w-4/5 rounded bg-zinc-200 mb-3" />
          <div className="border-b mb-2" style={{ borderColor: '#1e3a5f' }}>
            <div className="h-1 w-14 rounded mb-1" style={{ background: '#1e3a5f' }} />
          </div>
          <div className="h-1 w-full rounded bg-zinc-200 mb-1" />
          <div className="h-1 w-3/4 rounded bg-zinc-200" />
        </div>
      </div>
    ),
  },
];

const loadingMessages = [
  'Analyzing Job Description...',
  'Matching Skills...',
  'Optimizing Resume...',
  'Generating ATS Resume...',
];

interface GenerateATSResumeModalProps {
  job: {
    id: string;
    title: string;
    company: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function GenerateATSResumeModal({ job, isOpen, onClose }: GenerateATSResumeModalProps) {
  const { token, refreshUser, user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = React.useState('modern_ats');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [messageIndex, setMessageIndex] = React.useState(0);
  const [error, setError] = React.useState('');
  const [generated, setGenerated] = React.useState<any>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setSelectedTemplate('modern_ats');
    setIsGenerating(false);
    setMessageIndex(0);
    setError('');
    setGenerated(null);
  }, [isOpen, job?.id]);

  React.useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setInterval(() => {
      setMessageIndex((current) => Math.min(current + 1, loadingMessages.length - 1));
    }, 1300);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  if (!isOpen || !job) return null;

  const generateResume = async () => {
    if (!token) return;
    setIsGenerating(true);
    setMessageIndex(0);
    setError('');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${job.id}/generate_ats_resume/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template_name: selectedTemplate }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate resume.');
      }
      setGenerated(data);
      await refreshUser?.();
    } catch (err: any) {
      setError(err.message || 'Something went wrong while generating the resume.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    if (generated?.pdf_url) {
      window.open(generated.pdf_url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-xl border border-[#222] bg-[#0f0f0f] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#222] bg-[#0f0f0f]/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-lg font-black text-white">Generate ATS Resume</h2>
            <p className="mt-0.5 text-xs text-[#777]">
              {job.title}{job.company ? ` at ${job.company}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-[#222] p-2 text-[#777] hover:border-[#333] hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {/* Template selection + generate */}
          {!generated && (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">Choose a resume template</p>
                  <p className="text-xs text-[#666]">Credits remaining: {user?.resume_credits ?? 0}</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-[11px] font-bold text-green-400">
                  <Sparkles size={12} />
                  100 ATS Score Templates
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selectedTemplate === template.id
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-[#222] bg-[#111] hover:border-[#333]'
                    }`}
                  >
                    <div className="mb-3 h-40 rounded-lg border border-[#222] overflow-hidden">
                      {template.preview}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">{template.name}</p>
                        <p className="text-[11px] text-[#666] mt-0.5">{template.description}</p>
                      </div>
                      {selectedTemplate === template.id && <CheckCircle2 size={16} className="text-green-400 shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-3">
                {isGenerating && (
                  <div className="mr-auto flex items-center gap-2 text-sm font-semibold text-green-400">
                    <Loader2 size={16} className="animate-spin" />
                    {loadingMessages[messageIndex]}
                  </div>
                )}
                <button
                  onClick={onClose}
                  disabled={isGenerating}
                  className="rounded-lg border border-[#222] px-4 py-2 text-sm font-bold text-[#888] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={generateResume}
                  disabled={isGenerating}
                  className="flex items-center gap-2 rounded-lg bg-green-500 px-5 py-2 text-sm font-black text-black hover:bg-green-400 disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  Generate Resume
                </button>
              </div>
            </>
          )}

          {/* Result: scores + HTML preview + download */}
          {generated && (
            <div className="space-y-5">
              {/* ATS score cards */}
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                <div className="flex items-center gap-2 text-green-400 mb-4">
                  <CheckCircle2 size={18} />
                  <span className="font-black">Resume Generated Successfully</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#222] bg-[#111] p-4">
                    <p className="text-xs text-[#666]">ATS score before</p>
                    <p className="mt-1 text-3xl font-black text-white">{Math.round(generated.ats_score_before)}%</p>
                  </div>
                  <div className="rounded-lg border border-green-500/20 bg-[#111] p-4">
                    <p className="text-xs text-[#666]">ATS score after</p>
                    <p className="mt-1 text-3xl font-black text-green-400">{Math.round(generated.ats_score_after)}%</p>
                  </div>
                </div>
              </div>

              {/* HTML resume preview */}
              {generated.html_content && (
                <div>
                  <p className="text-xs font-bold text-[#777] uppercase tracking-widest mb-2">Resume Preview</p>
                  <div className="rounded-lg border border-[#222] overflow-hidden" style={{ height: '560px' }}>
                    <iframe
                      srcDoc={generated.html_content}
                      title="ATS Resume Preview"
                      className="w-full h-full bg-white"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-[#222] px-4 py-2 text-sm font-bold text-[#888] hover:text-white"
                >
                  Done
                </button>
                {generated.pdf_url && (
                  <button
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-2 rounded-lg bg-green-500 px-5 py-2 text-sm font-black text-black hover:bg-green-400"
                  >
                    <Download size={16} />
                    Download PDF
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
