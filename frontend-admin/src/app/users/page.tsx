'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  ArrowLeft,
  User as UserIcon,
  ShieldCheck,
  Crown,
  Calendar,
  Mail,
  Phone,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ArrowRight,
  CreditCard,
  Clock,
  RotateCcw,
  FileText,
  Link as LinkIcon,
  Globe,
  Lock,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  linkedin_url: string;
  has_resume: boolean;
  is_subscribed: boolean;
  subscription_expires_at: string | null;
  is_superuser: boolean;
  is_staff: boolean;
  portfolio_is_public: boolean;
}

interface Transaction {
  id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number;
  status: string;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [viewingTransactions, setViewingTransactions] = useState<UserProfile | null>(null);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState<number | null>(null);
  const router = useRouter();

  const copyPortfolioLink = (user: UserProfile) => {
    navigator.clipboard.writeText(`https://kaamlee.in/portfolio/${user.username}`);
    setCopiedUserId(user.id);
    setTimeout(() => setCopiedUserId(null), 2000);
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else if (res.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateUser = async (updatedData: any) => {
    if (!editingUser) return;
    const token = localStorage.getItem('admin_token');
    
    try {
      const res = await fetch(`${API_BASE}/users/${editingUser.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      });

      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      }
    } catch (error) {
      alert("Failed to update user");
    }
  };

  const toggleSubscription = async (userId: number) => {
    const token = localStorage.getItem('admin_token');
    // For simplicity, we'll use the subscribe endpoint or a patch
    // Actually, since we have a viewset, we can patch.
    const user = users.find(u => u.id === userId);
    if (!user) return;

    try {
      // We'll simulate a 1-month extension if we are turning it ON
      const nextExpires = !user.is_subscribed 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const res = await fetch(`${API_BASE}/users/${userId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
           is_subscribed: !user.is_subscribed,
           subscription_expires_at: nextExpires
        })
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      alert("Failed to update user");
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.is_superuser) {
      alert("Superuser accounts can't be deleted from here.");
      return;
    }
    if (!window.confirm(`Delete @${user.username}? This permanently removes their account, profile, and data. This can't be undone.`)) return;

    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== user.id));
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      alert('Failed to delete user');
    }
  };

  const fetchUserTransactions = async (userId: number) => {
    const token = localStorage.getItem('admin_token');
    setTxLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/transactions/?user_id=${userId}`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserTransactions(data);
      }
    } catch (error) {
      console.error("Failed to fetch tx:", error);
    } finally {
      setTxLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">User Management</h1>
              <p className="text-[#555] font-medium flex items-center gap-2">
                <Users size={16} />
                {users.length} total users registered
              </p>
            </div>
          </div>

          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" size={20} />
            <input 
              type="text"
              placeholder="Search by name, email or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-blue-500 transition-all text-sm"
            />
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-[#555] font-medium uppercase tracking-widest text-xs">Loading Directory</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse">
                <thead>
                  <tr className="border-b border-[#222] bg-[#161616]/50">
                    <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">User Details</th>
                    <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Status</th>
                    <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Subscription</th>
                    <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Contact</th>
                    <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Resume</th>
                    <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Portfolio</th>
                    <th className="text-right px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]/50">
                  <AnimatePresence mode='popLayout'>
                    {filteredUsers.map((user) => (
                      <motion.tr 
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-[#161616]/30 transition-colors group"
                      >
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-inner ${user.is_superuser ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                              {user.first_name ? user.first_name[0] : user.username[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white leading-tight">{user.first_name} {user.last_name}</span>
                                {user.is_superuser && <Crown size={14} className="text-amber-500" />}
                                {user.is_staff && !user.is_superuser && <ShieldCheck size={14} className="text-blue-500" />}
                              </div>
                              <div className="text-sm text-[#555] font-medium">@{user.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-2">
                             {user.is_staff ? (
                               <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-wider">Admin</span>
                             ) : (
                               <span className="px-3 py-1 rounded-full bg-[#222] text-[#555] text-[10px] font-black uppercase tracking-wider">Member</span>
                             )}
                          </div>
                        </td>
                        <td className="px-6 py-6">
                           <div className="flex flex-col gap-1">
                              {user.is_subscribed ? (
                                <>
                                  <div className="flex items-center gap-2 text-green-500 font-bold text-sm">
                                    <CheckCircle2 size={16} />
                                    Active Access
                                  </div>
                                  <div className="text-[14px] text-[#555] font-medium">
                                    Expires: {user.subscription_expires_at ? (() => {
                                      const d = new Date(user.subscription_expires_at);
                                      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                                    })() : ''}
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-2 text-[#444] font-bold text-sm">
                                  <XCircle size={16} />
                                  No Access
                                </div>
                              )}
                           </div>
                        </td>
                        <td className="px-6 py-6">
                           <div className="space-y-1">
                              <div className="flex items-center gap-2 text-[#888] text-sm hover:text-white transition-colors cursor-pointer">
                                <Mail size={14} />
                                {user.email}
                              </div>
                              {user.phone && (
                                <div className="flex items-center gap-2 text-[#888] text-sm">
                                  <Phone size={14} />
                                  {user.phone}
                                </div>
                              )}
                           </div>
                        </td>
                        <td className="px-6 py-6">
                           {user.has_resume ? (
                             <div className="flex items-center gap-2 text-green-500 font-bold text-sm">
                               <FileText size={16} />
                               Uploaded
                             </div>
                           ) : (
                             <div className="flex items-center gap-2 text-[#444] font-bold text-sm">
                               <XCircle size={16} />
                               None
                             </div>
                           )}
                        </td>
                        <td className="px-6 py-6">
                           <div className="space-y-1.5">
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                user.portfolio_is_public ? 'bg-green-500/10 text-green-500' : 'bg-[#222] text-[#555]'
                              }`}>
                                {user.portfolio_is_public ? <Globe size={12} /> : <Lock size={12} />}
                                {user.portfolio_is_public ? 'Public' : 'Private'}
                              </div>
                              <div className="flex items-center gap-3">
                                <a
                                  href={`https://kaamlee.in/portfolio/${user.username}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-[#888] hover:text-white font-mono truncate max-w-[140px]"
                                  title={`kaamlee.in/portfolio/${user.username}`}
                                >
                                  <ExternalLink size={10} className="shrink-0" />
                                  <span className="truncate">/portfolio/{user.username}</span>
                                </a>
                                <button
                                  onClick={() => copyPortfolioLink(user)}
                                  className="cursor-pointer shrink-0 text-[#555] hover:text-white transition-colors"
                                  title="Copy portfolio link"
                                >
                                  {copiedUserId === user.id ? <CheckCircle2 size={12} className="text-green-500" /> : <LinkIcon size={12} />}
                                </button>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-6 text-right">
                           <div className="flex items-center justify-end gap-3 transition-opacity">
                              <button 
                                onClick={() => toggleSubscription(user.id)}
                                className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition-all ${user.is_subscribed ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}
                              >
                                {user.is_subscribed ? 'Revoke' : 'Grant Access'}
                              </button>
                               <button 
                                onClick={() => {
                                  setViewingTransactions(user);
                                  fetchUserTransactions(user.id);
                                }}
                                className="cursor-pointer p-2 rounded-lg bg-[#222] hover:bg-[#333] transition-colors text-[#888] hover:text-white"
                                title="View Transactions"
                              >
                                <CreditCard size={18} />
                              </button>
                              <button
                                onClick={() => setEditingUser(user)}
                                className="cursor-pointer p-2 rounded-lg bg-[#222] hover:bg-[#333] transition-colors text-[#888] hover:text-white"
                                title="Edit User"
                              >
                                <MoreHorizontal size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                disabled={user.is_superuser}
                                className="cursor-pointer p-2 rounded-lg bg-[#222] hover:bg-red-500/20 transition-colors text-[#888] hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#222] disabled:hover:text-[#888]"
                                title={user.is_superuser ? "Superusers can't be deleted" : "Delete User"}
                              >
                                <Trash2 size={18} />
                              </button>
                           </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              </div>

              {filteredUsers.length === 0 && (
                <div className="py-20 text-center">
                  <AlertCircle className="w-12 h-12 text-[#222] mx-auto mb-4" />
                  <p className="text-[#555] font-medium">No users match your criteria</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingUser && (
          <EditUserModal 
            user={editingUser} 
            onClose={() => setEditingUser(null)} 
            onSave={handleUpdateUser} 
          />
        )}

        {viewingTransactions && (
          <TransactionsModal 
            user={viewingTransactions} 
            transactions={userTransactions} 
            loading={txLoading} 
            onClose={() => {
              setViewingTransactions(null);
              setUserTransactions([]);
            }} 
            onRefresh={() => fetchUserTransactions(viewingTransactions.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EditUserModal({ user, onClose, onSave }: { user: UserProfile, onClose: () => void, onSave: (data: any) => void }) {
  const [formData, setFormData] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    linkedin_url: user.linkedin_url,
    is_subscribed: user.is_subscribed,
    subscription_expires_at: user.subscription_expires_at ? (() => {
      const d = new Date(user.subscription_expires_at);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    })() : ''
  });

  const handleSave = () => {
    const data = { ...formData };
    if (data.subscription_expires_at) {
      const [day, month, year] = data.subscription_expires_at.split('/');
      if (day && month && year) {
        data.subscription_expires_at = new Date(`${year}-${month}-${day}`).toISOString();
      }
    }
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#111] border border-[#222] rounded-3xl w-full lg:max-w-xl overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-[#222] flex items-center justify-between">
          <h2 className="text-2xl font-bold">Edit User Details</h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-[#222] rounded-xl text-[#555] hover:text-white transition-colors">
            <ArrowRight size={20} className="rotate-180" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 px-1">First Name</label>
              <input 
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                className="w-full bg-black border border-[#222] rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 px-1">Last Name</label>
              <input 
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                className="w-full bg-black border border-[#222] rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 px-1">Phone Number</label>
            <input 
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full bg-black border border-[#222] rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 px-1">LinkedIn URL</label>
            <input 
              type="text"
              value={formData.linkedin_url}
              onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})}
              className="w-full bg-black border border-[#222] rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 px-1">Subscription Status</label>
              <select 
                value={formData.is_subscribed ? 'true' : 'false'}
                onChange={(e) => setFormData({...formData, is_subscribed: e.target.value === 'true'})}
                className="w-full bg-black border border-[#222] rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all text-sm"
              >
                <option value="true">Active Access</option>
                <option value="false">No Access</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 px-1">Expiry Date (DD/MM/YYYY)</label>
              <input 
                type="text"
                placeholder="DD/MM/YYYY"
                value={formData.subscription_expires_at}
                onChange={(e) => setFormData({...formData, subscription_expires_at: e.target.value})}
                className="w-full bg-black border border-[#222] rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all text-sm"
              />
            </div>
          </div>
        </div>

        <div className="p-8 bg-[#161616]/50 border-t border-[#222] flex items-center justify-end gap-4">
          <button onClick={onClose} className="cursor-pointer px-6 py-3 font-bold text-[#555] hover:text-white transition-colors">Cancel</button>
          <button 
            onClick={handleSave}
            className="cursor-pointer bg-white text-black hover:bg-gray-200 px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}


function TransactionsModal({ user, transactions, loading, onClose, onRefresh }: { user: UserProfile, transactions: Transaction[], loading: boolean, onClose: () => void, onRefresh: () => void }) {
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);

  const handleCheckStatus = async (orderId: string) => {
    const token = localStorage.getItem('admin_token');
    setCheckingStatus(orderId);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/check-status/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ razorpay_order_id: orderId })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        onRefresh();
      } else {
        alert(data.message || "Payment still pending or not found on Razorpay.");
      }
    } catch (error) {
      console.error("Error checking status:", error);
    } finally {
      setCheckingStatus(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#111] border border-[#222] rounded-3xl w-full lg:max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-8 border-b border-[#222] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Billing History</h2>
            <p className="text-sm text-[#555]">Transactions for @{user.username}</p>
          </div>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-[#222] rounded-xl text-[#555] hover:text-white transition-colors">
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-[#555] text-xs font-bold uppercase tracking-widest">Retrieving logs</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-[#222] mx-auto mb-4" />
              <p className="text-[#555] font-medium">No transactions found for this user.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="bg-black/40 border border-[#222] rounded-2xl p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      tx.status === 'success' ? 'bg-green-500/10 text-green-500' : 
                      tx.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {tx.status === 'success' ? <CheckCircle2 size={18} /> : 
                       tx.status === 'failed' ? <XCircle size={18} /> : <Clock size={18} />}
                    </div>
                    <div>
                      <div className="font-bold">₹{tx.amount / 100}</div>
                      <div className="text-[10px] text-[#555] uppercase tracking-wider font-mono">
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#333]">Order ID</div>
                    <div className="flex items-center gap-2 justify-end">
                      {tx.status === 'pending' && (
                        <button 
                          onClick={() => handleCheckStatus(tx.razorpay_order_id)}
                          disabled={checkingStatus === tx.razorpay_order_id}
                          className="cursor-pointer p-1 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all"
                          title="Refresh Status"
                        >
                          <RotateCcw size={10} className={`${checkingStatus === tx.razorpay_order_id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      <div className="text-[10px] font-mono text-[#666]">{tx.razorpay_order_id}</div>
                    </div>
                    <div className={`text-[10px] font-black uppercase mt-1 ${
                      tx.status === 'success' ? 'text-green-500/50' : 
                      tx.status === 'failed' ? 'text-red-500/50' : 'text-blue-500/50'
                    }`}>{tx.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-8 bg-[#161616]/50 border-t border-[#222] flex items-center justify-end shrink-0">
          <button 
            onClick={onClose}
            className="cursor-pointer bg-[#222] text-white hover:bg-[#333] px-8 py-3 rounded-xl font-bold transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
