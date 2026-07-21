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
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
}

type CompanyFormData = Omit<Company, 'id' | 'last_scraped_at' | 'created_at'>;

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

  const fetchCompanies = useCallback(async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);
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
      fetchCompanies();
    } catch (error) {
      alert('Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (company: Company) => {
    const token = localStorage.getItem('admin_token');
    setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, is_active: !c.is_active } : c));
    try {
      await fetch(`${API_BASE}/admin/companies/${company.id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !company.is_active }),
      });
    } catch (error) {
      alert('Failed to update company');
      fetchCompanies();
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
    if (data.created?.length) fetchCompanies();
    return data as BulkResult;
  };

  const handleDelete = async (company: Company) => {
    if (!window.confirm(`Delete ${company.name}? This won't delete its already-scraped jobs.`)) return;
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch(`${API_BASE}/admin/companies/${company.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        setCompanies(prev => prev.filter(c => c.id !== company.id));
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
    if (!window.confirm(`Delete ${selectedIds.size} compan${selectedIds.size !== 1 ? 'ies' : 'y'}? This won't delete their already-scraped jobs.`)) return;
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
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
                Companies
              </h1>
              <p className="text-[#555] font-medium">
                {count.toLocaleString()} compan{count !== 1 ? 'ies' : 'y'} configured
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" size={18} />
              <input
                type="text"
                placeholder="Search companies..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                className="w-64 bg-[#111] border border-[#222] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            <button
              onClick={fetchCompanies}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="cursor-pointer bg-[#111] border border-[#222] hover:bg-[#161616] text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all"
            >
              <Upload size={18} />
              Bulk Add
            </button>
            <button
              onClick={openAddModal}
              className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
            >
              <Plus size={18} />
              Add Company
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
            <p className="text-[#555] text-xs font-bold uppercase tracking-widest">Loading companies</p>
          </div>
        ) : (
          <>
            {companies.length > 0 && (
              <div className="flex items-center justify-between mb-4 px-1">
                <label className="flex items-center gap-2 text-sm text-[#888] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && companies.every(c => selectedIds.has(c.id))}
                    onChange={(e) => setSelectedIds(e.target.checked ? new Set(companies.map(c => c.id)) : new Set())}
                    className="cursor-pointer w-4 h-4 accent-purple-600"
                  />
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                </label>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="cursor-pointer bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className={`bg-[#111] border rounded-3xl p-6 transition-all flex flex-col gap-4 ${selectedIds.has(company.id) ? 'border-purple-500/60' : 'border-[#222] hover:border-purple-500/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(company.id)}
                          onChange={() => toggleSelect(company.id)}
                          className="cursor-pointer w-4 h-4 accent-purple-600 shrink-0"
                        />
                        {company.logo_url ? (
                          <img src={company.logo_url} alt="" className="w-10 h-10 rounded-xl object-contain bg-white shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-sm shrink-0">
                            {company.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold truncate">{company.name}</h3>
                            {!company.is_active && (
                              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#222] text-[#666]">Inactive</span>
                            )}
                          </div>
                          {company.domain && <p className="text-xs text-[#555] font-medium truncate">{company.domain}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleActive(company)}
                        className={`cursor-pointer relative w-11 h-6 rounded-full transition-all shrink-0 ${company.is_active ? 'bg-purple-600' : 'bg-[#333]'}`}
                        title={company.is_active ? 'Active — eligible for scraping' : 'Inactive — excluded from scraping'}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${company.is_active ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs">
                      {company.career_url && (
                        <a href={company.career_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#888] hover:text-purple-400 transition-colors truncate">
                          <ExternalLink size={13} className="shrink-0" /> <span className="truncate">{company.career_url}</span>
                        </a>
                      )}
                      <div className="text-[#555]">
                        Last scraped: {company.last_scraped_at
                          ? new Date(company.last_scraped_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : 'Never'}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#222] flex gap-3 mt-auto">
                      <button
                        onClick={() => openEditModal(company)}
                        className="cursor-pointer flex-1 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#222] text-sm font-semibold text-[#888] hover:text-white hover:border-[#333] transition-all flex items-center justify-center gap-2"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(company)}
                        className="cursor-pointer flex-1 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#222] text-sm font-semibold text-[#888] hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center gap-2"
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
                <Building2 className="w-12 h-12 text-[#222] mx-auto mb-4" />
                <p className="text-[#555] font-medium">
                  {count === 0 && !search ? 'No companies configured yet.' : 'No results match your search.'}
                </p>
              </div>
            )}

            {count > 0 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-xs text-[#555] font-medium">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="cursor-pointer p-2.5 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="cursor-pointer p-2.5 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
        className="bg-[#111] border border-[#333] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-[#333] bg-[#1a1a1a] rounded-t-3xl shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Upload size={20} className="text-purple-500" />
            Bulk Add Companies
          </h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-[#333] rounded-lg transition-colors text-[#888] hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <button
            onClick={downloadSampleCsv}
            className="cursor-pointer w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#222] text-sm font-semibold text-[#888] hover:text-white hover:border-purple-500/40 transition-all"
          >
            <Download size={14} />
            Download sample CSV
          </button>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#555] mb-1.5 block">
              Upload CSV file<span className="text-purple-400"> *</span>
            </label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#222] hover:border-purple-500/40 rounded-xl px-4 py-6 cursor-pointer transition-all text-center">
              <Upload size={20} className="text-[#555]" />
              <span className="text-sm text-[#888]">
                {fileName ?? 'Click to choose a .csv file'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            <p className="text-[10px] text-[#444] mt-1.5">
              Columns: {BULK_CSV_COLUMNS.join(', ')}. Only <span className="text-[#666]">name</span> and <span className="text-[#666]">career_url</span> are required.
            </p>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}

          {parsed.length > 0 && !result && (
            <div className="flex items-center gap-2 text-sm text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="shrink-0" />
              {parsed.length} compan{parsed.length !== 1 ? 'ies' : 'y'} ready to import.
            </div>
          )}

          {result && (
            <div className="space-y-2">
              {result.created.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                  <CheckCircle2 size={16} className="shrink-0" />
                  {result.created.length} compan{result.created.length !== 1 ? 'ies' : 'y'} added.
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <AlertTriangle size={16} className="shrink-0" />
                    {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped
                  </div>
                  <ul className="space-y-1 text-xs text-yellow-300/80">
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

        <div className="p-6 bg-[#1a1a1a] border-t border-[#333] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="cursor-pointer flex-1 py-3 rounded-xl bg-[#222] hover:bg-[#2a2a2a] font-bold transition-all">
            {result ? 'Close' : 'Cancel'}
          </button>
          <button
            disabled={uploading || parsed.length === 0}
            onClick={handleUpload}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
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
        className="bg-[#111] border border-[#333] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-[#333] bg-[#1a1a1a] rounded-t-3xl shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 size={20} className="text-purple-500" />
            {company ? 'Edit Company' : 'Add Company'}
          </h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-[#333] rounded-lg transition-colors text-[#888] hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {fields.map(({ key, label, placeholder, required }) => (
            <div key={key}>
              <label className="text-xs font-bold uppercase tracking-wider text-[#555] mb-1.5 block">
                {label}{required && <span className="text-purple-400"> *</span>}
              </label>
              <input
                type="text"
                value={form[key] as string}
                onChange={set(key)}
                placeholder={placeholder}
                className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#333] focus:border-purple-500 outline-none transition-all"
              />
            </div>
          ))}

          <label className="flex items-center gap-3 pt-2 cursor-pointer">
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
              className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${form.is_active ? 'bg-purple-600' : 'bg-[#333]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.is_active ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-[#888]">Active (eligible for scraping)</span>
          </label>
        </div>

        <div className="p-6 bg-[#1a1a1a] border-t border-[#333] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="cursor-pointer flex-1 py-3 rounded-xl bg-[#222] hover:bg-[#2a2a2a] font-bold transition-all">
            Cancel
          </button>
          <button
            disabled={saving || !canSave}
            onClick={() => onSave(form)}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            {company ? 'Save Changes' : 'Add Company'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
