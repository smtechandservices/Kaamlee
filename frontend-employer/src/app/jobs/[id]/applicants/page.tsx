'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, ArrowLeft, Mail, Phone, FileText, ExternalLink, X, Download,
} from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';
import { STAGE_COLUMNS, type ApplicationStage, type KanbanApplication, type JobPosting } from '@/lib/hiring-types';

const HIRING_BASE = `${process.env.NEXT_PUBLIC_API_URL}/hiring`;
const CANDIDATE_APP_URL = process.env.NEXT_PUBLIC_CANDIDATE_APP_URL || '';

function groupByStage(applications: KanbanApplication[]): Record<ApplicationStage, KanbanApplication[]> {
  const grouped = {} as Record<ApplicationStage, KanbanApplication[]>;
  STAGE_COLUMNS.forEach((c) => { grouped[c.key] = []; });
  applications.forEach((a) => { grouped[a.stage]?.push(a); });
  return grouped;
}

export default function ApplicantsKanbanPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [applications, setApplications] = useState<KanbanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<ApplicationStage | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ApplicationStage | null>(null);
  const [selected, setSelected] = useState<KanbanApplication | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; fromStage: ApplicationStage } | null>(null);
  const router = useRouter();

  const questionsById = useMemo(() => {
    const map: Record<string, string> = {};
    (job?.screening_questions ?? []).forEach((q) => { map[q.id] = q.question; });
    return map;
  }, [job]);

  const fieldLabelsByKey = useMemo(() => {
    const map: Record<string, string> = {};
    (job?.application_form_schema ?? []).forEach((f) => { map[f.key] = f.label; });
    return map;
  }, [job]);

  const load = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`${HIRING_BASE}/jobs/${id}/`, { headers: authHeaders(token) }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${HIRING_BASE}/jobs/${id}/applications/`, { headers: authHeaders(token) }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([jobData, appsData]) => {
        setJob(jobData);
        setApplications(Array.isArray(appsData) ? appsData : []);
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(load, [load]);

  const columns = groupByStage(applications);

  const applyStageChange = async (applicationId: number, toStage: ApplicationStage, note?: string) => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${HIRING_BASE}/applications/${applicationId}/stage/`, {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_stage: toStage, note }),
    });
    if (res.ok) {
      const updated: KanbanApplication = await res.json();
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? updated : a)));
    }
    return res.ok;
  };

  // The export endpoint requires an Authorization header, so it can't be a
  // plain <a href> — fetch it as a blob with the token attached, then hand
  // the browser an object URL to open/download instead.
  const openCV = async (applicationId: number, format: 'pdf' | 'docx' = 'pdf') => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${HIRING_BASE}/applications/${applicationId}/cv/?type=${format}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      alert("Couldn't load this CV.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (format === 'pdf') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `application-${applicationId}-cv.docx`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const handleDrop = (e: React.DragEvent, toStage: ApplicationStage) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggingId == null || draggingFrom == null || draggingFrom === toStage) {
      setDraggingId(null); setDraggingFrom(null);
      return;
    }
    if (toStage === 'rejected') {
      setRejectTarget({ id: draggingId, fromStage: draggingFrom });
    } else {
      applyStageChange(draggingId, toStage);
    }
    setDraggingId(null);
    setDraggingFrom(null);
  };

  const handleDragStart = (e: React.DragEvent, applicationId: number, fromStage: ApplicationStage) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(applicationId);
    setDraggingFrom(fromStage);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center text-sm text-[#0b0b0c]/60">
        Couldn't load this posting.
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f2f3f5] text-[#0b0b0c] font-sans flex flex-col">
      <header className="shrink-0 px-8 py-6 border-b border-black/[0.08] bg-white">
        <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0b0b0c]/55 hover:text-[#0b0b0c] mb-2">
          <ArrowLeft size={13} /> Back to posting
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
        <p className="text-sm text-[#0b0b0c]/60">{applications.length} applicant{applications.length !== 1 ? 's' : ''} &middot; drag a card to move its stage</p>
      </header>

      <div className="flex-1 overflow-x-auto p-6 bg-white">
        <div className="flex gap-4 h-full min-w-fit">
          {STAGE_COLUMNS.map((col) => {
            const cards = columns[col.key];
            const isOver = dragOverColumn === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.key); }}
                onDragLeave={() => setDragOverColumn((prev) => (prev === col.key ? null : prev))}
                onDrop={(e) => handleDrop(e, col.key)}
                className={`w-72 shrink-0 flex flex-col rounded-2xl border transition-colors ${isOver ? 'border-purple-500/50 bg-purple-500/5' : 'border-black/[0.08] bg-black/[0.02]'}`}
              >
                <div className="shrink-0 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60">{col.label}</span>
                  <span className="text-xs font-bold text-[#0b0b0c]/40">{cards.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2 min-h-[120px]">
                  {cards.map((app) => (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, app.id, col.key)}
                      onDragEnd={() => { setDraggingId(null); setDraggingFrom(null); setDragOverColumn(null); }}
                      onClick={() => setSelected(app)}
                      className={`cursor-grab active:cursor-grabbing bg-white border border-black/[0.08] rounded-xl p-3.5 hover:border-purple-500/40 transition-all ${draggingId === app.id ? 'opacity-40' : ''}`}
                    >
                      <div className="text-sm font-bold truncate">{app.candidate_username}</div>
                      <div className="text-xs text-[#0b0b0c]/55 truncate mt-0.5">{app.candidate_email}</div>
                      <div className="flex items-center gap-2 mt-2">
                        {app.cv && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openCV(app.id); }}
                            className="cursor-pointer text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/[0.05] text-[#0b0b0c]/55 hover:bg-black/[0.08] hover:text-[#0b0b0c] transition-colors"
                          >
                            CV
                          </button>
                        )}
                        {app.portfolio_url && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600">Portfolio</span>}
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div className="text-[11px] text-[#0b0b0c]/30 text-center py-6">Drop here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <ApplicantDetailModal
            application={selected}
            questionsById={questionsById}
            fieldLabelsByKey={fieldLabelsByKey}
            candidateAppUrl={CANDIDATE_APP_URL}
            onOpenCV={openCV}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rejectTarget && (
          <RejectNoteModal
            onCancel={() => setRejectTarget(null)}
            onConfirm={async (note) => {
              const ok = await applyStageChange(rejectTarget.id, 'rejected', note);
              if (ok) setRejectTarget(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ApplicantDetailModal({ application, questionsById, fieldLabelsByKey, candidateAppUrl, onOpenCV, onClose }: {
  application: KanbanApplication;
  questionsById: Record<string, string>;
  fieldLabelsByKey: Record<string, string>;
  candidateAppUrl: string;
  onOpenCV: (applicationId: number, format?: 'pdf' | 'docx') => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
      >
        <div className="p-6 border-b border-black/[0.08] flex items-start justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold">{application.candidate_username}</h2>
            <div className="flex flex-col gap-1 mt-1.5 text-xs text-[#0b0b0c]/60">
              <span className="flex items-center gap-1.5"><Mail size={12} /> {application.candidate_email}</span>
              {application.candidate_phone && <span className="flex items-center gap-1.5"><Phone size={12} /> {application.candidate_phone}</span>}
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-black/[0.06] rounded-lg text-[#0b0b0c]/40 hover:text-[#0b0b0c]">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            {application.cv && (
              <button
                onClick={() => onOpenCV(application.id)}
                className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold bg-black/[0.05] hover:bg-black/[0.08] px-3 py-1.5 rounded-full transition-colors"
                title="Open as PDF"
              >
                <FileText size={12} /> {application.cv.label || application.cv.target_role || 'CV'} &middot; ATS {application.cv.ats_score}%
              </button>
            )}
            {application.cv && (
              <button
                onClick={() => onOpenCV(application.id, 'docx')}
                className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold bg-black/[0.05] hover:bg-black/[0.08] px-3 py-1.5 rounded-full transition-colors"
                title="Download as DOCX"
              >
                <Download size={12} /> DOCX
              </button>
            )}
            {application.portfolio_url && (
              <a href={`${candidateAppUrl}${application.portfolio_url}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-purple-500/10 text-purple-600 px-3 py-1.5 rounded-full hover:bg-purple-500/20">
                <ExternalLink size={12} /> View portfolio
              </a>
            )}
          </div>

          {Object.keys(application.form_responses ?? {}).length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-2">Application form</h3>
              <div className="flex flex-col gap-2">
                {Object.entries(application.form_responses).map(([key, val]) => (
                  <div key={key} className="text-sm">
                    <div className="text-xs text-[#0b0b0c]/50">{fieldLabelsByKey[key] || key}</div>
                    <div className="text-[#0b0b0c]">{String(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {application.screening_answers.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-2">Screening answers</h3>
              <div className="flex flex-col gap-3">
                {application.screening_answers.map((a, i) => (
                  <div key={i} className="text-sm">
                    <div className="text-xs text-[#0b0b0c]/50">{questionsById[a.question_id] || 'Question'}</div>
                    <div className="text-[#0b0b0c]">{a.answer_text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {application.latest_note && (
            <div className="text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-600">
              {application.latest_note}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function RejectNoteModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    setSubmitting(true);
    await onConfirm(note.trim());
    setSubmitting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-md shadow-2xl"
      >
        <div className="p-6 border-b border-black/[0.08]">
          <h2 className="text-lg font-bold">Reason for rejection</h2>
          <p className="text-xs text-[#0b0b0c]/55 mt-1">This note is shown to the candidate.</p>
        </div>
        <div className="p-6">
          <textarea
            autoFocus rows={4} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. We're moving forward with candidates whose experience more closely matches this role."
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all resize-none"
          />
        </div>
        <div className="p-6 bg-black/[0.03] border-t border-black/[0.08] flex gap-3 rounded-b-3xl">
          <button onClick={onCancel} className="cursor-pointer flex-1 py-2.5 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] font-semibold text-sm transition-all">
            Cancel
          </button>
          <button
            onClick={confirm} disabled={submitting || !note.trim()}
            className="cursor-pointer flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null} Reject
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
