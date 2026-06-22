'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Play, Square, Zap, ChevronRight, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface AutoApplyJob {
  id: string;
  title: string;
  company: string;
  job_url: string;
  site: string;
  match_score?: number;
}

interface ApplyLog {
  jobId: string;
  title: string;
  company: string;
  status: 'queued' | 'applying' | 'done' | 'failed' | 'skipped';
  message?: string;
}

const SUPPORTED_SITES = ['linkedin'];

function isSupportedSite(job: AutoApplyJob): boolean {
  if (!job) return false;
  const urlMatch = job.job_url?.toLowerCase().includes('linkedin');
  const siteMatch = job.site?.toLowerCase().includes('linkedin');
  return !!(urlMatch || siteMatch);
}

function StatusIcon({ status }: { status: ApplyLog['status'] }) {
  if (status === 'done') return <CheckCircle2 size={14} className="text-green-500 shrink-0" />;
  if (status === 'failed') return <XCircle size={14} className="text-red-500 shrink-0" />;
  if (status === 'applying') return <Loader2 size={14} className="text-blue-400 shrink-0 animate-spin" />;
  if (status === 'skipped') return <AlertTriangle size={14} className="text-yellow-500 shrink-0" />;
  return <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />;
}

export default function AutoApplySection({ token }: { token?: string }) {
  const [isRunning, setIsRunning] = useState(false);
  const [jobs, setJobs] = useState<AutoApplyJob[]>([]);
  const [logs, setLogs] = useState<ApplyLog[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [extensionDetected, setExtensionDetected] = useState<boolean | null>(null);
  const [fetchingJobs, setFetchingJobs] = useState(false);
  const [delay, setDelay] = useState(8); // seconds between each apply
  const stopRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Check if extension is installed by waiting for a pong and status updates
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.source === 'kaamlee-extension') {
        if (e.data.action === 'PONG') {
          setExtensionDetected(true);
        } else if (e.data.action === 'UPDATE_JOB_STATUS') {
          const { jobId, status, message } = e.data.payload;
          updateLog(jobId, { status, message });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    window.postMessage({ source: 'kaamlee-frontend', action: 'PING' }, '*');
    const timer = setTimeout(() => {
      setExtensionDetected((prev) => (prev === null ? false : prev));
    }, 1500);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchJobs = async () => {
    setFetchingJobs(true);
    try {
      const headers: HeadersInit = token
        ? { Authorization: `Token ${token}` }
        : {};
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/jobs/?ordering=-match_score&limit=50`,
        { headers }
      );
      const data = await res.json();
      const list: AutoApplyJob[] = (Array.isArray(data) ? data : data.results ?? []);
      setJobs(list);
      setLogs(
        list.map((j) => ({
          jobId: j.id,
          title: j.title,
          company: j.company,
          status: 'queued',
        }))
      );
      setCurrentIndex(0);
    } catch {
      console.error('Failed to fetch jobs for auto-apply');
    } finally {
      setFetchingJobs(false);
    }
  };

  const updateLog = (jobId: string, patch: Partial<ApplyLog>) => {
    setLogs((prev) =>
      prev.map((l) => (l.jobId === jobId ? { ...l, ...patch } : l))
    );
  };

  const runAutoApply = async (jobList: AutoApplyJob[]) => {
    // Filter supported jobs
    const supportedJobs = jobList.filter(j => isSupportedSite(j));
    const unsupportedJobs = jobList.filter(j => !isSupportedSite(j));

    // Update unsupported jobs status
    unsupportedJobs.forEach(job => {
      updateLog(job.id, { status: 'skipped', message: `${job.site} not supported` });
    });

    if (supportedJobs.length === 0) {
      setIsRunning(false);
      stopRef.current = false;
      return;
    }

    // Send the queue to the extension
    window.postMessage(
      {
        source: 'kaamlee-frontend',
        action: 'START_QUEUE',
        payload: { jobs: supportedJobs },
      },
      '*'
    );
  };

  const handleStart = async () => {
    stopRef.current = false;
    setIsRunning(true);
    if (jobs.length === 0) await fetchJobs();
    // Start after fetch
    setTimeout(() => {
      setJobs((current) => {
        runAutoApply(current);
        return current;
      });
    }, 100);
  };

  const handleStop = () => {
    stopRef.current = true;
    setIsRunning(false);
    window.postMessage(
      {
        source: 'kaamlee-frontend',
        action: 'STOP_AUTOMATION',
      },
      '*'
    );
    setLogs((prev) =>
      prev.map((l) => (l.status === 'applying' || l.status === 'queued' ? { ...l, status: 'skipped', message: 'Stopped by user' } : l))
    );
  };

  const done = logs.filter((l) => l.status === 'done').length;
  const failed = logs.filter((l) => l.status === 'failed').length;
  const skipped = logs.filter((l) => l.status === 'skipped').length;

  return (
    <section className="px-6 sm:px-8 py-16 sm:py-24 border-t border-white/40 bg-[#030303] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-[#ff6b6b]/5 blur-[100px] pointer-events-none" />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px w-12 sm:w-20 bg-[#ff6b6b]" />
          <span className="font-mono text-[10px] sm:text-xs text-[#ff6b6b] tracking-widest uppercase">// AUTO_APPLY.EXE</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left — description + controls */}
          <div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-6">
              Let AI apply.<br />
              <span className="font-normal italic" style={{ fontFamily: 'Playfair Display, serif' }}>
                while you sleep.
              </span>
            </h2>
            <p className="text-[#888] text-sm sm:text-base leading-relaxed mb-8">
              Activate Auto-Apply and the Kaamlee extension will open each matched job, fill the form with your AI-tailored answers, and track every application — all in your own browser, with no password sharing.
            </p>

            {/* Extension status */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-6 text-xs font-mono ${
              extensionDetected === true
                ? 'border-green-500/20 bg-green-500/5 text-green-400'
                : extensionDetected === false
                ? 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400'
                : 'border-white/10 bg-white/5 text-white/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                extensionDetected === true ? 'bg-green-500 animate-pulse' :
                extensionDetected === false ? 'bg-yellow-500' : 'bg-white/20 animate-pulse'
              }`} />
              {extensionDetected === true
                ? 'Kaamlee extension detected — ready'
                : extensionDetected === false
                ? 'Extension not found — install it first'
                : 'Checking for extension…'}
            </div>

            {/* Delay control */}
            <div className="flex items-center gap-4 mb-8">
              <span className="text-xs text-[#555] font-mono uppercase tracking-widest">Delay between applies</span>
              <div className="flex items-center gap-2">
                {[5, 8, 15, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDelay(d)}
                    className={`px-3 py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                      delay === d
                        ? 'border-[#ff6b6b] text-[#ff6b6b] bg-[#ff6b6b]/10'
                        : 'border-white/10 text-white/30 hover:border-white/30'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={extensionDetected === false || fetchingJobs}
                  className="flex items-center gap-2 px-6 py-3 rounded-sm font-black uppercase tracking-widest text-xs
                    bg-gradient-to-r from-[#ff6b6b] to-[#ff8e53] text-white
                    hover:opacity-90 active:scale-95 transition-all
                    disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {fetchingJobs ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {fetchingJobs ? 'Loading jobs…' : 'Start Auto-Apply'}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-6 py-3 rounded-sm font-black uppercase tracking-widest text-xs
                    bg-[#1a1a1a] border border-red-500/50 text-red-400
                    hover:bg-red-500/10 active:scale-95 transition-all"
                >
                  <Square size={14} />
                  Stop
                </button>
              )}
            </div>

            {/* Stats */}
            {logs.length > 0 && (
              <div className="flex gap-6 mt-8 font-mono text-xs">
                <div><span className="text-green-500 font-bold">{done}</span> <span className="text-[#555]">sent</span></div>
                <div><span className="text-yellow-500 font-bold">{skipped}</span> <span className="text-[#555]">skipped</span></div>
                <div><span className="text-red-500 font-bold">{failed}</span> <span className="text-[#555]">failed</span></div>
                <div><span className="text-white/40 font-bold">{logs.length}</span> <span className="text-[#555]">total</span></div>
              </div>
            )}
          </div>

          {/* Right — live log */}
          <div className="bg-[#070707] border border-white/5 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500/40" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
                <div className="w-2 h-2 rounded-full bg-green-500/40" />
              </div>
              <span className="font-mono text-[10px] text-[#444] ml-2 uppercase tracking-widest flex items-center gap-2">
                <Bot size={10} /> auto_apply.log
                {isRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ff6b6b] animate-pulse ml-1" />}
              </span>
            </div>

            <div className="h-[340px] overflow-y-auto p-4 space-y-2 font-mono text-[11px]">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#333] gap-3">
                  <Bot size={28} className="opacity-30" />
                  <span className="text-[10px] tracking-widest uppercase">Press Start to begin</span>
                </div>
              ) : (
                logs.map((log, i) => (
                  <motion.div
                    key={log.jobId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i < 10 ? i * 0.03 : 0 }}
                    className={`flex items-center gap-2 py-1 px-2 rounded ${
                      log.status === 'applying' ? 'bg-blue-500/5 border border-blue-500/10' : ''
                    }`}
                  >
                    <StatusIcon status={log.status} />
                    <span className={`flex-1 truncate ${
                      log.status === 'done' ? 'text-white/50' :
                      log.status === 'applying' ? 'text-white' :
                      log.status === 'skipped' ? 'text-[#555]' :
                      'text-[#444]'
                    }`}>
                      {log.title}
                      <span className="text-[#333] ml-1">@ {log.company}</span>
                    </span>
                    {log.message && (
                      <span className="text-[9px] text-[#444] shrink-0">{log.message}</span>
                    )}
                  </motion.div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Warning */}
        <p className="mt-8 text-[10px] font-mono text-[#333] tracking-widest uppercase">
          ⚠ Auto-apply opens each job in a new tab. The Kaamlee extension fills forms. You review and submit.
          We never submit blindly on your behalf.
        </p>
      </div>
    </section>
  );
}
