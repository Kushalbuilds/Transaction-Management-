import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Activity, ArrowDownToLine, ArrowUpRight, BarChart3, Briefcase, Building, Building2, CalendarDays,
  Check, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList,
  Clock3, Cloud, Construction, Download, Eye, FileText, Filter, HardHat, LayoutDashboard,
  LogOut, Menu, Moon, Pencil, PieChart as PieIcon, Plus, Search, Settings, Sparkles, Sun, Trash2, TrendingUp, Users,
  Wallet, X
} from 'lucide-react';
import './App.css';
import AuthModal, { getCurrentUser, setCurrentUser } from './AuthModal.jsx';
import { subscribeToCloudData, saveToCloud } from './firestoreSync.js';

/* ── Keys for localStorage ── */
const STORAGE_KEY = 'buildpay-payments-v1';
const NAMES_KEY = 'buildpay-names-v1';
const WORKTYPES_KEY = 'buildpay-worktypes-v1';
const BUDGET_KEY = 'buildpay-budget-v1';

const THEME_KEY = 'buildpay-theme-mode-v1';
const FIRMS_KEY = 'buildpay-firms-v1';

/* ── Old mock project names to clean out so user starts with clean slate ── */
const MOCK_PROJECT_NAMES = new Set([
  'Main Site Tower A', 'Commercial Complex', 'Highway Extension',
  'Green Valley Villas', 'Lakefront Residency', 'Riverview Enclave',
  'Gurudarshini Heights', 'Temple View Layout', 'Sunrise Arcade',
  'Rex Plaza Phase 1', 'Industrial Warehouse', 'North Gate Extension',
  'Rex Smart City', 'Eco Park Residences', 'Rex Avenue Block B',
  'Sai Pride Tower', 'Sai Paradise Block B', 'Sai Shanti Complex',
  'Adishakti Arcade', 'Heritage Homes', 'Central Mall Project',
  'Arjun Empire Phase 1', 'Kalyan Sangha Hall', 'Sector 4 Towers',
  'Project Phase 1', 'Phase 1', 'General Work'
]);

/* ── Default Firms (Projects start empty as requested) ── */
const DEFAULT_FIRMS = [
  { id: 'FIRM-001', name: 'Bhandurge Constructions', projects: [], incoming: [], outgoing: [] },
  { id: 'FIRM-002', name: 'Bhandurge Ventures', projects: [], incoming: [], outgoing: [] },
  { id: 'FIRM-003', name: 'Gurudarshini Builders', projects: [], incoming: [], outgoing: [] },
  { id: 'FIRM-004', name: 'Rex Constructions', projects: [], incoming: [], outgoing: [] },
  { id: 'FIRM-005', name: 'Rex Builders & Developers', projects: [], incoming: [], outgoing: [] },
  { id: 'FIRM-006', name: 'Shri Sai Builders & Developers', projects: [], incoming: [], outgoing: [] },
  { id: 'FIRM-007', name: 'Shri Adishakti Constructions', projects: [], incoming: [], outgoing: [] },
  { id: 'FIRM-008', name: 'K.B.C Arjun Empire Kalyan Sangha', projects: [], incoming: [], outgoing: [] },
];

function normalizeFirms(list) {
  if (!Array.isArray(list)) return DEFAULT_FIRMS;
  return list.map(f => {
    // Filter out old mock projects so firms start clean without mock projects
    const cleanProjects = Array.isArray(f.projects)
      ? f.projects.filter(p => p && !MOCK_PROJECT_NAMES.has(p))
      : [];
    return {
      ...f,
      projects: cleanProjects,
      incoming: Array.isArray(f.incoming) ? f.incoming : [],
      outgoing: Array.isArray(f.outgoing) ? f.outgoing : []
    };
  });
}

/* ── Date / Time helpers ── */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n || 0));
const formatDate = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatDateTime = (p) => `${formatDate(p.date)}, ${p.time || '—'}`;

/* ── Relative Time calculation ("seconds ago", "hours ago", "days ago", "weeks ago") ── */
function formatRelativeTime(dateInput) {
  if (!dateInput) return 'Not yet updated';
  const past = new Date(dateInput).getTime();
  if (isNaN(past)) return 'Recently';
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));

  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec} second${diffSec === 1 ? '' : 's'} ago`;
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

function formatFullTimestamp(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
}

/* ── Defaults ── */
const DEFAULT_NAMES = ['Santosh', 'Kedar', 'Yallappa', 'Shivappa', 'Ramesh'];
const DEFAULT_WORKTYPES = ['BS', 'Sai', 'Labour', 'Carpenter', 'Survey'];
const methods = ['Cash', 'UPI', 'Cheque', 'RTGS'];

const nowIso = new Date().toISOString();
const hourAgoIso = new Date(Date.now() - 3600 * 1000 * 2).toISOString();
const dayAgoIso = new Date(Date.now() - 86400 * 1000 * 1).toISOString();
const weekAgoIso = new Date(Date.now() - 86400 * 1000 * 5).toISOString();

const initialPayments = [
  { id: 'PAY-0001', name: 'Santosh', amount: 2500, date: '2026-10-15', time: '10:30', workType: 'BS', method: 'Cash', remark: 'Foundation work', status: 'Paid', updatedAt: nowIso },
  { id: 'PAY-0002', name: 'Kedar', amount: 8000, date: '2026-10-15', time: '11:45', workType: 'Sai', method: 'UPI', remark: 'Sai work materials', status: 'Paid', updatedAt: hourAgoIso },
  { id: 'PAY-0003', name: 'Yallappa', amount: 3000, date: '2026-10-15', time: '14:15', workType: 'Labour', method: 'Cash', remark: 'Daily labour wages', status: 'Pending', updatedAt: dayAgoIso },
  { id: 'PAY-0004', name: 'Shivappa', amount: 15000, date: '2026-10-14', time: '16:20', workType: 'Carpenter', method: 'Cheque', remark: 'Door frames (Chq #582910)', status: 'Paid', updatedAt: weekAgoIso },
  { id: 'PAY-0005', name: 'Ramesh', amount: 12000, date: '2026-10-13', time: '11:10', workType: 'Survey', method: 'Cheque', remark: 'Site survey charges (Chq #61092)', status: 'Pending', updatedAt: weekAgoIso },
];

/* ── Helpers ── */
function readStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function createId(payments) {
  const max = payments.reduce((h, p) => {
    const m = String(p.id).match(/PAY-(\d+)/);
    return Math.max(h, m ? Number(m[1]) : 0);
  }, 0);
  return `PAY-${String(max + 1).padStart(4, '0')}`;
}
function initials(name = '') { return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '—'; }
const blankForm = (names, workTypes) => ({
  name: names[0] || '', amount: '', date: today(), time: nowTime(),
  workType: workTypes[0] || '', method: 'Cash', remark: '', status: 'Paid',
  firmId: '', firmName: '', project: ''
});

/* ══════════════════════════════════════════════ */
/*                    APP                          */
/* ══════════════════════════════════════════════ */
function App() {
  /* ── State ── */
  const [payments, setPayments] = useState(() => readStorage(STORAGE_KEY, initialPayments));
  const [names, setNames] = useState(() => readStorage(NAMES_KEY, DEFAULT_NAMES));
  const [workTypes, setWorkTypes] = useState(() => readStorage(WORKTYPES_KEY, DEFAULT_WORKTYPES));
  const [projectBudget, setProjectBudget] = useState(() => readStorage(BUDGET_KEY, 500000));

  const [activePage, setActivePage] = useState('Dashboard');
  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('All methods');
  const [workTypeFilter, setWorkTypeFilter] = useState('All types');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('This month');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => blankForm(names, workTypes));
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWorkType, setNewWorkType] = useState('');
  const [editingBudgetInline, setEditingBudgetInline] = useState(false);
  const [inlineBudgetVal, setInlineBudgetVal] = useState(String(projectBudget));
  const [budgetInput, setBudgetInput] = useState(String(projectBudget));
  const [currentUser, setCurrentUserState] = useState(() => getCurrentUser());
  const [showAuthModal, setShowAuthModal] = useState(() => !getCurrentUser());
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'light'; }
    catch { return 'light'; }
  });

  /* ── Firms State ── */
  const [firms, setFirms] = useState(() => normalizeFirms(readStorage(FIRMS_KEY, DEFAULT_FIRMS)));
  const [firmProjectFilter, setFirmProjectFilter] = useState({}); // { [firmId]: 'all' | 'projectName' }
  const [addingProjectFirmIdx, setAddingProjectFirmIdx] = useState(null);
  const [newProjectNameInput, setNewProjectNameInput] = useState('');
  const [firmModalOpen, setFirmModalOpen] = useState(false);
  const [firmModalType, setFirmModalType] = useState('incoming'); // 'incoming' | 'outgoing'
  const [firmModalIdx, setFirmModalIdx] = useState(null);
  const [firmTxForm, setFirmTxForm] = useState({ amount: '', date: today(), time: nowTime(), remark: '', method: 'Cash', paidTo: '', project: 'General Work' });
  const [editingTxId, setEditingTxId] = useState(null); // null when adding new, string when editing existing tx
  const [addFirmModalOpen, setAddFirmModalOpen] = useState(false);
  const [newFirmName, setNewFirmName] = useState('');
  const [expandedFirmIdx, setExpandedFirmIdx] = useState(null);
  const [viewFirmIdx, setViewFirmIdx] = useState(null);
  const [editFirmIdx, setEditFirmIdx] = useState(null);
  const [editFirmName, setEditFirmName] = useState('');
  const [editFirmProjects, setEditFirmProjects] = useState([]);
  const [newProjectInEdit, setNewProjectInEdit] = useState('');
  const [deleteFirmTarget, setDeleteFirmTarget] = useState(null);

  /* ── Export to Excel Modal State with Firm Toggle Options ── */
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState('firm'); // 'firm' | 'all_firms' | 'general'
  const [selectedFirmId, setSelectedFirmId] = useState(() => (DEFAULT_FIRMS[0]?.id || 'FIRM-001'));
  const [selectedFirmProject, setSelectedFirmProject] = useState('all');
  const [exportIncludeOutgoing, setExportIncludeOutgoing] = useState(true);
  const [exportIncludeIncoming, setExportIncludeIncoming] = useState(true);
  const [exportIncludeSummary, setExportIncludeSummary] = useState(true);

  const [cloudStatus, setCloudStatus] = useState('connecting'); // 'connecting' | 'synced' | 'local'
  const isInitialCloudLoad = React.useRef(true);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    try { localStorage.setItem(THEME_KEY, nextTheme); } catch {}
    setToast(`Theme switched to ${nextTheme === 'dark' ? 'Dark Mode 🌙' : 'Light Mode ☀️'}`);
  };

  // Sync theme attribute on document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLoginSuccess = (user) => {
    setCurrentUserState(user);
    setShowAuthModal(false);
    setToast(`Signed in as ${user.fullName || user.username}`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserState(null);
    setShowAuthModal(true);
    setToast('Logged out successfully.');
  };

  /* ── Cloud Sync (Firebase Firestore) ── */
  useEffect(() => {
    const unsubscribe = subscribeToCloudData((cloudData) => {
      if (cloudData) {
        if (Array.isArray(cloudData.payments)) setPayments(cloudData.payments);
        if (Array.isArray(cloudData.names)) setNames(cloudData.names);
        if (Array.isArray(cloudData.workTypes)) setWorkTypes(cloudData.workTypes);
        if (typeof cloudData.projectBudget === 'number') setProjectBudget(cloudData.projectBudget);
        if (Array.isArray(cloudData.firms)) setFirms(normalizeFirms(cloudData.firms));
        setCloudStatus('synced');
      } else {
        // If document doesn't exist yet, seed initial local data to cloud
        saveToCloud({ payments, names, workTypes, projectBudget, firms });
        setCloudStatus('synced');
      }
      isInitialCloudLoad.current = false;
    });

    return () => unsubscribe();
  }, []);

  // Sync state changes up to Firestore
  useEffect(() => {
    if (isInitialCloudLoad.current) return;
    const timer = setTimeout(() => {
      saveToCloud({ payments, names, workTypes, projectBudget, firms })
        .then(() => setCloudStatus('synced'))
        .catch(() => setCloudStatus('local'));
    }, 500);
    return () => clearTimeout(timer);
  }, [payments, names, workTypes, projectBudget, firms]);

  /* ── Persist (Local Backup) ── */
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payments)); } catch {} }, [payments]);
  useEffect(() => { try { localStorage.setItem(NAMES_KEY, JSON.stringify(names)); } catch {} }, [names]);
  useEffect(() => { try { localStorage.setItem(WORKTYPES_KEY, JSON.stringify(workTypes)); } catch {} }, [workTypes]);
  useEffect(() => { try { localStorage.setItem(BUDGET_KEY, JSON.stringify(projectBudget)); } catch {} }, [projectBudget]);
  useEffect(() => { try { localStorage.setItem(FIRMS_KEY, JSON.stringify(firms)); } catch {} }, [firms]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); }, [toast]);

  /* ── Status Checkbox Toggle ── */
  function togglePaymentStatus(id) {
    setPayments(prev => prev.map(p => {
      if (p.id === id) {
        const nextStatus = p.status === 'Paid' ? 'Pending' : 'Paid';
        setToast(`${p.id} (${p.name}) marked as ${nextStatus}.`);
        return { ...p, status: nextStatus, updatedAt: new Date().toISOString() };
      }
      return p;
    }));
  }

  /* ── Filtering ── */
  const filteredByDate = useMemo(() => payments.filter(p => {
    if (dateFilter === 'All time') return true;
    const d = new Date(`${p.date}T00:00:00`);
    const now = new Date();
    if (dateFilter === 'Today') return p.date === today();
    if (dateFilter === 'This month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (dateFilter === 'This year') return d.getFullYear() === now.getFullYear();
    return true;
  }).filter(p => workTypeFilter === 'All types' || p.workType === workTypeFilter)
    .filter(p => statusFilter === 'All' || p.status === statusFilter), [payments, dateFilter, workTypeFilter, statusFilter]);

  const visiblePayments = useMemo(() => filteredByDate.filter(p => {
    const hay = [p.id, p.name, p.workType, p.method, p.remark].join(' ').toLowerCase();
    const methodMatch = methodFilter === 'All methods' || p.method === methodFilter ||
      (methodFilter === 'Cheque' && (p.method === 'Cheque' || p.method === 'Check'));
    return hay.includes(query.toLowerCase()) && methodMatch;
  }).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)), [filteredByDate, query, methodFilter]);

  /* ── Computed stats ── */
  const totalPaid = filteredByDate.filter(p => p.status === 'Paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPending = filteredByDate.filter(p => p.status === 'Pending').reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayPaid = payments.filter(p => p.date === today() && p.status === 'Paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayCount = payments.filter(p => p.date === today()).length;
  const uniquePeople = new Set(payments.map(p => p.name.trim().toLowerCase())).size;
  const remaining = projectBudget - totalPaid;

  const workTypeTotals = useMemo(() => {
    const totals = {};
    filteredByDate.forEach(p => {
      const key = p.workType || 'Other';
      totals[key] = (totals[key] || 0) + Number(p.amount || 0);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [filteredByDate]);

  const methodTotals = useMemo(() => methods.map(method => ({
    method,
    total: filteredByDate.filter(p => {
      if (method === 'Cheque') return p.method === 'Cheque' || p.method === 'Check';
      return p.method === method;
    }).reduce((s, p) => s + Number(p.amount || 0), 0)
  })), [filteredByDate]);

  /* ── Person-wise totals (combines payments & all known names) ── */
  const personTotals = useMemo(() => {
    const map = {};
    names.forEach(n => {
      const key = n.trim();
      if (key && !map[key]) map[key] = { name: key, paid: 0, pending: 0, count: 0 };
    });
    payments.forEach(p => {
      const key = p.name.trim();
      if (!map[key]) map[key] = { name: key, paid: 0, pending: 0, count: 0 };
      map[key].count += 1;
      if (p.status === 'Paid') map[key].paid += Number(p.amount || 0);
      else map[key].pending += Number(p.amount || 0);
    });
    return Object.values(map).sort((a, b) => (b.paid + b.pending) - (a.paid + a.pending));
  }, [payments, names]);

  /* ── Chart Mode State & Data ── */
  const [barMode, setBarMode] = useState('workType'); // 'workType' | 'person'
  const [pieMode, setPieMode] = useState('mode'); // 'mode' (Cash/UPI/Cheque/RTGS) | 'status' (Paid/Pending)

  const pieModeData = useMemo(() => [
    { label: 'Cash', value: filteredByDate.filter(p => p.method === 'Cash').reduce((s, p) => s + Number(p.amount || 0), 0), color: '#2563eb' }, // Blue
    { label: 'UPI', value: filteredByDate.filter(p => p.method === 'UPI').reduce((s, p) => s + Number(p.amount || 0), 0), color: '#f97316' }, // Orange
    { label: 'Cheque', value: filteredByDate.filter(p => p.method === 'Cheque' || p.method === 'Check').reduce((s, p) => s + Number(p.amount || 0), 0), color: '#ef4444' }, // Red
    { label: 'RTGS', value: filteredByDate.filter(p => (p.method || '').toUpperCase() === 'RTGS').reduce((s, p) => s + Number(p.amount || 0), 0), color: '#10b981' } // Emerald Green
  ], [filteredByDate]);

  const pieStatusData = useMemo(() => [
    { label: 'Paid', value: totalPaid, color: '#2563eb' }, // Blue
    { label: 'Pending', value: totalPending, color: '#f97316' } // Orange
  ], [totalPaid, totalPending]);

  const barWorkTypeData = useMemo(() => {
    const colors = ['#2563eb', '#f97316', '#ef4444', '#3b82f6', '#fb923c', '#f87171', '#60a5fa'];
    return workTypeTotals.map(([name, val], i) => ({
      label: name,
      value: val,
      color: colors[i % colors.length]
    }));
  }, [workTypeTotals]);

  const barPersonData = useMemo(() => {
    const colors = ['#2563eb', '#f97316', '#ef4444', '#3b82f6', '#fb923c', '#f87171'];
    return personTotals.slice(0, 6).map((p, i) => ({
      label: p.name,
      value: p.paid + p.pending,
      color: colors[i % colors.length]
    }));
  }, [personTotals]);

  /* ── CRUD ── */
  function openAdd() {
    setEditingId(null); setForm(blankForm(names, workTypes)); setFormError(''); setModalOpen(true);
  }
  function openEdit(payment) {
    setEditingId(payment.id);
    setForm({
      ...payment,
      amount: String(payment.amount),
      firmId: payment.firmId || '',
      firmName: payment.firmName || '',
      project: payment.project || ''
    });
    setFormError(''); setModalOpen(true);
  }
  function updateForm(key, value) { setForm(prev => ({ ...prev, [key]: value })); }

  /* ── Synchronize main payment with firm's spending history ── */
  function syncPaymentToFirms(savedPayment) {
    setFirms(prevFirms => {
      return prevFirms.map(f => {
        // Remove any old linked transaction for this payment from any firm
        let updatedOutgoing = (f.outgoing || []).filter(
          t => t.linkedPaymentId !== savedPayment.id && t.id !== `FTX-${savedPayment.id}`
        );

        // If this firm is assigned to the payment, add the outgoing transaction record
        if (savedPayment.firmId && f.id === savedPayment.firmId) {
          const firmTx = {
            id: `FTX-${savedPayment.id}`,
            linkedPaymentId: savedPayment.id,
            amount: Number(savedPayment.amount),
            date: savedPayment.date,
            time: savedPayment.time || nowTime(),
            paidTo: savedPayment.name,
            project: savedPayment.project || 'General Work',
            method: savedPayment.method || 'Cash',
            remark: savedPayment.remark ? `${savedPayment.workType} — ${savedPayment.remark}` : savedPayment.workType,
            createdAt: savedPayment.updatedAt || new Date().toISOString(),
          };
          updatedOutgoing = [firmTx, ...updatedOutgoing];
        }

        return {
          ...f,
          outgoing: updatedOutgoing
        };
      });
    });
  }

  function savePayment(e) {
    e.preventDefault();
    if (!form.name.trim()) return setFormError("Select or enter the person's name.");
    if (!form.amount || !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) return setFormError('Enter an amount greater than zero.');
    if (!form.date) return setFormError('Choose a payment date.');
    if (!form.workType.trim()) return setFormError('Select a work type.');

    const selectedFirmObj = firms.find(f => f.id === form.firmId);
    const resolvedFirmName = selectedFirmObj ? selectedFirmObj.name : (form.firmName || '');
    const resolvedProject = form.project || (selectedFirmObj?.projects?.[0] || 'General Work');

    const nowTimestamp = new Date().toISOString();
    const clean = {
      ...form,
      name: form.name.trim(),
      amount: Number(form.amount),
      remark: form.remark.trim(),
      workType: form.workType.trim(),
      firmId: form.firmId || '',
      firmName: resolvedFirmName,
      project: form.firmId ? resolvedProject : '',
      updatedAt: nowTimestamp
    };

    if (editingId) {
      const fullPayment = { ...clean, id: editingId };
      setPayments(prev => prev.map(p => p.id === editingId ? fullPayment : p));
      syncPaymentToFirms(fullPayment);
      setToast(resolvedFirmName ? `Payment updated & recorded in ${resolvedFirmName}.` : 'Payment updated successfully.');
    } else {
      const newId = createId(payments);
      const fullPayment = { ...clean, id: newId };
      setPayments(prev => [fullPayment, ...prev]);
      syncPaymentToFirms(fullPayment);
      setToast(resolvedFirmName ? `Payment saved & recorded under ${resolvedFirmName}!` : 'Payment saved successfully.');
    }
    setModalOpen(false);
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setPayments(prev => prev.filter(p => p.id !== targetId));
    // Remove linked transaction from firm spending history
    setFirms(prevFirms => prevFirms.map(f => ({
      ...f,
      outgoing: (f.outgoing || []).filter(t => t.linkedPaymentId !== targetId && t.id !== `FTX-${targetId}`)
    })));
    setDeleteTarget(null);
    setToast('Payment deleted and removed from firm history.');
  }

  /* ── Excel Export Functions (Firm-Specific & Master Reports) ── */
  function exportFirmExcel(firm, projectFilter = 'all', options = { includeOutgoing: true, includeIncoming: true, includeSummary: true }) {
    try {
      if (!firm) {
        setToast('Please select a firm to export.');
        return;
      }

      const wb = XLSX.utils.book_new();

      // Filter incoming and outgoing by project if specified
      const outList = (firm.outgoing || []).filter(t => {
        if (projectFilter === 'all') return true;
        return (t.project || 'General').toLowerCase() === projectFilter.toLowerCase();
      });

      const inList = (firm.incoming || []).filter(t => {
        if (projectFilter === 'all') return true;
        return (t.project || 'General').toLowerCase() === projectFilter.toLowerCase();
      });

      const totalOut = outList.reduce((s, t) => s + Number(t.amount || 0), 0);
      const totalIn = inList.reduce((s, t) => s + Number(t.amount || 0), 0);
      const net = totalIn - totalOut;

      // 1. Firm Summary Sheet
      if (options.includeSummary) {
        const summaryRows = [
          { 'Metric': 'Firm Name', 'Details': firm.name },
          { 'Metric': 'Firm ID', 'Details': firm.id },
          { 'Metric': 'Project Scope Filter', 'Details': projectFilter === 'all' ? 'All Projects' : projectFilter },
          { 'Metric': 'Total Outgoing (Money Spent)', 'Details': `₹${totalOut.toLocaleString('en-IN')}` },
          { 'Metric': 'Total Incoming (Money Received)', 'Details': `₹${totalIn.toLocaleString('en-IN')}` },
          { 'Metric': 'Net Balance (In - Out)', 'Details': `₹${net.toLocaleString('en-IN')}` },
          { 'Metric': 'Outgoing Transactions Count', 'Details': outList.length },
          { 'Metric': 'Incoming Transactions Count', 'Details': inList.length },
          { 'Metric': 'Total Records', 'Details': outList.length + inList.length },
          { 'Metric': 'Registered Projects', 'Details': (firm.projects || []).join(', ') || 'None' },
          { 'Metric': 'Report Generated On', 'Details': `${today()} ${nowTime()}` },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        wsSummary['!cols'] = [{ wch: 32 }, { wch: 45 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Firm Summary');
      }

      // 2. Money Spent / Outgoing Sheet
      if (options.includeOutgoing) {
        const outgoingRows = outList.map((t, idx) => ({
          '#': idx + 1,
          'Transaction ID': t.id,
          'Date': t.date,
          'Time': t.time || '—',
          'Project': t.project || 'General',
          'Paid To / Vendor': t.paidTo || '—',
          'Outgoing Amount (₹)': Number(t.amount || 0),
          'Payment Mode': t.method || 'Cash',
          'Remark / Purpose': t.remark || '—',
          'Recorded Timestamp': t.createdAt ? formatFullTimestamp(t.createdAt) : '—',
        }));

        const wsOut = outgoingRows.length > 0
          ? XLSX.utils.json_to_sheet(outgoingRows)
          : XLSX.utils.json_to_sheet([{ 'Notice': `No outgoing payments found for ${firm.name} (${projectFilter === 'all' ? 'All Projects' : projectFilter})` }]);
        wsOut['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 24 }];
        XLSX.utils.book_append_sheet(wb, wsOut, 'Money Spent (Outgoing)');
      }

      // 3. Money Received / Incoming Sheet
      if (options.includeIncoming) {
        const incomingRows = inList.map((t, idx) => ({
          '#': idx + 1,
          'Transaction ID': t.id,
          'Date': t.date,
          'Time': t.time || '—',
          'Project': t.project || 'General',
          'Received From / Client': t.paidTo || 'Client',
          'Incoming Amount (₹)': Number(t.amount || 0),
          'Payment Mode': t.method || 'Cash',
          'Remark / Purpose': t.remark || '—',
          'Recorded Timestamp': t.createdAt ? formatFullTimestamp(t.createdAt) : '—',
        }));

        const wsIn = incomingRows.length > 0
          ? XLSX.utils.json_to_sheet(incomingRows)
          : XLSX.utils.json_to_sheet([{ 'Notice': `No incoming payments found for ${firm.name} (${projectFilter === 'all' ? 'All Projects' : projectFilter})` }]);
        wsIn['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 24 }];
        XLSX.utils.book_append_sheet(wb, wsIn, 'Money Received (Incoming)');
      }

      // 4. Projects Breakdown Sheet
      const allProjNames = Array.from(new Set([
        ...(firm.projects || []),
        ...(firm.outgoing || []).map(t => t.project || 'General'),
        ...(firm.incoming || []).map(t => t.project || 'General')
      ])).filter(Boolean);

      if (allProjNames.length > 0) {
        const projectBreakdownRows = allProjNames.map(pName => {
          const pOut = (firm.outgoing || []).filter(t => (t.project || 'General').toLowerCase() === pName.toLowerCase());
          const pIn = (firm.incoming || []).filter(t => (t.project || 'General').toLowerCase() === pName.toLowerCase());
          const pOutSum = pOut.reduce((s, t) => s + Number(t.amount || 0), 0);
          const pInSum = pIn.reduce((s, t) => s + Number(t.amount || 0), 0);
          return {
            'Project Name': pName,
            'Total Outgoing Spent (₹)': pOutSum,
            'Total Incoming Received (₹)': pInSum,
            'Net Balance (₹)': pInSum - pOutSum,
            'Outgoing Records': pOut.length,
            'Incoming Records': pIn.length,
            'Total Transactions': pOut.length + pIn.length
          };
        });
        const wsProjects = XLSX.utils.json_to_sheet(projectBreakdownRows);
        wsProjects['!cols'] = [{ wch: 25 }, { wch: 24 }, { wch: 26 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsProjects, 'Projects Breakdown');
      }

      const cleanFirm = firm.name.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanProj = projectFilter !== 'all' ? `_${projectFilter.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const filename = `BuildPay_${cleanFirm}${cleanProj}_History_${today()}.xlsx`;

      XLSX.writeFile(wb, filename);
      setToast(`Downloaded ${filename} successfully!`);
      setExportModalOpen(false);
    } catch (err) {
      console.error('Firm Excel export error:', err);
      setToast('Export failed. Please try again.');
    }
  }

  /* ── Export All 8 Firms Combined Report ── */
  function exportAllFirmsExcel() {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Directory Sheet
      const dirRows = firms.map(f => {
        const totalIn = (f.incoming || []).reduce((s, t) => s + Number(t.amount || 0), 0);
        const totalOut = (f.outgoing || []).reduce((s, t) => s + Number(t.amount || 0), 0);
        return {
          'Firm ID': f.id,
          'Firm Name': f.name,
          'Projects Count': (f.projects || []).length,
          'Registered Projects': (f.projects || []).join(', ') || 'None',
          'Total Outgoing Spent (₹)': totalOut,
          'Total Incoming Received (₹)': totalIn,
          'Net Balance (₹)': totalIn - totalOut,
          'Outgoing Records': (f.outgoing || []).length,
          'Incoming Records': (f.incoming || []).length,
          'Total Records': (f.outgoing || []).length + (f.incoming || []).length,
        };
      });
      const wsDir = XLSX.utils.json_to_sheet(dirRows);
      wsDir['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 14 }, { wch: 35 }, { wch: 24 }, { wch: 26 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsDir, 'All Firms Directory');

      // 2. All Outgoing spending transactions
      const allOutRows = [];
      firms.forEach(f => {
        (f.outgoing || []).forEach((t, i) => {
          allOutRows.push({
            'Firm Name': f.name,
            'Firm ID': f.id,
            'Transaction ID': t.id,
            'Date': t.date,
            'Time': t.time || '—',
            'Project': t.project || 'General',
            'Paid To / Vendor': t.paidTo || '—',
            'Outgoing Amount (₹)': Number(t.amount || 0),
            'Payment Mode': t.method || 'Cash',
            'Remark / Purpose': t.remark || '—',
          });
        });
      });
      const wsAllOut = allOutRows.length > 0
        ? XLSX.utils.json_to_sheet(allOutRows)
        : XLSX.utils.json_to_sheet([{ 'Notice': 'No outgoing payments recorded across any firm.' }]);
      wsAllOut['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 15 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsAllOut, 'All Spending (Outgoing)');

      // 3. All Incoming transactions
      const allInRows = [];
      firms.forEach(f => {
        (f.incoming || []).forEach(t => {
          allInRows.push({
            'Firm Name': f.name,
            'Firm ID': f.id,
            'Transaction ID': t.id,
            'Date': t.date,
            'Time': t.time || '—',
            'Project': t.project || 'General',
            'Received From / Client': t.paidTo || 'Client',
            'Incoming Amount (₹)': Number(t.amount || 0),
            'Payment Mode': t.method || 'Cash',
            'Remark / Purpose': t.remark || '—',
          });
        });
      });
      const wsAllIn = allInRows.length > 0
        ? XLSX.utils.json_to_sheet(allInRows)
        : XLSX.utils.json_to_sheet([{ 'Notice': 'No incoming payments recorded across any firm.' }]);
      wsAllIn['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 15 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsAllIn, 'All Received (Incoming)');

      const filename = `BuildPay_All_8_Firms_Consolidated_${today()}.xlsx`;
      XLSX.writeFile(wb, filename);
      setToast(`Downloaded ${filename} successfully!`);
      setExportModalOpen(false);
    } catch (err) {
      console.error('All firms Excel export error:', err);
      setToast('Export failed. Please try again.');
    }
  }

  /* ── Export Main Payments Register Report ── */
  function exportMainRegisterExcel() {
    try {
      const paymentRows = visiblePayments.map(p => ({
        'Payment ID': p.id,
        'Date': p.date,
        'Time': p.time,
        'Name': p.name,
        'Work Type': p.workType,
        'Associated Firm': p.firmName || 'None (General)',
        'Project': p.project || 'General',
        'Amount (₹)': p.amount,
        'Payment Mode': p.method,
        'Status': p.status,
        'Last Updated': formatFullTimestamp(p.updatedAt || `${p.date}T${p.time || '10:00'}:00`),
        'Remark': p.remark,
      }));
      const wsPayments = XLSX.utils.json_to_sheet(paymentRows);
      wsPayments['!cols'] = [
        { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 18 },
        { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
        { wch: 22 }, { wch: 30 }
      ];

      const summaryData = [
        { 'Metric': 'Total Paid', 'Amount (₹)': totalPaid },
        { 'Metric': 'Total Pending', 'Amount (₹)': totalPending },
        { 'Metric': 'Project Budget (PR)', 'Amount (₹)': projectBudget },
        { 'Metric': 'Remaining Balance (PR - Paid)', 'Amount (₹)': remaining },
        { 'Metric': 'Total Transactions', 'Amount (₹)': visiblePayments.length },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);

      const personRows = personTotals.map(p => ({
        'Name': p.name,
        'Total Paid (₹)': p.paid,
        'Total Pending (₹)': p.pending,
        'Grand Total (₹)': p.paid + p.pending,
        'Transactions': p.count,
      }));
      const wsPerson = XLSX.utils.json_to_sheet(personRows);

      const workTypeRows = workTypeTotals.map(([wt, amt]) => ({
        'Work Type': wt,
        'Total (₹)': amt,
      }));
      const wsWorkType = XLSX.utils.json_to_sheet(workTypeRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments');
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      XLSX.utils.book_append_sheet(wb, wsPerson, 'Person‑wise Summary');
      XLSX.utils.book_append_sheet(wb, wsWorkType, 'Work‑Type Summary');

      const filename = `BuildPay_Report_${today()}.xlsx`;
      XLSX.writeFile(wb, filename);

      setToast(`Downloaded ${filename}`);
      setExportModalOpen(false);
    } catch (err) {
      console.error('Download error:', err);
      setToast('Export failed. Please try again.');
    }
  }

  /* ── Open Export Modal with pre-selections ── */
  function openExportModal(scope = 'firm', firmId = null, project = 'all') {
    setExportScope(scope);
    if (firmId) {
      setSelectedFirmId(firmId);
    } else if (!firms.some(f => f.id === selectedFirmId)) {
      setSelectedFirmId(firms[0]?.id || 'FIRM-001');
    }
    setSelectedFirmProject(project || 'all');
    setExportModalOpen(true);
  }

  /* ── Excel Export Entry Point: Opens Export Modal with toggle options ── */
  function exportExcel() {
    if (viewFirmIdx !== null && firms[viewFirmIdx]) {
      const f = firms[viewFirmIdx];
      const p = firmProjectFilter[f.id] || 'all';
      openExportModal('firm', f.id, p);
    } else if (activePage === 'Firms') {
      openExportModal('firm');
    } else {
      openExportModal('firm');
    }
  }

  /* ── Settings: add / remove names & work types ── */
  function addName(customName) {
    const n = (customName || newName).trim();
    if (!n) return;
    if (names.includes(n)) { setToast('Name already exists.'); return; }
    setNames(prev => [...prev, n]);
    setNewName('');
    setToast(`"${n}" added to names list.`);
    return n;
  }
  function removeName(n) { setNames(prev => prev.filter(x => x !== n)); setToast(`"${n}" removed.`); }
  
  function addWorkType(customType) {
    const w = (customType || newWorkType).trim();
    if (!w) return;
    if (workTypes.includes(w)) { setToast('Work type already exists.'); return; }
    setWorkTypes(prev => [...prev, w]);
    setNewWorkType('');
    setToast(`"${w}" added to work types.`);
    return w;
  }
  function removeWorkType(w) { setWorkTypes(prev => prev.filter(x => x !== w)); setToast(`"${w}" removed.`); }
  
  function saveBudget(val) {
    const v = Number(val !== undefined ? val : budgetInput);
    if (!Number.isFinite(v) || v < 0) { setToast('Enter a valid budget amount.'); return; }
    setProjectBudget(v);
    setBudgetInput(String(v));
    setInlineBudgetVal(String(v));
    setEditingBudgetInline(false);
    setToast('Project budget updated successfully.');
  }

  /* ── Firms helpers ── */
  function handleAddProject(firmIdx, projName) {
    const p = (projName || '').trim();
    if (!p) return;
    const targetFirm = firms[firmIdx];
    if (!targetFirm) return;
    const existing = targetFirm.projects || [];
    if (existing.some(x => x.toLowerCase() === p.toLowerCase())) {
      setToast(`Project "${p}" already exists in ${targetFirm.name}.`);
      return;
    }
    setFirms(prev => prev.map((f, i) => i === firmIdx ? { ...f, projects: [...(f.projects || []), p] } : f));
    setNewProjectNameInput('');
    setAddingProjectFirmIdx(null);
    setToast(`Added project "${p}" to ${targetFirm.name}.`);
  }

  function openFirmTxModal(idx, type, existingTx = null) {
    setFirmModalIdx(idx);
    setFirmModalType(type);
    const targetFirm = firms[idx];
    const defaultProj = (targetFirm?.projects && targetFirm.projects.length > 0) ? targetFirm.projects[0] : 'General';
    if (existingTx) {
      setEditingTxId(existingTx.id);
      setFirmTxForm({
        amount: String(existingTx.amount || ''),
        date: existingTx.date || today(),
        time: existingTx.time || nowTime(),
        remark: existingTx.remark || '',
        method: existingTx.method || 'Cash',
        paidTo: existingTx.paidTo || '',
        project: existingTx.project || defaultProj
      });
    } else {
      setEditingTxId(null);
      setFirmTxForm({
        amount: '',
        date: today(),
        time: nowTime(),
        remark: '',
        method: 'Cash',
        paidTo: '',
        project: defaultProj
      });
    }
    setFirmModalOpen(true);
  }
  function saveFirmTx(e) {
    e.preventDefault();
    if (!firmTxForm.amount || Number(firmTxForm.amount) <= 0) return;
    const cleanAmount = Number(firmTxForm.amount);
    const cleanRemark = (firmTxForm.remark || '').trim();
    const cleanPaidTo = (firmTxForm.paidTo || '').trim();
    const cleanProject = (firmTxForm.project || 'General').trim();

    if (editingTxId) {
      setFirms(prev => prev.map((f, i) => {
        if (i !== firmModalIdx) return f;
        const updateList = (list) => list.map(t => t.id === editingTxId ? {
          ...t,
          amount: cleanAmount,
          date: firmTxForm.date,
          time: firmTxForm.time,
          method: firmTxForm.method,
          paidTo: cleanPaidTo,
          project: cleanProject,
          remark: cleanRemark,
          updatedAt: new Date().toISOString()
        } : t);

        return firmModalType === 'incoming'
          ? { ...f, incoming: updateList(f.incoming) }
          : { ...f, outgoing: updateList(f.outgoing) };
      }));
      setToast(`Updated ${firmModalType} payment for ${firms[firmModalIdx]?.name}`);
    } else {
      const tx = {
        id: `FTX-${Date.now()}`,
        amount: cleanAmount,
        date: firmTxForm.date,
        time: firmTxForm.time,
        remark: cleanRemark,
        method: firmTxForm.method,
        paidTo: cleanPaidTo,
        project: cleanProject,
        createdAt: new Date().toISOString(),
      };
      setFirms(prev => prev.map((f, i) => {
        if (i !== firmModalIdx) return f;
        return firmModalType === 'incoming'
          ? { ...f, incoming: [tx, ...f.incoming] }
          : { ...f, outgoing: [tx, ...f.outgoing] };
      }));
      setToast(`${firmModalType === 'incoming' ? 'Incoming' : 'Outgoing'} payment recorded for ${firms[firmModalIdx]?.name}`);
    }
    setFirmModalOpen(false);
    setEditingTxId(null);
  }
  function addNewFirm(e) {
    e && e.preventDefault();
    const n = newFirmName.trim();
    if (!n) return;
    if (firms.some(f => f.name.toLowerCase() === n.toLowerCase())) {
      setToast('Firm already exists.');
      return;
    }
    const newId = `FIRM-${String(firms.length + 1).padStart(3, '0')}`;
    setFirms(prev => [...prev, { id: newId, name: n, projects: [], incoming: [], outgoing: [] }]);
    setNewFirmName('');
    setAddFirmModalOpen(false);
    setToast(`Firm "${n}" added successfully.`);
  }
  function deleteFirmTx(firmIdx, type, txId) {
    setFirms(prev => prev.map((f, i) => {
      if (i !== firmIdx) return f;
      return type === 'incoming'
        ? { ...f, incoming: f.incoming.filter(t => t.id !== txId) }
        : { ...f, outgoing: f.outgoing.filter(t => t.id !== txId) };
    }));
    setToast('Transaction removed.');
  }
  function openEditFirm(idx) {
    setEditFirmIdx(idx);
    setEditFirmName(firms[idx].name);
    setEditFirmProjects([...(firms[idx].projects || [])]);
    setNewProjectInEdit('');
  }
  function handleAddProjectInEdit() {
    const p = newProjectInEdit.trim();
    if (!p) return;
    if (editFirmProjects.some(x => x.toLowerCase() === p.toLowerCase())) {
      setToast(`Project "${p}" is already added.`);
      return;
    }
    setEditFirmProjects(prev => [...prev, p]);
    setNewProjectInEdit('');
    setToast(`Project "${p}" added to list. Click "Save Changes" to apply.`);
  }
  function handleRemoveProjectInEdit(proj) {
    setEditFirmProjects(prev => prev.filter(x => x !== proj));
  }
  function saveEditFirm(e) {
    e && e.preventDefault();
    const n = editFirmName.trim();
    if (!n) return;
    if (firms.some((f, i) => i !== editFirmIdx && f.name.toLowerCase() === n.toLowerCase())) {
      setToast('Another firm with that name already exists.');
      return;
    }
    setFirms(prev => prev.map((f, i) => i === editFirmIdx ? { ...f, name: n, projects: editFirmProjects } : f));
    setToast(`Updated ${n} details and saved ${editFirmProjects.length} project(s).`);
    setEditFirmIdx(null);
  }
  function confirmDeleteFirm() {
    const name = deleteFirmTarget?.name || 'Firm';
    setFirms(prev => prev.filter((_, i) => i !== firms.indexOf(deleteFirmTarget)));
    setDeleteFirmTarget(null);
    if (expandedFirmIdx !== null) setExpandedFirmIdx(null);
    setToast(`"${name}" deleted.`);
  }

  /* ── Navigation ── */
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Add Payment', icon: Plus },
    { label: 'Payment Register', icon: ClipboardList },
    { label: 'Firms', icon: Building },
    { label: 'People', icon: Users },
    { label: 'Reports', icon: FileText },
    { label: 'Settings', icon: Settings }
  ];
  function selectNav(label) {
    if (label === 'Add Payment') { openAdd(); }
    else if (label === 'Settings') { setSettingsOpen(true); setMobileNavOpen(false); }
    else { setActivePage(label); setMobileNavOpen(false); }
  }

  /* ══════════════════════════════════════════════ */
  /*                   RENDER                       */
  /* ══════════════════════════════════════════════ */
  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark" title="Bhandurge Developers · Construction Management">
            <Building2 size={22} strokeWidth={2.4} className="brand-building-icon" />
            <span className="brand-emoji-badge">🏗️</span>
          </div>
          <div>
            <div className="brand-name">
              <span>BuildPay</span>
              <span className="builder-pill">🏢 BUILDER</span>
            </div>
            <div className="brand-tagline">Bhandurge Developers · Finance</div>
          </div>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18}/></button>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activePage === label ? 'active' : ''}`} onClick={() => selectNav(label)}>
              <Icon size={18}/><span>{label}</span>
              {label === 'Add Payment' && <span className="nav-plus"><Plus size={14}/></span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help-icon"><HardHat size={25}/></div>
          <div><strong>Build better.</strong><span>Manage smarter.</span></div>
        </div>
        <div className="sidebar-footnote">BuildPay v2.0 · Local workspace</div>
      </aside>

      {/* ── Main ── */}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-toggle" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={21}/></button>
          <div className="global-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, work type, remark or payment ID..." aria-label="Search payments"/>{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15}/></button>}</div>
          <div className="topbar-right">
            {/* Theme Toggle Button */}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? (
                <>
                  <Moon size={16} className="theme-icon moon" />
                  <span className="theme-toggle-label">Dark</span>
                </>
              ) : (
                <>
                  <Sun size={16} className="theme-icon sun" />
                  <span className="theme-toggle-label">Light</span>
                </>
              )}
            </button>
            <button className="settings-quick-btn" title="Open Settings" onClick={() => setSettingsOpen(true)}><Settings size={16}/><span>Settings</span></button>
            <span className="local-badge" title={cloudStatus === 'synced' ? "Data safely synchronized with Firebase Cloud Firestore" : "Connecting to Cloud..."}>
              <span className={`status-dot ${cloudStatus === 'synced' ? 'online' : ''}`}></span>
              {cloudStatus === 'synced' ? 'Cloud Synced ☁️' : 'Syncing...'}
            </span>
            <div className="topbar-divider"></div>
            {currentUser ? (
              <div className="user-profile-widget">
                <div className="avatar" title={currentUser.fullName || currentUser.username}>
                  {initials(currentUser.fullName || currentUser.username)}
                </div>
                <div className="profile-copy">
                  <strong>{currentUser.fullName || currentUser.username}</strong>
                  <span>{currentUser.role || 'Admin'} · {currentUser.phone || currentUser.username}</span>
                </div>
                <button
                  className="icon-button logout-btn"
                  title="Log out of Admin Portal"
                  aria-label="Log out"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary login-top-btn"
                onClick={() => setShowAuthModal(true)}
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        <div className="content">
          {/* ── Page heading & filters ── */}
          <div className="page-heading">
            <div>
              <div className="eyebrow">CONSTRUCTION FINANCE</div>
              {/* Animated Welcome Admin Banner */}
              <div className="welcome-admin-banner">
                <div className="welcome-badge">
                  <span className="building-emoji-lead">🏗️</span>
                  <Building2 size={14} className="building-lucide-icon" />
                  <span>BHANDURGE DEVELOPERS & BUILDERS</span>
                  <Sparkles size={13} className="sparkle-icon" />
                </div>
                <h1 className="welcome-admin-title">
                  Welcome, <span className="brand-gradient-text shimmer-text">Bhandurge Developers</span> <span className="title-building-emoji" title="Builder & Construction">🏢</span>
                </h1>
                <p className="welcome-admin-sub">
                  <span className="sub-builder-tag">👷 Site Admin</span> {currentUser ? `${currentUser.fullName || currentUser.username}` : 'Administrator'} · Construction Site Finance, Payment Tracking & Contractor Accounts
                </p>
              </div>
              <p className="page-desc-text">{activePage === 'Dashboard' ? 'Overview of your construction payments, status & balance (user-editable).' : activePage === 'Payment Register' ? 'Search, review, edit, delete, and toggle status directly with checkboxes.' : activePage === 'People' ? 'Person-wise payment summary (Santosh, Kedar, Yallappa, etc).' : activePage === 'Reports' ? 'Review summaries and export all data directly to Excel.' : activePage === 'Firms' ? 'Manage firms – track incoming client payments & outgoing labour/partner expenses.' : 'Overview'}</p>
              {payments.length > 0 && (() => {
                const sortedByUpdate = [...payments].sort((a, b) => {
                  const ta = new Date(a.updatedAt || `${a.date}T${a.time || '10:00'}:00`).getTime();
                  const tb = new Date(b.updatedAt || `${b.date}T${b.time || '10:00'}:00`).getTime();
                  return tb - ta;
                });
                const newest = sortedByUpdate[0];
                if (!newest) return null;
                const updatedIso = newest.updatedAt || `${newest.date}T${newest.time || '10:00'}:00`;
                return (
                  <div className="last-sync-banner" title={`Last updated: ${formatFullTimestamp(updatedIso)}`}>
                    <Clock3 size={13} className="sync-clock" />
                    <span>Latest update: <strong>{newest.id} ({newest.name} · {money(newest.amount)})</strong> was updated <strong>{formatRelativeTime(updatedIso)}</strong></span>
                  </div>
                );
              })()}
            </div>
            <div className="heading-actions">
              <label className="date-select"><CalendarDays size={16}/><select value={dateFilter} onChange={e => setDateFilter(e.target.value)} aria-label="Date range"><option>This month</option><option>Today</option><option>This year</option><option>All time</option></select><ChevronDown size={15}/></label>
              <label className="worktype-select"><Filter size={15}/><select value={workTypeFilter} onChange={e => setWorkTypeFilter(e.target.value)} aria-label="Work type filter"><option>All types</option>{workTypes.map(w => <option key={w}>{w}</option>)}</select><ChevronDown size={15}/></label>
              <label className="status-select"><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Status filter"><option value="All">All Status</option><option>Paid</option><option>Pending</option></select><ChevronDown size={15}/></label>
              <button className="btn btn-primary" onClick={exportExcel} title="Export single multi-sheet Excel spreadsheet"><Download size={16}/> Export Excel</button>
            </div>
          </div>

          {/* ── User-Editable Stats Grid ── */}
          <section className="stats-grid">
            <StatCard
              title="Total Paid"
              value={money(totalPaid)}
              hint={`${dateFilter.toLowerCase()} · Click to filter Paid`}
              icon={Wallet}
              color="green"
              clickable
              isActive={statusFilter === 'Paid'}
              onClick={() => {
                setStatusFilter(statusFilter === 'Paid' ? 'All' : 'Paid');
                setToast(statusFilter === 'Paid' ? 'Showing all status' : 'Filtered: Paid only');
              }}
            />
            <StatCard
              title="Today's Paid"
              value={money(todayPaid)}
              hint={`${todayCount} record${todayCount === 1 ? '' : 's'} · Click to view today`}
              icon={CircleDollarSign}
              color="blue"
              clickable
              isActive={dateFilter === 'Today'}
              onClick={() => {
                setDateFilter(dateFilter === 'Today' ? 'This month' : 'Today');
                setToast(dateFilter === 'Today' ? 'Reset date filter to This month' : 'Filtered: Today only');
              }}
            />
            <StatCard
              title="Pending"
              value={money(totalPending)}
              hint="Unpaid · Click to filter Pending"
              icon={Clock3}
              color="orange"
              clickable
              isActive={statusFilter === 'Pending'}
              onClick={() => {
                setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending');
                setToast(statusFilter === 'Pending' ? 'Showing all status' : 'Filtered: Pending only');
              }}
            />
            <div className="stat-card budget-card">
              <div className={`stat-icon ${remaining >= 0 ? 'purple' : 'red'}`}><TrendingUp size={21}/></div>
              <div className="stat-content" style={{ width: '100%' }}>
                <div className="stat-head-row">
                  <span className="stat-title">Balance (PR - Paid)</span>
                  <button className="budget-edit-btn" title="Edit PR Project Budget" onClick={() => { setEditingBudgetInline(!editingBudgetInline); setInlineBudgetVal(String(projectBudget)); }}>
                    <Pencil size={12}/> Edit PR
                  </button>
                </div>
                <strong className={`stat-value ${remaining < 0 ? 'text-red' : ''}`}>{money(remaining)}</strong>
                
                {editingBudgetInline ? (
                  <div className="inline-budget-editor">
                    <span className="inline-budget-label">PR Budget: ₹</span>
                    <input
                      type="number"
                      value={inlineBudgetVal}
                      onChange={e => setInlineBudgetVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveBudget(inlineBudgetVal); }}
                      autoFocus
                    />
                    <button className="btn-save-mini" onClick={() => saveBudget(inlineBudgetVal)} title="Save PR Budget"><Check size={13}/></button>
                    <button className="btn-cancel-mini" onClick={() => setEditingBudgetInline(false)} title="Cancel"><X size={13}/></button>
                  </div>
                ) : (
                  <span className="stat-hint" onClick={() => setEditingBudgetInline(true)} style={{ cursor: 'pointer' }} title="Click to edit PR Budget">
                    PR Budget: <strong>{money(projectBudget)}</strong> · <u>change</u>
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* ── Page content ── */}
          {activePage === 'Firms' ? (
            <section className="panel register-panel">
              <div className="register-heading">
                <div>
                  <h2>Firms &amp; Projects</h2>
                  <p>Manage your 8 builder firms – select projects to view spending history &amp; track incoming/outgoing funds.</p>
                </div>
                <div className="register-actions">
                  <button className="btn btn-outline" onClick={() => openExportModal('firm')} title="Export firm reports to Excel"><Download size={16}/> Export Firms Excel</button>
                  <button className="btn btn-primary" onClick={() => { setNewFirmName(''); setAddFirmModalOpen(true); }}><Plus size={16}/> Add Firm</button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Firm Name &amp; Projects</th>
                      <th>Total Incoming (₹)</th>
                      <th>Total Outgoing (₹)</th>
                      <th>Net Balance (₹)</th>
                      <th>Records</th>
                      <th className="actions-heading">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {firms.map((firm, idx) => {
                      const totalIn = firm.incoming.reduce((s, t) => s + Number(t.amount || 0), 0);
                      const totalOut = firm.outgoing.reduce((s, t) => s + Number(t.amount || 0), 0);
                      const net = totalIn - totalOut;
                      const isExpanded = expandedFirmIdx === idx;
                      const activeProj = firmProjectFilter[firm.id] || 'all';

                      // Project-filtered transactions for this firm
                      const filteredIncoming = activeProj === 'all'
                        ? firm.incoming
                        : firm.incoming.filter(t => (t.project || 'General').toLowerCase() === activeProj.toLowerCase());

                      const filteredOutgoing = activeProj === 'all'
                        ? firm.outgoing
                        : firm.outgoing.filter(t => (t.project || 'General').toLowerCase() === activeProj.toLowerCase());

                      const projInTotal = filteredIncoming.reduce((s, t) => s + Number(t.amount || 0), 0);
                      const projOutTotal = filteredOutgoing.reduce((s, t) => s + Number(t.amount || 0), 0);
                      const projNet = projInTotal - projOutTotal;

                      return (
                        <React.Fragment key={firm.id}>
                          <tr
                            style={{ cursor: 'pointer', background: isExpanded ? 'rgba(37, 99, 235, 0.04)' : undefined }}
                            onClick={() => setExpandedFirmIdx(isExpanded ? null : idx)}
                            title="Click to view projects and spending history"
                          >
                            <td>
                              <div className="table-person">
                                <div className="person-avatar small" style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>{initials(firm.name)}</div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <strong>{firm.name}</strong>
                                    <span style={{ fontSize: '0.68rem', color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '12px', fontWeight: 600 }}>
                                      {(firm.projects || []).length > 0 ? `${firm.projects.length} project${firm.projects.length === 1 ? '' : 's'}` : '0 projects'}
                                    </span>
                                  </div>
                                  <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{firm.id} · Click row to view spending history</small>
                                </div>
                              </div>
                            </td>
                            <td><strong className="amount-cell paid-text">{money(totalIn)}</strong></td>
                            <td><strong className="amount-cell pending-text">{money(totalOut)}</strong></td>
                            <td><strong className={`amount-cell ${net < 0 ? 'text-red' : ''}`}>{money(net)}</strong></td>
                            <td><span className="badge-count">{firm.incoming.length + firm.outgoing.length} record{firm.incoming.length + firm.outgoing.length === 1 ? '' : 's'}</span></td>
                            <td>
                              <div className="row-actions" onClick={e => e.stopPropagation()}>
                                <button className="btn btn-primary" style={{ fontSize: '0.72rem', padding: '4px 10px' }} title="Record payment received from client" onClick={() => openFirmTxModal(idx, 'incoming')}>
                                  <ArrowDownToLine size={13}/> Incoming
                                </button>
                                <button className="btn btn-outline" style={{ fontSize: '0.72rem', padding: '4px 10px' }} title="Record payment made to labour/partners" onClick={() => openFirmTxModal(idx, 'outgoing')}>
                                  <ArrowUpRight size={13}/> Outgoing
                                </button>
                                <button className="mini-icon action-view" title={`Download Excel report for ${firm.name}`} onClick={() => exportFirmExcel(firm, 'all')}><Download size={14}/></button>
                                <button className="mini-icon action-view" title="View firm details & spending history" onClick={() => setViewFirmIdx(idx)}><Eye size={15}/></button>
                                <button className="mini-icon action-edit" title="Edit firm & manage projects" onClick={() => openEditFirm(idx)}><Pencil size={15}/></button>
                                <button className="mini-icon action-delete danger" title="Delete firm" onClick={() => setDeleteFirmTarget(firm)}><Trash2 size={15}/></button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="6" style={{ padding: 0, background: 'var(--bg-card)' }}>
                                <div style={{ padding: '20px 24px', borderTop: '1px dashed var(--border-color)', borderBottom: '2px solid #2563eb' }}>
                                  
                                  {/* ── Firm Projects Bar ── */}
                                  <div className="firm-projects-bar">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Briefcase size={13} /> Projects:
                                      </span>
                                      {(firm.projects && firm.projects.length > 0) ? (
                                        <div className="firm-projects-tags">
                                          <button
                                            type="button"
                                            className={`project-chip ${activeProj === 'all' ? 'active' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); setFirmProjectFilter(prev => ({ ...prev, [firm.id]: 'all' })); }}
                                          >
                                            <span>All Projects</span>
                                            <span className="chip-count">{firm.incoming.length + firm.outgoing.length}</span>
                                          </button>
                                          {firm.projects.map(p => {
                                            const projTxCount = [...firm.incoming, ...firm.outgoing].filter(t => (t.project || 'General').toLowerCase() === p.toLowerCase()).length;
                                            return (
                                              <button
                                                key={p}
                                                type="button"
                                                className={`project-chip ${activeProj.toLowerCase() === p.toLowerCase() ? 'active' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); setFirmProjectFilter(prev => ({ ...prev, [firm.id]: p })); }}
                                              >
                                                <span>{p}</span>
                                                <span className="chip-count">{projTxCount}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          No projects added yet for this firm. Click "Edit Firm" or "+ Add Project" to configure.
                                        </span>
                                      )}
                                    </div>

                                    {/* Add Project or Edit Projects */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                      {addingProjectFirmIdx === idx ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <input
                                            type="text"
                                            value={newProjectNameInput}
                                            onChange={e => setNewProjectNameInput(e.target.value)}
                                            placeholder="Enter project name..."
                                            autoFocus
                                            style={{ height: '28px', fontSize: '11px', padding: '0 8px', borderRadius: '4px', border: '1px solid #2563eb' }}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddProject(idx, newProjectNameInput);
                                              }
                                              if (e.key === 'Escape') setAddingProjectFirmIdx(null);
                                            }}
                                          />
                                          <button
                                            type="button"
                                            className="btn btn-primary"
                                            style={{ height: '28px', padding: '0 8px', fontSize: '11px' }}
                                            onClick={() => handleAddProject(idx, newProjectNameInput)}
                                          >
                                            Add
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-outline"
                                            style={{ height: '28px', padding: '0 6px', fontSize: '11px' }}
                                            onClick={() => setAddingProjectFirmIdx(null)}
                                          >
                                            <X size={12}/>
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          <button
                                            type="button"
                                            className="btn btn-outline"
                                            style={{ fontSize: '11px', padding: '3px 8px', height: '28px' }}
                                            onClick={() => { setAddingProjectFirmIdx(idx); setNewProjectNameInput(''); }}
                                          >
                                            <Plus size={12}/> Add Project
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-outline"
                                            style={{ fontSize: '11px', padding: '3px 8px', height: '28px' }}
                                            onClick={() => openEditFirm(idx)}
                                          >
                                            <Pencil size={11}/> Edit Firm &amp; Projects
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* ── Spending History Summary Card ── */}
                                  <div className="firm-spending-summary-card">
                                    <div className="firm-metric-box">
                                      <span className="firm-metric-lbl">Money Spent (Outgoing)</span>
                                      <strong className="firm-metric-val pending-text">{money(projOutTotal)}</strong>
                                    </div>
                                    <div className="firm-metric-box">
                                      <span className="firm-metric-lbl">Money Received (Incoming)</span>
                                      <strong className="firm-metric-val paid-text">{money(projInTotal)}</strong>
                                    </div>
                                    <div className="firm-metric-box">
                                      <span className="firm-metric-lbl">Net Balance</span>
                                      <strong className={`firm-metric-val ${projNet < 0 ? 'text-red' : ''}`}>{money(projNet)}</strong>
                                    </div>
                                    <div className="firm-metric-box">
                                      <span className="firm-metric-lbl">Active Project View</span>
                                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {activeProj === 'all' ? 'All Projects Combined' : activeProj}
                                      </span>
                                    </div>
                                  </div>

                                  {/* ── Outgoing Payments History (Money Spent) ── */}
                                  <div style={{ marginBottom: '18px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                      <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                                        <ArrowUpRight size={16}/> History of Money Spent / Outgoing Expenses ({filteredOutgoing.length})
                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px' }}>
                                          Total Outgoing Spent: {money(projOutTotal)}
                                        </span>
                                        {activeProj !== 'all' && <span className="project-badge-tag">{activeProj}</span>}
                                      </h4>
                                      <button className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626', fontSize: '0.72rem', padding: '4px 10px' }} onClick={(e) => { e.stopPropagation(); openFirmTxModal(idx, 'outgoing'); }}>
                                        <Plus size={12}/> Record Money Spent (Outgoing)
                                      </button>
                                    </div>
                                    {filteredOutgoing.length > 0 ? (
                                      <div className="table-wrap" style={{ maxHeight: '220px', overflow: 'auto' }}>
                                        <table>
                                          <thead><tr><th>Date &amp; Time</th><th>Project</th><th>Outgoing Amount (Spent)</th><th>Payment Mode</th><th>Paid To (Labour/Contractor)</th><th>Remark / Purpose</th><th>Action</th></tr></thead>
                                          <tbody>
                                            {filteredOutgoing.map(t => (
                                              <tr key={t.id}>
                                                <td><span className="date-cell">{formatDate(t.date)}</span> <small className="time-cell">{t.time}</small></td>
                                                <td><span className="project-badge-tag">{t.project || 'General'}</span></td>
                                                <td><strong className="amount-cell pending-text">- {money(t.amount)}</strong></td>
                                                <td><MethodBadge method={t.method}/></td>
                                                <td>{t.paidTo || '—'}</td>
                                                <td>{t.remark || '—'}</td>
                                                <td>
                                                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                                                    <button className="mini-icon action-edit" title="Edit payment details" onClick={() => openFirmTxModal(idx, 'outgoing', t)}><Pencil size={14}/></button>
                                                    <button className="mini-icon action-delete danger" title="Remove" onClick={() => deleteFirmTx(idx, 'outgoing', t.id)}><Trash2 size={14}/></button>
                                                  </div>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0, padding: '8px 0' }}>
                                        No money spent recorded {activeProj !== 'all' ? `for project "${activeProj}"` : 'yet for this firm'}.
                                      </p>
                                    )}
                                  </div>

                                  {/* ── Incoming Payments History (Money Received) ── */}
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                      <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a' }}>
                                        <ArrowDownToLine size={16}/> History of Money Received / Incoming Funds ({filteredIncoming.length})
                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px' }}>
                                          Total Incoming Received: {money(projInTotal)}
                                        </span>
                                        {activeProj !== 'all' && <span className="project-badge-tag">{activeProj}</span>}
                                      </h4>
                                      <button className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a', fontSize: '0.72rem', padding: '4px 10px' }} onClick={(e) => { e.stopPropagation(); openFirmTxModal(idx, 'incoming'); }}>
                                        <Plus size={12}/> Record Money Received (Incoming)
                                      </button>
                                    </div>
                                    {filteredIncoming.length > 0 ? (
                                      <div className="table-wrap" style={{ maxHeight: '220px', overflow: 'auto' }}>
                                        <table>
                                          <thead><tr><th>Date &amp; Time</th><th>Project</th><th>Incoming Amount (Received)</th><th>Payment Mode</th><th>Remark / Purpose</th><th>Action</th></tr></thead>
                                          <tbody>
                                            {filteredIncoming.map(t => (
                                              <tr key={t.id}>
                                                <td><span className="date-cell">{formatDate(t.date)}</span> <small className="time-cell">{t.time}</small></td>
                                                <td><span className="project-badge-tag">{t.project || 'General'}</span></td>
                                                <td><strong className="amount-cell paid-text">+ {money(t.amount)}</strong></td>
                                                <td><MethodBadge method={t.method}/></td>
                                                <td>{t.remark || '—'}</td>
                                                <td>
                                                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                                                    <button className="mini-icon action-edit" title="Edit payment details" onClick={() => openFirmTxModal(idx, 'incoming', t)}><Pencil size={14}/></button>
                                                    <button className="mini-icon action-delete danger" title="Remove" onClick={() => deleteFirmTx(idx, 'incoming', t.id)}><Trash2 size={14}/></button>
                                                  </div>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0, padding: '8px 0' }}>
                                        No incoming payments recorded {activeProj !== 'all' ? `for project "${activeProj}"` : 'yet for this firm'}.
                                      </p>
                                    )}
                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {!firms.length && <tr><td colSpan="6"><EmptyState text="No firms added yet." actionLabel="Add a firm" onAction={() => setAddFirmModalOpen(true)}/></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="table-footer"><span>Showing <strong>{firms.length}</strong> firm{firms.length === 1 ? '' : 's'}</span><span className="footer-note"><span className="status-dot"></span> Saved locally in this browser</span></div>
            </section>
          ) : activePage === 'People' ? (
            <PeoplePage
              personTotals={personTotals}
              query={query}
              onSearch={setQuery}
              onAddPerson={addName}
              onDeletePerson={(personName) => {
                removeName(personName);
                // Also remove payments for this person to fully clear them
                setPayments(prev => prev.filter(p => p.name.trim().toLowerCase() !== personName.trim().toLowerCase()));
              }}
            />
          ) : activePage === 'Reports' ? (
            <section className="reports-grid">
              <div className="panel report-panel">
                <div className="panel-heading"><div><h2>Payment summary</h2><p>Based on the selected date range</p></div><FileText size={20}/></div>
                <div className="report-total">{money(totalPaid)}</div>
                <div className="report-label">Total paid till date</div>
                <div className="report-stat-row"><span>Pending</span><strong>{money(totalPending)}</strong></div>
                <div className="report-stat-row"><span>Transactions</span><strong>{filteredByDate.length}</strong></div>
                <div className="report-stat-row"><span>Project Budget (PR)</span><strong>{money(projectBudget)}</strong></div>
                <div className="report-stat-row"><span>Remaining Balance</span><strong className={remaining < 0 ? 'text-red' : ''}>{money(remaining)}</strong></div>
                <button className="btn btn-primary full-width" onClick={exportExcel}><Download size={16}/> Export Excel Spreadsheet</button>
              </div>

              {/* Pie Chart Panel in Reports */}
              <div className="panel report-panel chart-report-panel">
                <div className="panel-heading">
                  <div><h2>Payment Distribution (Pie)</h2><p>{pieMode === 'mode' ? 'Cash vs UPI vs Cheque vs RTGS breakdown' : 'Paid vs Pending proportion'}</p></div>
                  <div className="chart-mode-toggle">
                    <button className={pieMode === 'mode' ? 'active' : ''} onClick={() => setPieMode('mode')}>Mode</button>
                    <button className={pieMode === 'status' ? 'active' : ''} onClick={() => setPieMode('status')}>Status</button>
                  </div>
                </div>
                <DonutPieChart
                  data={pieMode === 'mode' ? pieModeData : pieStatusData}
                  centerLabel={pieMode === 'mode' ? 'Recorded' : 'Total'}
                  centerValue={money(totalPaid + totalPending)}
                />
              </div>

              {/* Bar Graph Panel in Reports */}
              <div className="panel report-panel chart-report-panel">
                <div className="panel-heading">
                  <div><h2>Spending Bar Graph</h2><p>{barMode === 'workType' ? 'Spending by Work Category' : 'Top Contractors Spending'}</p></div>
                  <div className="chart-mode-toggle">
                    <button className={barMode === 'workType' ? 'active' : ''} onClick={() => setBarMode('workType')}>Work Type</button>
                    <button className={barMode === 'person' ? 'active' : ''} onClick={() => setBarMode('person')}>People</button>
                  </div>
                </div>
                <VerticalBarGraph data={barMode === 'workType' ? barWorkTypeData : barPersonData} />
              </div>

              <div className="panel report-panel">
                <div className="panel-heading"><div><h2>Person-wise summary</h2><p>Total paid to each person till now</p></div><Users size={20}/></div>
                <div className="person-report-list">{personTotals.map(p => <div className="report-stat-row" key={p.name}><span>{p.name}</span><div><strong className="paid-text" style={{ marginRight: '8px' }}>Paid: {money(p.paid)}</strong><small style={{ color: '#c47a1a' }}>(Pending: {money(p.pending)})</small></div></div>)}</div>
              </div>
            </section>
          ) : (
            <>
              {activePage === 'Dashboard' && <section className="insights-grid">
                {/* ── Vertical Bar Graph Panel ── */}
                <div className="panel bar-graph-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Spending Bar Graph</h2>
                      <p>{barMode === 'workType' ? 'Spending by Category' : 'Spending by Contractor'} · {dateFilter.toLowerCase()}</p>
                    </div>
                    <div className="panel-header-actions">
                      <div className="chart-mode-toggle">
                        <button className={barMode === 'workType' ? 'active' : ''} onClick={() => setBarMode('workType')}>Work Type</button>
                        <button className={barMode === 'person' ? 'active' : ''} onClick={() => setBarMode('person')}>People</button>
                      </div>
                      <span className="heading-icon"><BarChart3 size={17}/></span>
                    </div>
                  </div>
                  <VerticalBarGraph data={barMode === 'workType' ? barWorkTypeData : barPersonData} />
                </div>

                {/* ── Donut Pie Chart Panel ── */}
                <div className="panel pie-chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Distribution (Pie Chart)</h2>
                      <p>{pieMode === 'mode' ? 'Cash vs UPI vs Cheque vs RTGS' : 'Paid vs Pending Ratio'}</p>
                    </div>
                    <div className="panel-header-actions">
                      <div className="chart-mode-toggle">
                        <button className={pieMode === 'mode' ? 'active' : ''} onClick={() => setPieMode('mode')}>Mode</button>
                        <button className={pieMode === 'status' ? 'active' : ''} onClick={() => setPieMode('status')}>Status</button>
                      </div>
                      <span className="heading-icon"><PieIcon size={17}/></span>
                    </div>
                  </div>
                  <DonutPieChart
                    data={pieMode === 'mode' ? pieModeData : pieStatusData}
                    centerLabel={pieMode === 'mode' ? 'Recorded' : 'Total'}
                    centerValue={money(totalPaid + totalPending)}
                  />
                </div>

                {/* ── Recent Payments ── */}
                <div className="panel recent-panel">
                  <div className="panel-heading"><div><h2>Recent payments</h2><p>Check status or edit directly</p></div><button className="text-link" onClick={() => setActivePage('Payment Register')}>View all <ChevronRight size={15}/></button></div>
                  {visiblePayments.slice(0, 4).length ? (
                    <div className="recent-list">
                      {visiblePayments.slice(0, 4).map(p => (
                        <div className="recent-item" key={p.id}>
                          <div className="person-avatar">{initials(p.name)}</div>
                          <div className="recent-info">
                            <strong>{p.name}</strong>
                            <span>{p.workType} · {p.remark || '—'}</span>
                            <div className="recent-meta-row">
                              <small>{formatDateTime(p)}</small>
                              <span className="recent-updated-chip" title={`Last updated: ${formatFullTimestamp(p.updatedAt || `${p.date}T${p.time || '10:00'}:00`)}`}>
                                <Clock3 size={10} />
                                <span>Updated {formatRelativeTime(p.updatedAt || `${p.date}T${p.time || '10:00'}:00`)}</span>
                              </span>
                            </div>
                          </div>
                          <div className="recent-amount">
                            <strong>{money(p.amount)}</strong>
                            <label className="status-toggle-wrap mini" title={`Click checkbox to toggle: currently ${p.status}`}>
                              <input
                                type="checkbox"
                                className="status-check"
                                checked={p.status === 'Paid'}
                                onChange={() => togglePaymentStatus(p.id)}
                              />
                              <span className={`status-badge-mini interactive ${p.status.toLowerCase()}`}>
                                {p.status === 'Paid' ? <Check size={10} strokeWidth={2.8}/> : <Clock3 size={10}/>}
                                {p.status}
                              </span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState text="No matching payments found."/>}
                </div>
              </section>}

              {/* ── Payment Register Table ── */}
              <section className="panel register-panel">
                <div className="register-heading">
                  <div>
                    <h2>Payment Register</h2>
                    <p>Click checkboxes to toggle Paid/Pending. All records user-editable.</p>
                  </div>
                  <div className="register-actions">
                    <label className="filter-select"><Filter size={15}/><select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} aria-label="Filter by method"><option>All methods</option>{methods.map(m => <option key={m}>{m}</option>)}</select><ChevronDown size={14}/></label>
                    <button className="btn btn-outline" onClick={exportExcel}><ArrowDownToLine size={16}/> Export Excel</button>
                    <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Payment</button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Date & time</th>
                        <th>Name</th>
                        <th>Work Type</th>
                        <th>Firm / Project</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th style={{ minWidth: '120px' }}>Status (Checkbox)</th>
                        <th>Last Updated</th>
                        <th>Remark</th>
                        <th className="actions-heading">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePayments.map(p => {
                        const updatedIso = p.updatedAt || `${p.date}T${p.time || '10:00'}:00`;
                        const relTime = formatRelativeTime(updatedIso);
                        const fullTime = formatFullTimestamp(updatedIso);
                        return (
                          <tr key={p.id}>
                            <td><span className="payment-id">{p.id}</span></td>
                            <td><span className="date-cell">{formatDate(p.date)}</span><small className="time-cell">{p.time}</small></td>
                            <td><div className="table-person"><div className="person-avatar small">{initials(p.name)}</div><strong>{p.name}</strong></div></td>
                            <td><span className="worktype-badge">{p.workType}</span></td>
                            <td>
                              {p.firmName ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span className="firm-badge-tag" title={p.firmName}>
                                    <Building2 size={11} style={{ flexShrink: 0 }} />
                                    <span>{p.firmName}</span>
                                  </span>
                                  {p.project && p.project !== 'General Work' && (
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '2px' }}>
                                      ↳ {p.project}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                              )}
                            </td>
                            <td><strong className="amount-cell">{money(p.amount)}</strong></td>
                            <td><MethodBadge method={p.method}/></td>
                            <td>
                              <label className="status-toggle-wrap" title={`Click to mark as ${p.status === 'Paid' ? 'Pending' : 'Paid'}`}>
                                <input
                                  type="checkbox"
                                  className="status-check"
                                  checked={p.status === 'Paid'}
                                  onChange={() => togglePaymentStatus(p.id)}
                                />
                                <span className={`status-badge interactive ${p.status.toLowerCase()}`}>
                                  {p.status === 'Paid' ? <Check size={11} strokeWidth={3}/> : <Clock3 size={11}/>}
                                  {p.status}
                                </span>
                              </label>
                            </td>
                            <td>
                              <span className="updated-timestamp-pill" title={`Updated on: ${fullTime}`}>
                                <Clock3 size={11} />
                                <span>{relTime}</span>
                              </span>
                            </td>
                            <td><span className="purpose-cell">{p.remark || '—'}</span></td>
                            <td>
                              <div className="row-actions">
                                <button className="mini-icon action-view" title="View details" onClick={() => setViewPayment(p)}><Eye size={15}/></button>
                                <button className="mini-icon action-edit" title="Edit payment" onClick={() => openEdit(p)}><Pencil size={15}/></button>
                                <button className="mini-icon action-delete danger" title="Delete payment" onClick={() => setDeleteTarget(p)}><Trash2 size={15}/></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!visiblePayments.length && <tr><td colSpan="11"><EmptyState text="No payments match your search or filters." actionLabel="Add a payment" onAction={openAdd}/></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer"><span>Showing <strong>{visiblePayments.length}</strong> of <strong>{payments.length}</strong> payment records</span><span className="footer-note"><span className="status-dot"></span> Saved locally in this browser</span></div>
              </section>
              <div className="content-foot">© {new Date().getFullYear()} BuildPay · Construction Payment & Register Management.</div>
            </>
          )}
        </div>
      </main>

      {/* ── Overlays ── */}
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)}></button>}
      {modalOpen && (
        <PaymentModal
          form={form}
          updateForm={updateForm}
          onSubmit={savePayment}
          onClose={() => setModalOpen(false)}
          editing={Boolean(editingId)}
          error={formError}
          names={names}
          workTypes={workTypes}
          firms={firms}
          onAddNewName={(n) => {
            const added = addName(n);
            if (added) updateForm('name', added);
          }}
          onAddNewWorkType={(w) => {
            const added = addWorkType(w);
            if (added) updateForm('workType', added);
          }}
        />
      )}
      {viewPayment && <ViewModal payment={viewPayment} onClose={() => setViewPayment(null)} onEdit={() => { setViewPayment(null); openEdit(viewPayment); }}/>}
      {deleteTarget && <ConfirmModal payment={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete}/>}
      {settingsOpen && <SettingsModal names={names} workTypes={workTypes} newName={newName} setNewName={setNewName} addName={addName} removeName={removeName} newWorkType={newWorkType} setNewWorkType={setNewWorkType} addWorkType={addWorkType} removeWorkType={removeWorkType} budgetInput={budgetInput} setBudgetInput={setBudgetInput} saveBudget={saveBudget} onClose={() => setSettingsOpen(false)} />}
      {showAuthModal && <AuthModal onLoginSuccess={handleLoginSuccess} />}
      
      {/* ── Firm Transaction Modal ── */}
      {firmModalOpen && firmModalIdx !== null && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setFirmModalOpen(false); setEditingTxId(null); } }}>
          <section className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <div className="modal-kicker">
                  {editingTxId ? 'EDIT RECORD' : (firmModalType === 'incoming' ? 'INCOMING PAYMENT' : 'OUTGOING PAYMENT')}
                </div>
                <h2>
                  {editingTxId
                    ? (firmModalType === 'incoming' ? 'Edit incoming payment' : 'Edit outgoing payment')
                    : (firmModalType === 'incoming' ? 'Record payment received' : 'Record payment made')}
                </h2>
                <p>Firm: <strong>{firms[firmModalIdx]?.name}</strong></p>
              </div>
              <button className="icon-button" onClick={() => { setFirmModalOpen(false); setEditingTxId(null); }} aria-label="Close"><X size={19}/></button>
            </div>
            <form onSubmit={saveFirmTx}>
              <div className="form-grid">
                <label className="field">
                  <span>Amount (₹) <b>*</b></span>
                  <div className="amount-input"><span>₹</span><input type="number" min="0.01" step="0.01" value={firmTxForm.amount} onChange={e => setFirmTxForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="0.00" required/></div>
                </label>
                <label className="field">
                  <span>Associated Project</span>
                  {(firms[firmModalIdx]?.projects && firms[firmModalIdx].projects.length > 0) ? (
                    <select
                      value={firmTxForm.project || (firms[firmModalIdx]?.projects?.[0] || 'General')}
                      onChange={e => setFirmTxForm(prev => ({ ...prev, project: e.target.value }))}
                    >
                      {firms[firmModalIdx].projects.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      <option value="General">General / All-Firm</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={firmTxForm.project}
                      onChange={e => setFirmTxForm(prev => ({ ...prev, project: e.target.value }))}
                      placeholder="e.g. General (or add projects via Edit Firm)"
                    />
                  )}
                </label>
                <label className="field">
                  <span>Payment Mode <b>*</b></span>
                  <select value={firmTxForm.method} onChange={e => setFirmTxForm(prev => ({ ...prev, method: e.target.value }))}>
                    {methods.map(m => <option key={m}>{m}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Date <b>*</b></span>
                  <input type="date" value={firmTxForm.date} onChange={e => setFirmTxForm(prev => ({ ...prev, date: e.target.value }))} required/>
                </label>
                <label className="field">
                  <span>Time</span>
                  <input type="time" value={firmTxForm.time} onChange={e => setFirmTxForm(prev => ({ ...prev, time: e.target.value }))}/>
                </label>
                {firmModalType === 'outgoing' && (
                  <label className="field full">
                    <span>Paid To (Labour / Contractor / Partner etc.)</span>
                    <input value={firmTxForm.paidTo} onChange={e => setFirmTxForm(prev => ({ ...prev, paidTo: e.target.value }))} placeholder="e.g. Labour wages, Material supplier, Security, Partner share..."/>
                  </label>
                )}
                <label className="field full">
                  <span>Remark</span>
                  <textarea value={firmTxForm.remark} onChange={e => setFirmTxForm(prev => ({ ...prev, remark: e.target.value }))} placeholder={firmModalType === 'incoming' ? 'e.g. Client installment for project...' : 'e.g. Weekly labour wages, material purchase...'} rows="2" maxLength="500"/>
                </label>
              </div>
              <div className="modal-footer">
                <span className="required-note"><b>*</b> Required fields</span>
                <div>
                  <button type="button" className="btn btn-outline" onClick={() => { setFirmModalOpen(false); setEditingTxId(null); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><Check size={16}/> {editingTxId ? 'Save Changes' : (firmModalType === 'incoming' ? 'Save Incoming' : 'Save Outgoing')}</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── Add Firm Modal ── */}
      {addFirmModalOpen && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAddFirmModalOpen(false); }}>
          <section className="modal-card confirm-modal" role="dialog" aria-modal="true" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div>
                <div className="modal-kicker">NEW FIRM</div>
                <h2>Add a new firm</h2>
                <p>Enter the firm name below.</p>
              </div>
              <button className="icon-button" onClick={() => setAddFirmModalOpen(false)} aria-label="Close"><X size={19}/></button>
            </div>
            <form onSubmit={addNewFirm} style={{ padding: '16px 24px' }}>
              <label className="field" style={{ marginBottom: '16px' }}>
                <span>Firm Name <b>*</b></span>
                <input value={newFirmName} onChange={e => setNewFirmName(e.target.value)} placeholder="e.g. ABC Constructions Pvt Ltd" required autoFocus/>
              </label>
              <div className="modal-footer" style={{ padding: '12px 0 0' }}>
                <span></span>
                <div>
                  <button type="button" className="btn btn-outline" onClick={() => setAddFirmModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><Plus size={16}/> Add Firm</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── View Firm Modal ── */}
      {viewFirmIdx !== null && firms[viewFirmIdx] && (() => {
        const firm = firms[viewFirmIdx];
        const activeModalProj = firmProjectFilter[firm.id] || 'all';

        const modalIncoming = activeModalProj === 'all'
          ? firm.incoming
          : firm.incoming.filter(t => (t.project || 'General Work').toLowerCase() === activeModalProj.toLowerCase());

        const modalOutgoing = activeModalProj === 'all'
          ? firm.outgoing
          : firm.outgoing.filter(t => (t.project || 'General Work').toLowerCase() === activeModalProj.toLowerCase());

        const totalIn = modalIncoming.reduce((s, t) => s + Number(t.amount || 0), 0);
        const totalOut = modalOutgoing.reduce((s, t) => s + Number(t.amount || 0), 0);
        const net = totalIn - totalOut;

        const items = [
          ['Firm ID', firm.id],
          ['Firm Name', firm.name],
          ['Active Filter', activeModalProj === 'all' ? 'All Projects' : activeModalProj],
          ['Money Received', money(totalIn)],
          ['Money Spent', money(totalOut)],
          ['Net Balance', money(net)],
          ['Projects List', (firm.projects || []).join(', ')],
          ['Transactions Count', `${modalIncoming.length + modalOutgoing.length} record(s)`],
        ];

        return (
          <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setViewFirmIdx(null); }}>
            <section className="modal-card detail-modal" role="dialog" aria-modal="true" style={{ maxWidth: '780px' }}>
              <div className="modal-header">
                <div>
                  <div className="modal-kicker">FIRM &amp; PROJECTS SPENDING HISTORY</div>
                  <h2>{firm.name}</h2>
                  <p>{firm.id} · Select a project below to filter spending history</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '5px 12px', color: '#2563eb', borderColor: '#bfdbfe' }}
                    onClick={() => exportFirmExcel(firm, activeModalProj)}
                    title={`Export ${firm.name} spending history to Excel`}
                  >
                    <Download size={13}/> Export Firm Excel
                  </button>
                  <button className="icon-button" onClick={() => setViewFirmIdx(null)} aria-label="Close"><X size={19}/></button>
                </div>
              </div>

              {/* Projects Filter in Modal */}
              <div style={{ padding: '0 24px 12px' }}>
                <div className="firm-projects-bar" style={{ margin: '8px 0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Filter Project:</span>
                    {(firm.projects && firm.projects.length > 0) ? (
                      <div className="firm-projects-tags">
                        <button
                          type="button"
                          className={`project-chip ${activeModalProj === 'all' ? 'active' : ''}`}
                          onClick={() => setFirmProjectFilter(prev => ({ ...prev, [firm.id]: 'all' }))}
                        >
                          <span>All Projects</span>
                          <span className="chip-count">{firm.incoming.length + firm.outgoing.length}</span>
                        </button>
                        {firm.projects.map(p => {
                          const count = [...firm.incoming, ...firm.outgoing].filter(t => (t.project || 'General').toLowerCase() === p.toLowerCase()).length;
                          return (
                            <button
                              key={p}
                              type="button"
                              className={`project-chip ${activeModalProj.toLowerCase() === p.toLowerCase() ? 'active' : ''}`}
                              onClick={() => setFirmProjectFilter(prev => ({ ...prev, [firm.id]: p }))}
                            >
                              <span>{p}</span>
                              <span className="chip-count">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No projects added yet for this firm. (Use "Edit Firm &amp; Projects" to add projects)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="detail-amount">
                <span>Net Balance ({activeModalProj === 'all' ? 'All Projects' : activeModalProj})</span>
                <strong className={net < 0 ? 'text-red' : ''}>{money(net)}</strong>
              </div>

              <div className="detail-list">{items.map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>

              {/* Outgoing - Money Spent */}
              <div style={{ padding: '0 24px 12px' }}>
                <h4 style={{ margin: '8px 0', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowUpRight size={14}/> History of Money Spent / Outgoing ({modalOutgoing.length})
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#fee2e2', color: '#b91c1c', padding: '1px 7px', borderRadius: '10px' }}>
                    Spent: {money(totalOut)}
                  </span>
                </h4>
                {modalOutgoing.length > 0 ? (
                  <div className="table-wrap" style={{ maxHeight: '180px', overflow: 'auto', marginBottom: '8px' }}>
                    <table>
                      <thead><tr><th>Date &amp; Time</th><th>Project</th><th>Outgoing Amount (Spent)</th><th>Mode</th><th>Paid To</th><th>Remark</th><th>Action</th></tr></thead>
                      <tbody>
                        {modalOutgoing.map(t => (
                          <tr key={t.id}>
                            <td><span className="date-cell">{formatDate(t.date)}</span> <small className="time-cell">{t.time}</small></td>
                            <td><span className="project-badge-tag">{t.project || 'General'}</span></td>
                            <td><strong className="amount-cell pending-text">- {money(t.amount)}</strong></td>
                            <td><MethodBadge method={t.method}/></td>
                            <td>{t.paidTo || '—'}</td>
                            <td>{t.remark || '—'}</td>
                            <td>
                              <div className="row-actions">
                                <button className="mini-icon action-edit" title="Edit payment details" onClick={() => { setViewFirmIdx(null); openFirmTxModal(viewFirmIdx, 'outgoing', t); }}><Pencil size={13}/></button>
                                <button className="mini-icon action-delete danger" title="Remove" onClick={() => deleteFirmTx(viewFirmIdx, 'outgoing', t.id)}><Trash2 size={13}/></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>No money spent recorded {activeModalProj !== 'all' ? `for ${activeModalProj}` : 'yet for this firm'}.</p>
                )}
              </div>

              {/* Incoming - Money Received */}
              <div style={{ padding: '0 24px 12px' }}>
                <h4 style={{ margin: '8px 0', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowDownToLine size={14}/> History of Money Received / Incoming ({modalIncoming.length})
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '1px 7px', borderRadius: '10px' }}>
                    Received: {money(totalIn)}
                  </span>
                </h4>
                {modalIncoming.length > 0 ? (
                  <div className="table-wrap" style={{ maxHeight: '180px', overflow: 'auto', marginBottom: '8px' }}>
                    <table>
                      <thead><tr><th>Date &amp; Time</th><th>Project</th><th>Incoming Amount (Received)</th><th>Mode</th><th>Remark</th><th>Action</th></tr></thead>
                      <tbody>
                        {modalIncoming.map(t => (
                          <tr key={t.id}>
                            <td><span className="date-cell">{formatDate(t.date)}</span> <small className="time-cell">{t.time}</small></td>
                            <td><span className="project-badge-tag">{t.project || 'General'}</span></td>
                            <td><strong className="amount-cell paid-text">+ {money(t.amount)}</strong></td>
                            <td><MethodBadge method={t.method}/></td>
                            <td>{t.remark || '—'}</td>
                            <td>
                              <div className="row-actions">
                                <button className="mini-icon action-edit" title="Edit payment details" onClick={() => { setViewFirmIdx(null); openFirmTxModal(viewFirmIdx, 'incoming', t); }}><Pencil size={13}/></button>
                                <button className="mini-icon action-delete danger" title="Remove" onClick={() => deleteFirmTx(viewFirmIdx, 'incoming', t.id)}><Trash2 size={13}/></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>No incoming payments recorded {activeModalProj !== 'all' ? `for ${activeModalProj}` : 'yet for this firm'}.</p>
                )}
              </div>

              <div className="modal-footer">
                <span className="required-note">Auto-saved to cloud</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-outline" onClick={() => setViewFirmIdx(null)}>Close</button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ color: '#2563eb', borderColor: '#bfdbfe' }}
                    onClick={() => exportFirmExcel(firm, activeModalProj)}
                    title={`Export ${firm.name} Excel Report`}
                  >
                    <Download size={14}/> Export Firm Excel
                  </button>
                  <button className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} onClick={() => { const idx = viewFirmIdx; setViewFirmIdx(null); openFirmTxModal(idx, 'incoming'); }}><ArrowDownToLine size={14}/> + Record Incoming</button>
                  <button className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }} onClick={() => { const idx = viewFirmIdx; setViewFirmIdx(null); openFirmTxModal(idx, 'outgoing'); }}><ArrowUpRight size={14}/> + Record Outgoing</button>
                  <button className="btn btn-outline" title="Rename firm" onClick={() => { const idx = viewFirmIdx; setViewFirmIdx(null); openEditFirm(idx); }}><Pencil size={13}/> Rename Firm</button>
                </div>
              </div>
            </section>
          </div>
        );
      })()}

      {/* ── Edit Firm Modal (with Project Management) ── */}
      {editFirmIdx !== null && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setEditFirmIdx(null); }}>
          <section className="modal-card" role="dialog" aria-modal="true" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <div className="modal-kicker">MANAGE FIRM &amp; PROJECTS</div>
                <h2>Edit Firm &amp; Projects</h2>
                <p>Edit firm name and add or remove builder projects.</p>
              </div>
              <button className="icon-button" onClick={() => setEditFirmIdx(null)} aria-label="Close"><X size={19}/></button>
            </div>
            <form onSubmit={saveEditFirm} style={{ padding: '16px 24px' }}>
              <label className="field" style={{ marginBottom: '16px' }}>
                <span>Firm Name <b>*</b></span>
                <input
                  value={editFirmName}
                  onChange={e => setEditFirmName(e.target.value)}
                  placeholder="Enter firm name..."
                  required
                  autoFocus
                />
              </label>

              {/* Projects section inside Edit modal */}
              <div className="edit-projects-container">
                <div className="edit-projects-header">
                  <span>Projects for this firm ({editFirmProjects.length})</span>
                  <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Projects added here appear in spending history</small>
                </div>

                <div className="edit-projects-list">
                  {editFirmProjects.length > 0 ? (
                    editFirmProjects.map(p => (
                      <span key={p} className="edit-project-tag">
                        <Briefcase size={11} />
                        {p}
                        <button
                          type="button"
                          className="edit-project-remove-btn"
                          title={`Remove ${p}`}
                          onClick={() => handleRemoveProjectInEdit(p)}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                      No projects added yet. Enter a project name below and click "Add Project".
                    </span>
                  )}
                </div>

                <div className="edit-project-add-row">
                  <input
                    type="text"
                    value={newProjectInEdit}
                    onChange={e => setNewProjectInEdit(e.target.value)}
                    placeholder="Enter project name (e.g. Tower A, Commercial Complex)..."
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddProjectInEdit();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ height: '32px', padding: '0 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                    onClick={handleAddProjectInEdit}
                  >
                    <Plus size={13}/> Add Project
                  </button>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 0 0' }}>
                <span className="required-note"><b>*</b> Required fields</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setEditFirmIdx(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><Check size={16}/> Save Changes</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── Delete Firm Confirmation Modal ── */}
      {deleteFirmTarget && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDeleteFirmTarget(null); }}>
          <section className="modal-card confirm-modal" role="alertdialog" aria-modal="true">
            <div className="confirm-icon"><Trash2 size={23}/></div>
            <h2>Delete this firm?</h2>
            <p>This will permanently remove <strong>{deleteFirmTarget.name}</strong> and all its <strong>{deleteFirmTarget.incoming.length + deleteFirmTarget.outgoing.length}</strong> transaction record{deleteFirmTarget.incoming.length + deleteFirmTarget.outgoing.length === 1 ? '' : 's'} from this browser.</p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setDeleteFirmTarget(null)}>Keep firm</button>
              <button className="btn btn-danger" onClick={confirmDeleteFirm}><Trash2 size={15}/> Delete firm</button>
            </div>
          </section>
        </div>
      )}

      {/* ── Export to Excel Modal with Firm Toggle Options ── */}
      {exportModalOpen && (() => {
        const currentFirm = firms.find(f => f.id === selectedFirmId) || firms[0];
        const currentProjects = currentFirm ? (currentFirm.projects || []) : [];

        // Project filter for the selected firm
        const outList = currentFirm ? (currentFirm.outgoing || []).filter(t => {
          if (selectedFirmProject === 'all') return true;
          return (t.project || 'General').toLowerCase() === selectedFirmProject.toLowerCase();
        }) : [];

        const inList = currentFirm ? (currentFirm.incoming || []).filter(t => {
          if (selectedFirmProject === 'all') return true;
          return (t.project || 'General').toLowerCase() === selectedFirmProject.toLowerCase();
        }) : [];

        const firmTotalOut = outList.reduce((s, t) => s + Number(t.amount || 0), 0);
        const firmTotalIn = inList.reduce((s, t) => s + Number(t.amount || 0), 0);
        const firmNet = firmTotalIn - firmTotalOut;

        const handleDownload = () => {
          if (exportScope === 'firm') {
            exportFirmExcel(currentFirm, selectedFirmProject, {
              includeOutgoing: exportIncludeOutgoing,
              includeIncoming: exportIncludeIncoming,
              includeSummary: exportIncludeSummary
            });
          } else if (exportScope === 'all_firms') {
            exportAllFirmsExcel();
          } else {
            exportMainRegisterExcel();
          }
        };

        return (
          <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setExportModalOpen(false); }}>
            <section className="modal-card export-modal" role="dialog" aria-modal="true">
              <div className="modal-header">
                <div>
                  <div className="modal-kicker">DATA EXPORT CENTER</div>
                  <h2>Export to Excel (.xlsx)</h2>
                  <p>Select report scope &amp; choose which firm's spending history to download.</p>
                </div>
                <button className="icon-button" onClick={() => setExportModalOpen(false)} aria-label="Close"><X size={19}/></button>
              </div>

              <div className="export-modal-body" style={{ padding: '20px 24px' }}>
                {/* ── Scope Toggle Tabs ── */}
                <div className="export-scope-toggle-bar">
                  <button
                    type="button"
                    className={`export-scope-tab ${exportScope === 'firm' ? 'active' : ''}`}
                    onClick={() => setExportScope('firm')}
                  >
                    <Building2 size={16}/>
                    <span>Specific Firm Report</span>
                  </button>
                  <button
                    type="button"
                    className={`export-scope-tab ${exportScope === 'all_firms' ? 'active' : ''}`}
                    onClick={() => setExportScope('all_firms')}
                  >
                    <Building size={16}/>
                    <span>All 8 Firms Combined</span>
                  </button>
                  <button
                    type="button"
                    className={`export-scope-tab ${exportScope === 'general' ? 'active' : ''}`}
                    onClick={() => setExportScope('general')}
                  >
                    <ClipboardList size={16}/>
                    <span>Main Payment Register</span>
                  </button>
                </div>

                {/* ── Specific Firm Selection ── */}
                {exportScope === 'firm' && (
                  <div className="export-firm-section">
                    <div className="export-section-header">
                      <span className="export-section-title">Toggle Which Firm Report to Download:</span>
                      <span className="export-section-count">({firms.length} available builder firms)</span>
                    </div>

                    <div className="firm-toggle-grid">
                      {firms.map((f) => {
                        const isSelected = f.id === selectedFirmId;
                        const fOut = (f.outgoing || []).reduce((s, t) => s + Number(t.amount || 0), 0);
                        const recCount = (f.outgoing || []).length + (f.incoming || []).length;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            className={`firm-toggle-card ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedFirmId(f.id);
                              setSelectedFirmProject('all');
                            }}
                          >
                            <div className="firm-toggle-radio">
                              <span className={`firm-radio-circle ${isSelected ? 'selected' : ''}`}>
                                {isSelected && <span className="firm-radio-inner" />}
                              </span>
                            </div>
                            <div className="firm-toggle-content">
                              <div className="firm-toggle-title">{f.name}</div>
                              <div className="firm-toggle-sub">
                                <span className="spent-tag">Spent: {money(fOut)}</span>
                                <span className="dot-sep">·</span>
                                <span>{recCount} record{recCount === 1 ? '' : 's'}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Project filter toggle for the chosen firm */}
                    {currentFirm && (
                      <div className="export-project-filter-box">
                        <div className="export-section-header">
                          <span className="export-section-title">Filter by Project for {currentFirm.name}:</span>
                        </div>
                        <div className="export-project-chips">
                          <button
                            type="button"
                            className={`export-project-chip ${selectedFirmProject === 'all' ? 'active' : ''}`}
                            onClick={() => setSelectedFirmProject('all')}
                          >
                            <span>All Projects</span>
                            <span className="chip-badge">{(currentFirm.outgoing || []).length + (currentFirm.incoming || []).length}</span>
                          </button>
                          {currentProjects.map(p => {
                            const pCount = [...(currentFirm.outgoing || []), ...(currentFirm.incoming || [])].filter(t => (t.project || 'General').toLowerCase() === p.toLowerCase()).length;
                            return (
                              <button
                                key={p}
                                type="button"
                                className={`export-project-chip ${selectedFirmProject.toLowerCase() === p.toLowerCase() ? 'active' : ''}`}
                                onClick={() => setSelectedFirmProject(p)}
                              >
                                <span>{p}</span>
                                <span className="chip-badge">{pCount}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Toggle inclusions */}
                    <div className="export-inclusions-box">
                      <span className="export-section-title">Include in Spreadsheet:</span>
                      <div className="export-checkbox-row">
                        <label className="export-chk-label">
                          <input
                            type="checkbox"
                            checked={exportIncludeOutgoing}
                            onChange={e => setExportIncludeOutgoing(e.target.checked)}
                          />
                          <span>Money Spent History (Outgoing Expenses — {outList.length} rows)</span>
                        </label>
                        <label className="export-chk-label">
                          <input
                            type="checkbox"
                            checked={exportIncludeIncoming}
                            onChange={e => setExportIncludeIncoming(e.target.checked)}
                          />
                          <span>Money Received History (Incoming Client Receipts — {inList.length} rows)</span>
                        </label>
                        <label className="export-chk-label">
                          <input
                            type="checkbox"
                            checked={exportIncludeSummary}
                            onChange={e => setExportIncludeSummary(e.target.checked)}
                          />
                          <span>Firm &amp; Projects Financial Summary</span>
                        </label>
                      </div>
                    </div>

                    {/* Preview Box */}
                    {currentFirm && (
                      <div className="export-summary-preview">
                        <div className="export-preview-header">
                          <FileText size={16}/>
                          <span>Excel Report Preview ({currentFirm.name})</span>
                        </div>
                        <div className="export-preview-details">
                          <div className="preview-row"><span>Firm:</span><strong>{currentFirm.name} ({currentFirm.id})</strong></div>
                          <div className="preview-row"><span>Project Filter:</span><strong>{selectedFirmProject === 'all' ? 'All Projects' : selectedFirmProject}</strong></div>
                          <div className="preview-row"><span>Total Money Spent (Outgoing):</span><strong style={{ color: '#dc2626' }}>{money(firmTotalOut)} ({outList.length} records)</strong></div>
                          <div className="preview-row"><span>Total Money Received (Incoming):</span><strong style={{ color: '#16a34a' }}>{money(firmTotalIn)} ({inList.length} records)</strong></div>
                          <div className="preview-row"><span>Net Balance:</span><strong className={firmNet < 0 ? 'text-red' : ''}>{money(firmNet)}</strong></div>
                          <div className="preview-row filename">
                            <span>Target File:</span>
                            <code>BuildPay_{currentFirm.name.replace(/[^a-zA-Z0-9]/g, '_')}{selectedFirmProject !== 'all' ? `_${selectedFirmProject.replace(/[^a-zA-Z0-9]/g, '_')}` : ''}_History_{today()}.xlsx</code>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── All 8 Firms Combined ── */}
                {exportScope === 'all_firms' && (
                  <div className="export-all-firms-view">
                    <div className="export-summary-preview">
                      <div className="export-preview-header">
                        <Building size={16}/>
                        <span>Consolidated Multi-Sheet Report (All 8 Builder Firms)</span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 12px' }}>
                        This will generate a master Excel workbook containing sheets for all 8 builder firms, including all individual outgoing spending history and incoming receipts across all projects.
                      </p>
                      <div className="export-preview-details">
                        <div className="preview-row"><span>Included Firms:</span><strong>8 Firms ({firms.map(f => f.name).join(', ')})</strong></div>
                        <div className="preview-row"><span>Total Outgoing Spent:</span><strong style={{ color: '#dc2626' }}>{money(firms.reduce((s, f) => s + (f.outgoing || []).reduce((st, t) => st + Number(t.amount || 0), 0), 0))}</strong></div>
                        <div className="preview-row"><span>Total Incoming Received:</span><strong style={{ color: '#16a34a' }}>{money(firms.reduce((s, f) => s + (f.incoming || []).reduce((st, t) => st + Number(t.amount || 0), 0), 0))}</strong></div>
                        <div className="preview-row filename">
                          <span>Target File:</span>
                          <code>BuildPay_All_8_Firms_Consolidated_{today()}.xlsx</code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Main Payment Register ── */}
                {exportScope === 'general' && (
                  <div className="export-all-firms-view">
                    <div className="export-summary-preview">
                      <div className="export-preview-header">
                        <ClipboardList size={16}/>
                        <span>Main Payment Register Report</span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 12px' }}>
                        Exports the general payment register, including individual worker payments, Paid vs Pending metrics, Person-wise summaries, and Work-type totals.
                      </p>
                      <div className="export-preview-details">
                        <div className="preview-row"><span>Total Records:</span><strong>{visiblePayments.length} transactions</strong></div>
                        <div className="preview-row"><span>Total Paid:</span><strong style={{ color: '#16a34a' }}>{money(totalPaid)}</strong></div>
                        <div className="preview-row"><span>Total Pending:</span><strong style={{ color: '#f59e0b' }}>{money(totalPending)}</strong></div>
                        <div className="preview-row filename">
                          <span>Target File:</span>
                          <code>BuildPay_Report_{today()}.xlsx</code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setExportModalOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleDownload} style={{ padding: '0 18px', fontWeight: 700 }}>
                  <Download size={16}/>
                  {exportScope === 'firm'
                    ? `Download ${currentFirm ? currentFirm.name : 'Firm'} Excel`
                    : exportScope === 'all_firms'
                      ? 'Download All 8 Firms Excel'
                      : 'Download Payment Register Excel'}
                </button>
              </div>
            </section>
          </div>
        );
      })()}

      {toast && <div className="toast"><span className="toast-check"><Check size={16}/></span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
    </div>
  );
}

/* ══════════════════════════════════════════════ */
/*             SUB-COMPONENTS                     */
/* ══════════════════════════════════════════════ */

function StatCard({ title, value, hint, icon: Icon, color, clickable, onClick, isActive }) {
  return (
    <div
      className={`stat-card ${clickable ? 'clickable' : ''} ${isActive ? 'active-filter' : ''}`}
      onClick={clickable ? onClick : undefined}
      title={clickable ? 'Click to toggle filter' : undefined}
    >
      <div className={`stat-icon ${color}`}><Icon size={21}/></div>
      <div className="stat-content">
        <span className="stat-title">{title}</span>
        <strong className="stat-value">{value}</strong>
        <span className="stat-hint">{hint}</span>
      </div>
    </div>
  );
}

function MethodBadge({ method }) {
  const m = (method || '').toLowerCase();
  let badgeClass = 'cash';
  if (m.includes('upi')) badgeClass = 'upi';
  else if (m.includes('cheque') || m.includes('check')) badgeClass = 'cheque';
  else if (m.includes('rtgs')) badgeClass = 'rtgs';
  else if (m.includes('bank')) badgeClass = 'bank-transfer';
  return <span className={`method-badge ${badgeClass}`}>{method}</span>;
}

/* ── Vertical Bar Graph Component ── */
function VerticalBarGraph({ data }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const maxValue = Math.max(...data.map(d => Number(d.value || 0)), 1);

  if (!data || data.length === 0 || maxValue === 1) {
    return (
      <div className="chart-empty-state">
        <BarChart3 size={24}/>
        <p>No payments recorded in this category yet</p>
      </div>
    );
  }

  return (
    <div className="bar-graph-wrapper">
      <div className="bar-graph-plot">
        {/* Y Axis Gridlines */}
        <div className="bar-graph-grid">
          <div className="grid-line"><span>{money(maxValue)}</span></div>
          <div className="grid-line"><span>{money(Math.round(maxValue / 2))}</span></div>
          <div className="grid-line baseline"><span>₹0</span></div>
        </div>

        {/* Bars Container */}
        <div className="bar-columns-area">
          {data.map((item, idx) => {
            const heightPercent = Math.max(6, Math.min(100, Math.round((item.value / maxValue) * 100)));
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={item.label}
                className={`bar-column-group ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip */}
                <div className={`bar-tooltip ${isHovered ? 'visible' : ''}`}>
                  <strong>{money(item.value)}</strong>
                  <span>{item.label}</span>
                </div>

                <div className="bar-val-pill">{item.value >= 1000 ? `₹${Math.round(item.value / 1000)}k` : `₹${item.value}`}</div>

                <div className="bar-track-vertical">
                  <div
                    className="bar-fill-vertical"
                    style={{
                      height: `${heightPercent}%`,
                      backgroundColor: item.color || '#2674f5'
                    }}
                  >
                    <span className="bar-fill-glow" />
                  </div>
                </div>

                <div className="bar-column-label" title={item.label}>
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── SVG Donut / Pie Chart Component ── */
function DonutPieChart({ data, centerLabel = "Total", centerValue }) {
  const total = data.reduce((s, d) => s + Number(d.value || 0), 0);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!total || total <= 0) {
    return (
      <div className="chart-empty-state">
        <PieIcon size={24}/>
        <p>No payment breakdown available</p>
      </div>
    );
  }

  // Pre-calculate segments
  let currentAngle = 0;
  const radius = 56;
  const strokeWidth = 22;
  const center = 75;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="donut-chart-container">
      <div className="donut-svg-wrap">
        <svg viewBox="0 0 150 150" className="donut-svg">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f0f4fa"
            strokeWidth={strokeWidth}
          />
          {data.map((item, idx) => {
            if (!item.value || item.value <= 0) return null;
            const fraction = item.value / total;
            const strokeDasharray = `${fraction * circumference} ${circumference}`;
            const strokeDashoffset = -(currentAngle / 360) * circumference;
            currentAngle += fraction * 360;
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={item.label}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="donut-segment"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: `${center}px ${center}px`,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
              />
            );
          })}
        </svg>

        <div className="donut-center-info">
          <span className="donut-center-lbl">{hoveredIdx !== null ? data[hoveredIdx].label : centerLabel}</span>
          <strong className="donut-center-val">{hoveredIdx !== null ? money(data[hoveredIdx].value) : centerValue || money(total)}</strong>
          {hoveredIdx !== null && (
            <small className="donut-center-pct">{Math.round((data[hoveredIdx].value / total) * 100)}%</small>
          )}
        </div>
      </div>

      <div className="donut-legend">
        {data.map((item, idx) => {
          const pct = Math.round((item.value / total) * 100) || 0;
          return (
            <div
              key={item.label}
              className={`donut-legend-item ${hoveredIdx === idx ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <span className="legend-color-dot" style={{ backgroundColor: item.color }}></span>
              <span className="legend-label">{item.label}</span>
              <strong className="legend-value">{money(item.value)}</strong>
              <span className="legend-pct">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ text, actionLabel, onAction }) {
  return <div className="empty-state"><div className="empty-icon"><ClipboardList size={21}/></div><p>{text}</p>{actionLabel && <button className="text-link" onClick={onAction}>{actionLabel}</button>}</div>;
}

/* ── Searchable Select / Combobox Component ── */
function SearchableSelect({ value, onChange, options = [], placeholder = 'Select...', required = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = React.useRef(null);
  const searchInputRef = React.useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase().trim();
    return options.filter(opt => (opt || '').toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="searchable-select" ref={wrapperRef}>
      {/* Hidden input to maintain native HTML form validity if required */}
      <input
        type="text"
        value={value || ''}
        required={required}
        onChange={() => {}}
        tabIndex={-1}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }}
      />
      
      <div
        className={`searchable-select-trigger ${open ? 'open' : ''}`}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            setTimeout(() => searchInputRef.current?.focus(), 60);
          }
        }}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const next = !open;
            setOpen(next);
            if (next) {
              setTimeout(() => searchInputRef.current?.focus(), 60);
            }
          }
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      >
        <span className={`searchable-select-text ${!value ? 'searchable-select-placeholder' : ''}`}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: 'var(--text-muted)' }} />
      </div>

      {open && (
        <div className="searchable-select-menu">
          <div className="searchable-select-search">
            <Search size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {query && (
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#94a3b8' }}
                onClick={(e) => { e.stopPropagation(); setQuery(''); }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="searchable-select-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <button
                  type="button"
                  key={opt}
                  className={`searchable-select-option ${opt === value ? 'selected' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleSelect(opt); }}
                >
                  <span>{opt}</span>
                  {opt === value && <Check size={13} />}
                </button>
              ))
            ) : (
              <div className="searchable-select-empty">
                No matching results for "{query}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Searchable Firm Select Component (Optional with Search & Toggle) ── */
function SearchableFirmSelect({ value, onChange, firms = [], placeholder = 'Select a builder firm...' }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = React.useRef(null);
  const searchInputRef = React.useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filteredFirms = useMemo(() => {
    if (!searchQuery.trim()) return firms;
    const q = searchQuery.toLowerCase().trim();
    return firms.filter(f =>
      (f.name || '').toLowerCase().includes(q) ||
      (f.id || '').toLowerCase().includes(q)
    );
  }, [firms, searchQuery]);

  const selectedFirm = firms.find(f => f.id === value);

  return (
    <div className="searchable-firm-select-wrap" ref={wrapperRef}>
      <div
        className={`searchable-select-trigger ${open ? 'open' : ''} ${selectedFirm ? 'has-firm' : ''}`}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            setTimeout(() => searchInputRef.current?.focus(), 60);
          }
        }}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const next = !open;
            setOpen(next);
            if (next) {
              setTimeout(() => searchInputRef.current?.focus(), 60);
            }
          }
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Building2 size={16} style={{ color: selectedFirm ? '#2563eb' : '#94a3b8', flexShrink: 0 }} />
          <span className={`searchable-select-text ${!selectedFirm ? 'searchable-select-placeholder' : ''}`}>
            {selectedFirm ? selectedFirm.name : placeholder}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {selectedFirm && (
            <span className="firm-pill-badge">{selectedFirm.id}</span>
          )}
          <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {open && (
        <div className="searchable-select-menu firm-select-menu">
          <div className="searchable-select-search">
            <Search size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search all 8 firms by name or code..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#94a3b8' }}
                onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="searchable-select-options">
            <button
              type="button"
              className={`searchable-select-option ${!value ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setOpen(false);
                setSearchQuery('');
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None (General payment - not linked to any firm)</span>
              </div>
              {!value && <Check size={13} style={{ color: '#2563eb' }} />}
            </button>

            {filteredFirms.length > 0 ? (
              filteredFirms.map(f => {
                const isSelected = f.id === value;
                const pCount = (f.projects || []).length;
                return (
                  <button
                    type="button"
                    key={f.id}
                    className={`searchable-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(f.id);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <div className="firm-option-content">
                      <strong>{f.name}</strong>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        {f.id} · {pCount > 0 ? `${pCount} project${pCount === 1 ? '' : 's'}` : '0 projects'}
                      </small>
                    </div>
                    {isSelected && <Check size={14} style={{ color: '#2563eb', flexShrink: 0 }} />}
                  </button>
                );
              })
            ) : (
              <div className="searchable-select-empty">
                No firms found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Payment Modal with On-the-fly Name/WorkType additions and Checkbox Status ── */
function PaymentModal({ form, updateForm, onSubmit, onClose, editing, error, names, workTypes, firms = [], onAddNewName, onAddNewWorkType }) {
  const [addingName, setAddingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');
  const [addingWorkType, setAddingWorkType] = useState(false);
  const [customWorkTypeInput, setCustomWorkTypeInput] = useState('');

  function handleCreateName() {
    const trimmed = customNameInput.trim();
    if (trimmed) {
      onAddNewName(trimmed);
      setCustomNameInput('');
      setAddingName(false);
    }
  }

  function handleCreateWorkType() {
    const trimmed = customWorkTypeInput.trim();
    if (trimmed) {
      onAddNewWorkType(trimmed);
      setCustomWorkTypeInput('');
      setAddingWorkType(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
        <div className="modal-header">
          <div>
            <div className="modal-kicker">{editing ? 'UPDATE RECORD' : 'NEW TRANSACTION'}</div>
            <h2 id="payment-modal-title">{editing ? 'Edit payment' : 'Add a payment'}</h2>
            <p>Auto-timestamped date & time with auto-balance calculation.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close form"><X size={19}/></button>
        </div>
        
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            {/* Name with inline add & search */}
            <div className="field">
              <div className="field-header">
                <span>Name (Person) <b>*</b></span>
                {!addingName ? (
                  <button type="button" className="field-action-btn" onClick={() => setAddingName(true)}>+ New name</button>
                ) : (
                  <button type="button" className="field-action-btn cancel" onClick={() => setAddingName(false)}>Choose existing</button>
                )}
              </div>
              {!addingName ? (
                <SearchableSelect
                  value={form.name}
                  onChange={val => updateForm('name', val)}
                  options={names}
                  placeholder="Search contractor or worker..."
                  required
                />
              ) : (
                <div className="inline-add-row">
                  <input
                    value={customNameInput}
                    onChange={e => setCustomNameInput(e.target.value)}
                    placeholder="Enter new name..."
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateName(); } }}
                  />
                  <button type="button" className="btn btn-primary btn-xs" onClick={handleCreateName}>Add</button>
                </div>
              )}
            </div>

            {/* Work Type with inline add & search */}
            <div className="field">
              <div className="field-header">
                <span>Work Type <b>*</b></span>
                {!addingWorkType ? (
                  <button type="button" className="field-action-btn" onClick={() => setAddingWorkType(true)}>+ New type</button>
                ) : (
                  <button type="button" className="field-action-btn cancel" onClick={() => setAddingWorkType(false)}>Choose existing</button>
                )}
              </div>
              {!addingWorkType ? (
                <SearchableSelect
                  value={form.workType}
                  onChange={val => updateForm('workType', val)}
                  options={workTypes}
                  placeholder="Search work type..."
                  required
                />
              ) : (
                <div className="inline-add-row">
                  <input
                    value={customWorkTypeInput}
                    onChange={e => setCustomWorkTypeInput(e.target.value)}
                    placeholder="e.g. Plumbing, Electrician..."
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateWorkType(); } }}
                  />
                  <button type="button" className="btn btn-primary btn-xs" onClick={handleCreateWorkType}>Add</button>
                </div>
              )}
            </div>

            <label className="field">
              <span>Amount (₹) <b>*</b></span>
              <div className="amount-input">
                <span>₹</span>
                <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => updateForm('amount', e.target.value)} placeholder="0.00" required/>
              </div>
            </label>

            <label className="field">
              <span>Payment Mode <b>*</b></span>
              <select value={form.method} onChange={e => updateForm('method', e.target.value)}>
                {methods.map(m => <option key={m}>{m}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Payment Date <b>*</b></span>
              <input type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} required/>
            </label>

            <label className="field">
              <span>Payment Time (Auto)</span>
              <input type="time" value={form.time} onChange={e => updateForm('time', e.target.value)}/>
            </label>

            {/* Firm Selection Section (Optional with Toggle & Search across all 8 firms) */}
            <div className="field full firm-assignment-field">
              <div className="field-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={15} style={{ color: '#2563eb' }} />
                  <span>Assign to Firm <b>(Optional)</b></span>
                  <span className="optional-tag">Optional</span>
                </span>
                {form.firmId ? (
                  <button
                    type="button"
                    className="field-action-btn cancel"
                    onClick={() => {
                      updateForm('firmId', '');
                      updateForm('firmName', '');
                      updateForm('project', '');
                    }}
                  >
                    ✕ Clear Firm
                  </button>
                ) : (
                  <span className="field-hint-text">Choose a firm to link this payment to its spending history</span>
                )}
              </div>

              {/* Quick toggle chips */}
              <div className="quick-firm-toggle-row">
                <span className="quick-toggle-title">Toggle Firm:</span>
                <button
                  type="button"
                  className={`quick-firm-chip ${!form.firmId ? 'active' : ''}`}
                  onClick={() => {
                    updateForm('firmId', '');
                    updateForm('firmName', '');
                    updateForm('project', '');
                  }}
                >
                  None (General)
                </button>
                {firms.map(f => {
                  const isSelected = form.firmId === f.id;
                  const shortName = f.name.replace(/Constructions|Ventures|Builders|Developers|Empire|Sangha|Pvt|Ltd/gi, '').trim() || f.name;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`quick-firm-chip ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        updateForm('firmId', f.id);
                        updateForm('firmName', f.name);
                        if (f.projects && f.projects.length > 0) {
                          updateForm('project', f.projects[0]);
                        } else {
                          updateForm('project', 'General Work');
                        }
                      }}
                      title={f.name}
                    >
                      {shortName}
                    </button>
                  );
                })}
              </div>

              {/* Searchable Select for all 8 firms */}
              <SearchableFirmSelect
                value={form.firmId}
                firms={firms}
                onChange={(selectedId) => {
                  const found = firms.find(f => f.id === selectedId);
                  updateForm('firmId', selectedId || '');
                  updateForm('firmName', found ? found.name : '');
                  if (found && found.projects && found.projects.length > 0) {
                    updateForm('project', found.projects[0]);
                  } else {
                    updateForm('project', 'General Work');
                  }
                }}
                placeholder="Search & choose builder firm (e.g. Bhandurge Constructions)..."
              />

              {/* Selected Firm Notice & Project Selector */}
              {form.firmId && (() => {
                const activeFirm = firms.find(f => f.id === form.firmId);
                if (!activeFirm) return null;
                const projects = activeFirm.projects || [];
                return (
                  <div className="firm-selected-linked-box">
                    <div className="firm-linked-notice">
                      <Check size={14} style={{ color: '#16a34a' }} />
                      <span>
                        This payment will be recorded in <strong>{activeFirm.name}</strong> spending history under outgoing expenses.
                      </span>
                    </div>

                    {projects.length > 0 && (
                      <div className="firm-project-select-row">
                        <span className="firm-project-lbl">Firm Project:</span>
                        <div className="firm-project-chips-scroll">
                          <button
                            type="button"
                            className={`project-chip ${(!form.project || form.project === 'General Work') ? 'active' : ''}`}
                            onClick={() => updateForm('project', 'General Work')}
                          >
                            <span>General Work</span>
                          </button>
                          {projects.map(p => (
                            <button
                              key={p}
                              type="button"
                              className={`project-chip ${form.project === p ? 'active' : ''}`}
                              onClick={() => updateForm('project', p)}
                            >
                              <span>{p}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <label className="field full">
              <span>Remark</span>
              <textarea value={form.remark} onChange={e => updateForm('remark', e.target.value)} placeholder="e.g. Foundation material, site survey charges..." rows="2" maxLength="500"/>
            </label>

            {/* Payment Status Checkbox */}
            <div className="field full status-field">
              <span>Payment Status (Checkbox) <b>*</b></span>
              <label className="checkbox-status-card">
                <input
                  type="checkbox"
                  checked={form.status === 'Paid'}
                  onChange={e => updateForm('status', e.target.checked ? 'Paid' : 'Pending')}
                />
                <span className={`status-checkbox-indicator ${form.status === 'Paid' ? 'paid' : 'pending'}`}>
                  {form.status === 'Paid' ? <Check size={16} strokeWidth={3}/> : <Clock3 size={16}/>}
                  <strong>{form.status === 'Paid' ? 'Paid' : 'Pending'}</strong>
                </span>
                <span className="checkbox-status-help">
                  {form.status === 'Paid' ? '✓ Marked as fully paid' : '⏳ Marked as pending / due payment (uncheck/check to toggle)'}
                </span>
              </label>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}
          
          <div className="modal-footer">
            <span className="required-note"><b>*</b> Required fields · Stored locally</span>
            <div>
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Check size={16}/>{editing ? 'Save changes' : 'Save payment'}</button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ── View Modal ── */
function ViewModal({ payment: p, onClose, onEdit }) {
  const updatedIso = p.updatedAt || `${p.date}T${p.time || '10:00'}:00`;
  const items = [
    ['Payment ID', p.id],
    ['Name', p.name],
    ['Work Type', p.workType],
    ['Associated Firm', p.firmName || 'None (General Payment)'],
    ...(p.project && p.project !== 'General Work' ? [['Project', p.project]] : []),
    ['Amount', money(p.amount)],
    ['Date & time', formatDateTime(p)],
    ['Payment Mode', p.method],
    ['Status', p.status],
    ['Last Updated', `${formatRelativeTime(updatedIso)} (${formatFullTimestamp(updatedIso)})`],
    ['Remark', p.remark || 'No remark']
  ];
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal-card detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="modal-header">
          <div><div className="modal-kicker">PAYMENT DETAILS</div><h2 id="detail-title">Transaction record</h2><p>{p.id}</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Close details"><X size={19}/></button>
        </div>
        <div className="detail-amount">
          <span>Amount</span>
          <strong>{money(p.amount)}</strong>
          <span className={`status-badge ${p.status.toLowerCase()}`}>{p.status}</span>
          <MethodBadge method={p.method}/>
        </div>
        <div className="detail-list">{items.map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <div className="modal-footer"><span className="required-note">Saved locally</span><div><button className="btn btn-outline" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={onEdit}><Pencil size={15}/> Edit payment</button></div></div>
      </section>
    </div>
  );
}

/* ── Confirm Delete Modal ── */
function ConfirmModal({ payment, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <section className="modal-card confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <div className="confirm-icon"><Trash2 size={23}/></div>
        <h2 id="delete-title">Delete this payment?</h2>
        <p>This will permanently remove <strong>{payment.id}</strong> for <strong>{payment.name}</strong> from this browser's saved records.</p>
        <div className="confirm-actions">
          <button className="btn btn-outline" onClick={onCancel}>Keep payment</button>
          <button className="btn btn-danger" onClick={onConfirm}><Trash2 size={15}/> Delete payment</button>
        </div>
      </section>
    </div>
  );
}

/* ── Settings Modal ── */
function SettingsModal({ names, workTypes, newName, setNewName, addName, removeName, newWorkType, setNewWorkType, addWorkType, removeWorkType, budgetInput, setBudgetInput, saveBudget, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal-card settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-header">
          <div><div className="modal-kicker">CONFIGURATION</div><h2 id="settings-title">Settings</h2><p>Manage contractor names, work types, and project budget.</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={19}/></button>
        </div>
        <div className="settings-body">
          {/* Project Budget */}
          <div className="settings-section">
            <h3>Project Budget (PR)</h3>
            <p>Set total project budget (PR). Balance = PR - Total Paid.</p>
            <div className="settings-row">
              <div className="amount-input" style={{ flex: 1 }}><span>₹</span><input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="Enter budget..." /></div>
              <button className="btn btn-primary" onClick={() => saveBudget()}><Check size={14}/> Save</button>
            </div>
          </div>

          {/* Names */}
          <div className="settings-section">
            <h3>Contractor / Worker Names</h3>
            <p>Add new names or remove existing ones (Santosh, Kedar, Yallappa, etc).</p>
            <div className="settings-row">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter new name..." onKeyDown={e => e.key === 'Enter' && addName()} />
              <button className="btn btn-primary" onClick={() => addName()}><Plus size={14}/> Add Name</button>
            </div>
            <div className="tag-list">{names.map(n => <span key={n} className="tag">{n}<button onClick={() => removeName(n)} title={`Remove ${n}`}><X size={12}/></button></span>)}</div>
          </div>

          {/* Work Types */}
          <div className="settings-section">
            <h3>Work Types</h3>
            <p>Add work types (BS, Sai, Labour, Carpenter, Survey, etc).</p>
            <div className="settings-row">
              <input value={newWorkType} onChange={e => setNewWorkType(e.target.value)} placeholder="Enter new work type..." onKeyDown={e => e.key === 'Enter' && addWorkType()} />
              <button className="btn btn-primary" onClick={() => addWorkType()}><Plus size={14}/> Add Work Type</button>
            </div>
            <div className="tag-list">{workTypes.map(w => <span key={w} className="tag">{w}<button onClick={() => removeWorkType(w)} title={`Remove ${w}`}><X size={12}/></button></span>)}</div>
          </div>
        </div>
        <div className="modal-footer"><span className="required-note">Changes saved automatically in localStorage</span><div><button className="btn btn-outline" onClick={onClose}>Close</button></div></div>
      </section>
    </div>
  );
}

/* ── People Page ── */
function PeoplePage({ personTotals, query, onSearch, onAddPerson, onDeletePerson }) {
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonInput, setNewPersonInput] = useState('');
  const [deletePersonTarget, setDeletePersonTarget] = useState(null);
  const filtered = personTotals.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

  function handleCreatePerson(e) {
    e.preventDefault();
    const trimmed = newPersonInput.trim();
    if (trimmed) {
      onAddPerson(trimmed);
      setNewPersonInput('');
      setShowAddPersonModal(false);
    }
  }

  function handleConfirmDelete() {
    if (deletePersonTarget) {
      onDeletePerson(deletePersonTarget.name);
      setDeletePersonTarget(null);
    }
  }

  return (
    <section className="panel register-panel people-panel">
      <div className="register-heading">
        <div><h2>People & Contractors Summary</h2><p>Person-wise report: "How much paid to Shivappa / Santosh till now?"</p></div>
        <div className="register-actions">
          <div className="inline-search"><Search size={16}/><input value={query} onChange={e => onSearch(e.target.value)} placeholder="Search people..."/></div>
          <button className="btn btn-primary" onClick={() => setShowAddPersonModal(true)}><Plus size={16}/> Add Person</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Person Name</th>
              <th>Total Paid Till Date</th>
              <th>Pending Amount</th>
              <th>Grand Total</th>
              <th>Total Transactions</th>
              <th className="actions-heading">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.name}>
                <td><div className="table-person"><div className="person-avatar small">{initials(p.name)}</div><strong>{p.name}</strong></div></td>
                <td><strong className="amount-cell paid-text">{money(p.paid)}</strong></td>
                <td><strong className="amount-cell pending-text">{money(p.pending)}</strong></td>
                <td><strong className="amount-cell">{money(p.paid + p.pending)}</strong></td>
                <td><span className="badge-count">{p.count} record{p.count === 1 ? '' : 's'}</span></td>
                <td>
                  <div className="row-actions" style={{ justifyContent: 'center' }}>
                    <button
                      className="mini-icon action-delete danger"
                      title={`Delete ${p.name}`}
                      onClick={() => setDeletePersonTarget(p)}
                    >
                      <Trash2 size={15}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan="6"><EmptyState text="No people found matching your query." actionLabel="Add a person" onAction={() => setShowAddPersonModal(true)}/></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer"><span><strong>{filtered.length}</strong> unique contractors / people recorded</span></div>

      {/* ── Add Person Modal ── */}
      {showAddPersonModal && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAddPersonModal(false); }}>
          <section className="modal-card confirm-modal" role="dialog" aria-modal="true" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div>
                <div className="modal-kicker">NEW PERSON</div>
                <h2>Add Contractor / Person</h2>
                <p>Add a new person to your registered people list.</p>
              </div>
              <button className="icon-button" onClick={() => setShowAddPersonModal(false)} aria-label="Close"><X size={19}/></button>
            </div>
            <form onSubmit={handleCreatePerson} style={{ padding: '16px 24px' }}>
              <label className="field" style={{ marginBottom: '16px' }}>
                <span>Person / Contractor Name <b>*</b></span>
                <input value={newPersonInput} onChange={e => setNewPersonInput(e.target.value)} placeholder="e.g. Santosh, Mahesh, Rajesh..." required autoFocus/>
              </label>
              <div className="modal-footer" style={{ padding: '12px 0 0' }}>
                <span></span>
                <div>
                  <button type="button" className="btn btn-outline" onClick={() => setShowAddPersonModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><Plus size={16}/> Add Person</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── Delete Person Confirmation Modal ── */}
      {deletePersonTarget && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDeletePersonTarget(null); }}>
          <section className="modal-card confirm-modal" role="alertdialog" aria-modal="true">
            <div className="confirm-icon"><Trash2 size={23}/></div>
            <h2>Delete this person?</h2>
            <p>
              Are you sure you want to remove <strong>{deletePersonTarget.name}</strong>?
              {deletePersonTarget.count > 0 && (
                <> This will also remove their <strong>{deletePersonTarget.count}</strong> associated payment record{deletePersonTarget.count === 1 ? '' : 's'}.</>
              )}
            </p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setDeletePersonTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmDelete}><Trash2 size={15}/> Delete</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default App;