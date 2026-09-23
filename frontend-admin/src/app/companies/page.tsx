'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCcw,
  X,
  ExternalLink,
  Search,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCached, setCache, invalidatePrefix } from '@/lib/cache';
import Checkbox from '@/components/Checkbox';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;
const PAGE_SIZE = 20;

interface Company {
  id: number;
  name: string;
  domain: string;
  career_url: string;
  contact_url: string;
  contact_email: string;
  address: string;
  linkedin_url: string;
  logo_url: string;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
  // Read-only, added by the list endpoint (CompanyViewSet.list).
  job_count?: number;
  jobs?: CompanyJob[];
}

interface CompanyJob {
  id: number;
  title: string;
  location_name: string;
  is_remote: boolean;
  job_url: string;
  date_posted: string | null;
  experience_required: string | null;
  salary: string | null;
}

type CompanyFormData = Omit<Company, 'id' | 'last_scraped_at' | 'created_at' | 'job_count' | 'jobs'>;

function formatRelativeScrapedAt(value: string | null) {
  if (!value) return 'never scraped';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'scraped just now';
  if (minutes < 60) return `scraped ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `scraped ${hours} hr${hours !== 1 ? 's' : ''} ago`;
  const days = Math.round(hours / 24);
  return `scraped ${days} day${days !== 1 ? 's' : ''} ago`;
}

const EMPTY_FORM: CompanyFormData = {
  name: '',
  domain: '',
  career_url: '',
  contact_url: '',
  contact_email: '',
  address: '',
  linkedin_url: '',
  logo_url: '',
  is_active: true,
};

const BULK_CSV_COLUMNS = [
  'name', 'domain', 'career_url', 'contact_url', 'contact_email', 'address', 'linkedin_url', 'logo_url', 'is_active',
] as const;

const SAMPLE_CSV_ROWS = [
  BULK_CSV_COLUMNS,
  ['Notion', 'notion.so', 'https://jobs.ashbyhq.com/notion', 'https://notion.so/contact', 'hello@notion.so', 'San Francisco, CA', 'https://linkedin.com/company/notionhq', 'https://logo.clearbit.com/notion.so', 'true'],
  ['Figma', 'figma.com', 'https://www.figma.com/careers/', '', '', 'San Francisco, CA', 'https://linkedin.com/company/figma', 'https://logo.clearbit.com/figma.com', 'true'],
];

function toCsvValue(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadSampleCsv() {
  const csv = SAMPLE_CSV_ROWS.map(row => row.map(toCsvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'companies_sample.csv';
  link.click();
  URL.revokeObjectURL(url);
}

// Minimal RFC-4180 CSV parser: handles quoted fields, escaped quotes, and commas/newlines within quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
  }
  return rows;
}

function parseCompaniesCsv(text: string): Record<string, string | boolean>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(cells => {
    const record: Record<string, string | boolean> = {};
    header.forEach((key, i) => {
      if (!BULK_CSV_COLUMNS.includes(key as typeof BULK_CSV_COLUMNS[number])) return;
      const raw = (cells[i] ?? '').trim();
      record[key] = key === 'is_active' ? !['false', '0', 'no', ''].includes(raw.toLowerCase()) : raw;
    });
    return record;
  }).filter(r => typeof r.name === 'string' && r.name.trim() !== '');
}

interface BulkResult {
  created: unknown[];
  errors: { row: number; name: string; errors: Record<string, string[]> }[];
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const router = useRouter();

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const fetchCompanies = useCallback(async (force = false) => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('search', search);
    const cacheKey = `company-data:list:${params.toString()}`;

    if (!force) {
      const cached = getCached<{ results: Company[]; count: number }>(cacheKey);
      if (cached) {
        setCompanies(cached.results);
        setCount(cached.count);
        setSelectedIds(new Set());
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/companies/?${params.toString()}`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.results);
        setCount(data.count);
        setSelectedIds(new Set());
        setCache(cacheKey, data);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, router]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const openAddModal = () => {
    setEditingCompany(null);
    setIsModalOpen(true);
  };

  const openEditModal = (company: Company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleSave = async (data: CompanyFormData) => {
    const token = localStorage.getItem('admin_token');
    setSaving(true);
    try {
      const url = editingCompany
        ? `${API_BASE}/admin/companies/${editingCompany.id}/`
        : `${API_BASE}/admin/companies/`;
      const res = await fetch(url, {
        method: editingCompany ? 'PATCH' : 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        alert(JSON.stringify(errorData));
        return;
      }
      setIsModalOpen(false);
      invalidatePrefix('company-data:');
      fetchCompanies(true);
    } catch (error) {
      alert('Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (company: Company) => {
    const token = localStorage.getItem('admin_token');
    setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, is_active: !c.is_active } : c));
    invalidatePrefix('company-data:');
    try {
      await fetch(`${API_BASE}/admin/companies/${company.id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !company.is_active }),
      });
    } catch (error) {
      alert('Failed to update company');
      fetchCompanies(true);
    }
  };

  const handleBulkUpload = async (companies: Record<string, string | boolean>[]): Promise<BulkResult> => {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE}/admin/companies/bulk/`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies }),
    });
    const data = await res.json();
    if (!res.ok && !data.created) throw new Error(data.error || 'Bulk upload failed');
    if (data.created?.length) {
      invalidatePrefix('company-data:');
      fetchCompanies(true);
    }
    return data as BulkResult;
  };

  const handleDelete = async (company: Company) => {
    if (!window.confirm(`Delete ${company.name}? This won't delete its jobs.`)) return;
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch(`${API_BASE}/admin/companies/${company.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        setCompanies(prev => prev.filter(c => c.id !== company.id));
        invalidatePrefix('company-data:');
      } else {
        alert('Failed to delete company');
      }
    } catch (error) {
      alert('Failed to delete company');
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} compan${selectedIds.size !== 1 ? 'ies' : 'y'}? This won't delete their jobs.`)) return;
    const token = localStorage.getItem('admin_token');
    setBulkDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/companies/bulk-delete/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setCompanies(prev => prev.filter(c => !selectedIds.has(c.id)));
        setSelectedIds(new Set());
        invalidatePrefix('company-data:');
      } else {
        alert('Failed to delete companies');
      }
    } catch (error) {
      alert('Failed to delete companies');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
                Companies
              </h1>
              <p className="text-[#0b0b0c]/60 font-medium">
                {count.toLocaleString()} compan{count !== 1 ? 'ies' : 'y'} configured
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0b0b0c]/60" size={18} />
              <input
                type="text"
                placeholder="Search companies..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                className="w-64 bg-white border border-black/[0.08] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            <button
              onClick={() => fetchCompanies(true)}
              className="cursor-pointer p-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="cursor-pointer bg-white border border-black/[0.08] hover:bg-black/[0.03] text-[#0b0b0c] px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all"
            >
              <Upload size={18} />
              Bulk Add
            </button>
            <button
              onClick={openAddModal}
              className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
            >
              <Plus size={18} />
              Add Company
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
            <p className="text-[#0b0b0c]/60 text-xs font-bold uppercase tracking-widest">Loading companies</p>
          </div>
        ) : (
          <>
            {companies.length > 0 && (
              <div
                className={`flex items-center justify-between mb-4 px-4 py-2.5 rounded-2xl border transition-colors duration-200 ${
                  selectedIds.size > 0 ? 'bg-purple-500/10 border-purple-500/20' : 'border-transparent'
                }`}
              >
                <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <Checkbox
                    checked={companies.every(c => selectedIds.has(c.id))}
                    indeterminate={selectedIds.size > 0 && !companies.every(c => selectedIds.has(c.id))}
                    onChange={(checked) => setSelectedIds(checked ? new Set(companies.map(c => c.id)) : new Set())}
                    accent="purple"
                    title={selectedIds.size > 0 ? 'Deselect all' : 'Select all'}
                  />
                  <span className={`font-medium transition-colors ${selectedIds.size > 0 ? 'text-purple-600' : 'text-[#0b0b0c]/40'}`}>
                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                  </span>
                </label>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="cursor-pointer bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-600/20 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Delete Selected ({selectedIds.size})
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {companies.map((company) => (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`bg-white border rounded-3xl p-6 transition-all flex flex-col gap-4 ${selectedIds.has(company.id) ? 'border-purple-500/60' : 'border-black/[0.08] hover:border-purple-500/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          checked={selectedIds.has(company.id)}
                          onChange={() => toggleSelect(company.id)}
                          accent="purple"
                          title={selectedIds.has(company.id) ? 'Deselect' : 'Select'}
                        />
                        {company.logo_url ? (
                          <img src={company.logo_url} alt="" className="w-10 h-10 rounded-xl object-contain bg-white shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold text-sm shrink-0">
                            {company.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold truncate">{company.name}</h3>
                            {!company.is_active && (
                              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/[0.05] text-[#0b0b0c]/55">Inactive</span>
                            )}
                          </div>
                          {company.domain && <p className="text-xs text-[#0b0b0c]/60 font-medium truncate">{company.domain}</p>}
                          <div
                            className="flex items-center gap-1 text-[11px] text-[#0b0b0c]/60 mt-0.5"
                            title={company.last_scraped_at ? `Last scraped ${new Date(company.last_scraped_at).toLocaleString('en-IN')}` : undefined}
                          >
                            <Clock size={11} className="shrink-0" />
                            <span className="truncate">{formatRelativeScrapedAt(company.last_scraped_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 shrink-0">
                      <div className="text-center px-3 py-1.5 rounded-xl bg-black/[0.04]">
                        <div className="text-lg font-black leading-none">{(company.job_count ?? 0).toLocaleString()}</div>
                        <div className="text-[9px] uppercase tracking-widest text-[#0b0b0c]/60 font-bold">Jobs</div>
                      </div>
                      <button
                        onClick={() => toggleActive(company)}
                        className={`cursor-pointer relative w-11 h-6 rounded-full transition-all shrink-0 ${company.is_active ? 'bg-purple-600' : 'bg-black/[0.08]'}`}
                        title={company.is_active ? 'Active' : 'Inactive'}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${company.is_active ? 'left-5' : 'left-0.5'}`} />
                      </button>
                      </div>
                    </div>

                    {company.career_url && (
                      <a href={company.career_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-[#0b0b0c]/40 hover:text-purple-600 transition-colors truncate">
                        <Globe size={13} className="shrink-0" /> <span className="truncate">Career page</span> <ExternalLink size={11} className="shrink-0" />
                      </a>
                    )}

                    <div className="pt-4 border-t border-black/[0.08] flex-1 min-h-0">
                      {!company.jobs || company.jobs.length === 0 ? (
                        <p className="text-xs text-[#0b0b0c]/70 text-center py-4">No jobs yet.</p>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                          {company.jobs.map(job => (
                            <a
                              key={job.id}
                              href={job.job_url}
                              target="_blank"
                              rel="noreferrer"
                              className="block p-3 rounded-xl bg-black/[0.03] border border-black/[0.08] hover:border-purple-500/40 transition-all"
                            >
                              <div className="text-sm font-semibold truncate">{job.title}</div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-[#0b0b0c]/60">
                                {(job.location_name || job.is_remote) && (
                                  <span className="flex items-center gap-1"><MapPin size={10} /> {job.is_remote ? 'Remote' : job.location_name}</span>
                                )}
                                {job.salary && <span className="text-green-600">{job.salary}</span>}
                                {job.experience_required && <span>{job.experience_required}</span>}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-black/[0.08] flex gap-3 mt-auto">
                      <button
                        onClick={() => openEditModal(company)}
                        className="cursor-pointer flex-1 py-2.5 rounded-xl bg-black/[0.04] border border-black/[0.08] text-sm font-semibold text-[#0b0b0c]/70 hover:text-[#0b0b0c] hover:bg-black/[0.06] hover:border-black/[0.12] transition-all flex items-center justify-center gap-2"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(company)}
                        className="cursor-pointer flex-1 py-2.5 rounded-xl bg-red-500/5 border border-red-500/15 text-sm font-semibold text-red-500/80 hover:text-red-600 hover:bg-red-500/10 hover:border-red-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {companies.length === 0 && (
              <div className="py-24 text-center">
                <Building2 className="w-12 h-12 text-[#0b0b0c]/80 mx-auto mb-4" />
                <p className="text-[#0b0b0c]/60 font-medium">
                  {count === 0 && !search ? 'No companies configured yet.' : 'No results match your search.'}
                </p>
              </div>
            )}

            {count > 0 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-xs text-[#0b0b0c]/60 font-medium">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="cursor-pointer p-2.5 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="cursor-pointer p-2.5 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <CompanyFormModal
            company={editingCompany}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkModalOpen && (
          <BulkAddModal
            onClose={() => setIsBulkModalOpen(false)}
            onUpload={handleBulkUpload}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BulkAddModal({ onClose, onUpload }: {
  onClose: () => void;
  onUpload: (companies: Record<string, string | boolean>[]) => Promise<BulkResult>;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Record<string, string | boolean>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    setParseError(null);
    try {
      const text = await file.text();
      const rows = parseCompaniesCsv(text);
      if (rows.length === 0) {
        setParsed([]);
        setParseError('No valid rows found. Make sure each row has a "name" column filled in.');
      } else {
        setParsed(rows);
      }
    } catch {
      setParsed([]);
      setParseError('Could not read that file. Please upload a .csv file.');
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    setParseError(null);
    try {
      const res = await onUpload(parsed);
      setResult(res);
      if (res.errors.length === 0) setParsed([]);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-black/[0.12] bg-black/[0.04] rounded-t-3xl shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Upload size={20} className="text-purple-500" />
            Bulk Add Companies
          </h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-black/[0.08] rounded-lg transition-colors text-[#0b0b0c]/40 hover:text-[#0b0b0c]">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <button
            onClick={downloadSampleCsv}
            className="cursor-pointer w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black/[0.04] border border-black/[0.08] text-sm font-semibold text-[#0b0b0c]/40 hover:text-[#0b0b0c] hover:border-purple-500/40 transition-all"
          >
            <Download size={14} />
            Download sample CSV
          </button>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">
              Upload CSV file<span className="text-purple-600"> *</span>
            </label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-black/[0.08] hover:border-purple-500/40 rounded-xl px-4 py-6 cursor-pointer transition-all text-center">
              <Upload size={20} className="text-[#0b0b0c]/60" />
              <span className="text-sm text-[#0b0b0c]/40">
                {fileName ?? 'Click to choose a .csv file'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            <p className="text-[10px] text-[#0b0b0c]/70 mt-1.5">
              Columns: {BULK_CSV_COLUMNS.join(', ')}. Only <span className="text-[#0b0b0c]/55">name</span> and <span className="text-[#0b0b0c]/55">career_url</span> are required.
            </p>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}

          {parsed.length > 0 && !result && (
            <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="shrink-0" />
              {parsed.length} compan{parsed.length !== 1 ? 'ies' : 'y'} ready to import.
            </div>
          )}

          {result && (
            <div className="space-y-2">
              {result.created.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                  <CheckCircle2 size={16} className="shrink-0" />
                  {result.created.length} compan{result.created.length !== 1 ? 'ies' : 'y'} added.
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="text-sm text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <AlertTriangle size={16} className="shrink-0" />
                    {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped
                  </div>
                  <ul className="space-y-1 text-xs text-yellow-600/80">
                    {result.errors.map((e) => (
                      <li key={e.row}>
                        Row {e.row}{e.name ? ` (${e.name})` : ''}: {Object.entries(e.errors).map(([field, msgs]) => `${field}: ${msgs.join(' ')}`).join('; ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 bg-black/[0.04] border-t border-black/[0.12] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="cursor-pointer flex-1 py-3 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] font-bold transition-all">
            {result ? 'Close' : 'Cancel'}
          </button>
          <button
            disabled={uploading || parsed.length === 0}
            onClick={handleUpload}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : null}
            Upload {parsed.length > 0 ? `(${parsed.length})` : ''}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CompanyFormModal({ company, onClose, onSave, saving }: {
  company: Company | null;
  onClose: () => void;
  onSave: (data: CompanyFormData) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CompanyFormData>(
    company
      ? {
          name: company.name,
          domain: company.domain,
          career_url: company.career_url,
          contact_url: company.contact_url,
          contact_email: company.contact_email,
          address: company.address,
          linkedin_url: company.linkedin_url,
          logo_url: company.logo_url,
          is_active: company.is_active,
        }
      : EMPTY_FORM
  );

  const set = (field: keyof CompanyFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const canSave = form.name.trim() !== '' && form.career_url.trim() !== '';

  const fields: { key: keyof CompanyFormData; label: string; placeholder: string; required?: boolean }[] = [
    { key: 'name', label: 'Company name', placeholder: 'e.g. Notion', required: true },
    { key: 'domain', label: 'Domain', placeholder: 'e.g. notion.so' },
    { key: 'career_url', label: 'Career page URL', placeholder: 'https://jobs.ashbyhq.com/notion', required: true },
    { key: 'contact_url', label: 'Contact page URL', placeholder: 'https://notion.so/contact' },
    { key: 'contact_email', label: 'Contact email', placeholder: 'hello@notion.so' },
    { key: 'address', label: 'Address', placeholder: 'San Francisco, CA' },
    { key: 'linkedin_url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/company/notionhq' },
    { key: 'logo_url', label: 'Logo URL', placeholder: 'https://logo.clearbit.com/notion.so' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-black/[0.12] bg-black/[0.04] rounded-t-3xl shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 size={20} className="text-purple-500" />
            {company ? 'Edit Company' : 'Add Company'}
          </h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-black/[0.08] rounded-lg transition-colors text-[#0b0b0c]/40 hover:text-[#0b0b0c]">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {fields.map(({ key, label, placeholder, required }) => (
            <div key={key}>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">
                {label}{required && <span className="text-purple-600"> *</span>}
              </label>
              <input
                type="text"
                value={form[key] as string}
                onChange={set(key)}
                placeholder={placeholder}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm text-[#0b0b0c] placeholder-black/30 focus:border-purple-500 outline-none transition-all"
              />
            </div>
          ))}

          <label className="flex items-center gap-3 pt-2 cursor-pointer">
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
              className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${form.is_active ? 'bg-purple-600' : 'bg-black/[0.08]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.is_active ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-[#0b0b0c]/40">Active</span>
          </label>
        </div>

        <div className="p-6 bg-black/[0.04] border-t border-black/[0.12] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="cursor-pointer flex-1 py-3 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] font-bold transition-all">
            Cancel
          </button>
          <button
            disabled={saving || !canSave}
            onClick={() => onSave(form)}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            {company ? 'Save Changes' : 'Add Company'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
