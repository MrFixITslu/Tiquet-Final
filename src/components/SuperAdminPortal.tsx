import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Building2, CreditCard, Settings, LogOut, Shield,
  Users, Briefcase, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Search, ChevronRight, MoreVertical, X, Loader2, RefreshCw,
  Ban, Play, Trash2, ChevronDown, Activity, DollarSign, UserPlus
} from "lucide-react";

interface Stats {
  totalAccounts: number;
  activeAccounts: number;
  suspendedAccounts: number;
  totalUsers: number;
  totalJobs: number;
  activeSubs: number;
  trialSubs: number;
  canceledSubs: number;
  mrr: number;
  newSignups30d: number;
}

interface Account {
  id: string;
  name: string;
  status: string;
  plan: string;
  createdAt: string;
  trialEndsAt: string | null;
  suspendedAt: string | null;
  userCount: number;
  jobCount: number;
  subscription: { status: string; plan: string; current_period_end: string } | null;
  settings: { name?: string; email?: string; logoUrl?: string };
}

interface Subscription {
  id: string;
  account_id: string;
  accountName: string;
  accountStatus: string;
  status: string;
  plan: string;
  current_period_end: string;
  createdAt: string;
}

interface AccountDetail extends Account {
  users: Array<{ id: string; name: string; email: string; role: string }>;
  recentJobs: Array<{ id: string; title: string; status: string; amount: number; createdAt: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  trialing: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  suspended: "bg-red-500/20 text-red-400 border-red-500/30",
  past_due: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  canceled: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const PLAN_COLORS: Record<string, string> = {
  trial: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  starter: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  pro: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  enterprise: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

const saFetch = (url: string, opts?: RequestInit) => {
  const token = sessionStorage.getItem("sa_token");
  return fetch(url, {
    ...opts,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
};

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-black text-white">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Badge({ status, label }: { status: string; label?: string }) {
  const color = STATUS_COLORS[status] || "bg-slate-500/20 text-slate-300 border-slate-500/30";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${color} capitalize`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {label || status}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const color = PLAN_COLORS[plan] || PLAN_COLORS.trial;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${color} capitalize`}>
      {plan}
    </span>
  );
}

// ─── Account Detail Drawer ──────────────────────────────────────────────────
function AccountDrawer({ account, onClose, onAction }: { account: AccountDetail; onClose: () => void; onAction: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [planChanging, setPlanChanging] = useState(false);

  const doAction = async (action: "suspend" | "unsuspend" | "delete") => {
    setLoading(action);
    try {
      const method = action === "delete" ? "DELETE" : "PUT";
      const url = action === "delete"
        ? `/api/superadmin/accounts/${account.id}`
        : `/api/superadmin/accounts/${account.id}/${action}`;
      await saFetch(url, { method });
      onAction();
      onClose();
    } finally {
      setLoading(null);
    }
  };

  const changePlan = async (plan: string) => {
    setPlanChanging(true);
    try {
      await saFetch(`/api/superadmin/accounts/${account.id}/change-plan`, {
        method: "PUT",
        body: JSON.stringify({ plan }),
      });
      onAction();
    } finally {
      setPlanChanging(false);
    }
  };

  const isSuspended = account.status === "suspended";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-slate-900 border-l border-white/10 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{account.settings.name || account.name}</h3>
              <p className="text-slate-400 text-xs">{account.settings.email || "—"}</p>
            </div>
          </div>
          <button onClick={onClose} title="Close account details" className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <Badge status={account.status} />
            <PlanBadge plan={account.plan || "trial"} />
            {account.subscription && <Badge status={account.subscription.status} label={`Sub: ${account.subscription.status}`} />}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Users", value: account.userCount, icon: Users },
              { label: "Jobs", value: account.jobCount, icon: Briefcase },
              { label: "Plan", value: (account.plan || "trial").slice(0, 3).toUpperCase(), icon: CreditCard },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/60 border border-white/5 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-white">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Change Plan */}
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Change Plan</p>
            <div className="grid grid-cols-4 gap-2">
              {["trial", "starter", "pro", "enterprise"].map(p => (
                <button
                  key={p}
                  onClick={() => changePlan(p)}
                  disabled={planChanging || account.plan === p}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-40 capitalize ${
                    account.plan === p
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-slate-700 border-white/10 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {planChanging ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : p}
                </button>
              ))}
            </div>
          </div>

          {/* Subscription info */}
          {account.subscription && (
            <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Subscription</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <Badge status={account.subscription.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Period ends</span>
                  <span className="text-slate-300">{account.subscription.current_period_end ? new Date(account.subscription.current_period_end).toLocaleDateString() : "—"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Users */}
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Users ({account.users.length})</p>
            <div className="space-y-2">
              {account.users.slice(0, 5).map(u => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-indigo-500/20 rounded-full flex items-center justify-center text-xs font-bold text-indigo-400">
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{u.name}</p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  <span className="text-xs text-slate-500 border border-slate-700 px-2 py-0.5 rounded-full">{u.role}</span>
                </div>
              ))}
              {account.users.length > 5 && <p className="text-xs text-slate-500 text-center">+{account.users.length - 5} more</p>}
            </div>
          </div>

          {/* Recent Jobs */}
          {account.recentJobs.length > 0 && (
            <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Jobs</p>
              <div className="space-y-2">
                {account.recentJobs.slice(0, 5).map(j => (
                  <div key={j.id} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${j.status === "paid" ? "bg-emerald-400" : j.status === "in-progress" ? "bg-sky-400" : "bg-slate-500"}`} />
                    <p className="text-sm text-slate-300 flex-1 truncate">{j.title}</p>
                    <span className="text-xs text-slate-500 capitalize shrink-0">{j.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions footer */}
        <div className="p-6 border-t border-white/10 space-y-3 bg-slate-900">
          {isSuspended ? (
            <button
              onClick={() => doAction("unsuspend")}
              disabled={!!loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all"
            >
              {loading === "unsuspend" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Unsuspend Account
            </button>
          ) : (
            <button
              onClick={() => doAction("suspend")}
              disabled={!!loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition-all"
            >
              {loading === "suspend" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              Suspend Account
            </button>
          )}

          {confirmDelete ? (
            <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 space-y-3">
              <p className="text-sm text-red-300 text-center font-semibold">⚠️ This will permanently delete all account data. Cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl transition-all text-sm">Cancel</button>
                <button
                  onClick={() => doAction("delete")}
                  disabled={!!loading}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                >
                  {loading === "delete" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Confirm Delete
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 font-bold py-3 rounded-xl transition-all text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Portal Component ───────────────────────────────────────────────────
interface SuperAdminPortalProps {
  admin: { id: string; email: string };
  onLogout: () => void;
}

export function SuperAdminPortal({ admin, onLogout }: SuperAdminPortalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<AccountDetail | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      saFetch("/api/superadmin/stats").then(r => r.json()),
      saFetch("/api/superadmin/accounts").then(r => r.json()),
      saFetch("/api/superadmin/subscriptions").then(r => r.json()),
    ]).then(([s, a, sub]) => {
      setStats(s);
      setAccounts(Array.isArray(a) ? a : []);
      setSubscriptions(Array.isArray(sub) ? sub : []);
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  const openAccount = async (id: string) => {
    const res = await saFetch(`/api/superadmin/accounts/${id}`);
    const data = await res.json();
    setSelectedAccount(data);
  };

  const filteredAccounts = accounts.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.settings.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const matchPlan = planFilter === "all" || a.plan === planFilter;
    return matchSearch && matchStatus && matchPlan;
  });

  const NAV = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "businesses", label: "Businesses", icon: Building2 },
    { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/80 border-r border-white/5 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-white">V79 Tick-It</p>
              <p className="text-xs text-indigo-400 font-medium">Super Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/20"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Admin info */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5">
            <div className="w-8 h-8 bg-indigo-500/30 rounded-full flex items-center justify-center text-xs font-bold text-indigo-300">
              {admin.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">Super Admin</p>
              <p className="text-xs text-slate-500 truncate">{admin.email}</p>
            </div>
            <button onClick={onLogout} title="Logout" className="text-slate-500 hover:text-red-400 transition-colors p-1">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-slate-500 text-sm">Loading platform data…</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── OVERVIEW TAB ──────────────────────────────────────────────── */}
            {activeTab === "overview" && stats && (
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-black text-white">Platform Overview</h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time stats across all tenants</p>
                  </div>
                  <button onClick={refresh} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-all">
                    <RefreshCw className="w-4 h-4" /> Refresh
                  </button>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Total Accounts" value={stats.totalAccounts} sub={`${stats.newSignups30d} new (30d)`} icon={Building2} color="bg-indigo-500/20 text-indigo-400" />
                  <StatCard label="Monthly Recurring" value={`$${stats.mrr.toLocaleString()}`} sub={`${stats.activeSubs} paid subscribers`} icon={DollarSign} color="bg-emerald-500/20 text-emerald-400" />
                  <StatCard label="Active / Trialing" value={`${stats.activeAccounts} / ${stats.trialSubs}`} sub={`${stats.suspendedAccounts} suspended`} icon={Activity} color="bg-sky-500/20 text-sky-400" />
                  <StatCard label="Total Users" value={stats.totalUsers} sub={`Across ${stats.totalAccounts} accounts`} icon={Users} color="bg-purple-500/20 text-purple-400" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <StatCard label="Total Jobs" value={stats.totalJobs} icon={Briefcase} color="bg-amber-500/20 text-amber-400" />
                  <StatCard label="Active Subscriptions" value={stats.activeSubs} icon={CheckCircle2} color="bg-emerald-500/20 text-emerald-400" />
                  <StatCard label="Suspended Accounts" value={stats.suspendedAccounts} icon={AlertTriangle} color="bg-red-500/20 text-red-400" />
                </div>

                {/* Recent Accounts */}
                <div className="bg-slate-800/40 border border-white/5 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Recent Sign-ups</h3>
                    <button onClick={() => setActiveTab("businesses")} className="text-xs text-indigo-400 hover:text-indigo-300">View all →</button>
                  </div>
                  <div className="divide-y divide-white/5">
                    {accounts.slice(0, 5).map(acc => (
                      <div key={acc.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/3 transition-colors cursor-pointer" onClick={() => openAccount(acc.id)}>
                        <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center text-sm font-bold text-indigo-400 shrink-0">
                          {(acc.settings.name || acc.name).charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{acc.settings.name || acc.name}</p>
                          <p className="text-xs text-slate-500">{new Date(acc.createdAt).toLocaleDateString()}</p>
                        </div>
                        <Badge status={acc.status} />
                        <PlanBadge plan={acc.plan || "trial"} />
                        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── BUSINESSES TAB ────────────────────────────────────────────── */}
            {activeTab === "businesses" && (
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-black text-white">Businesses</h1>
                    <p className="text-slate-500 text-sm mt-1">{accounts.length} registered accounts</p>
                  </div>
                  <button onClick={refresh} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-all">
                    <RefreshCw className="w-4 h-4" /> Refresh
                  </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search businesses…"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                  <select
                    title="Filter by status"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <select
                    title="Filter by plan"
                    value={planFilter}
                    onChange={e => setPlanFilter(e.target.value)}
                    className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none"
                  >
                    <option value="all">All Plans</option>
                    <option value="trial">Trial</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                {/* Table */}
                <div className="bg-slate-800/40 border border-white/5 rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Business</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Users</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Jobs</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Joined</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredAccounts.map(acc => (
                        <tr
                          key={acc.id}
                          className="hover:bg-white/3 transition-colors cursor-pointer"
                          onClick={() => openAccount(acc.id)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                                {(acc.settings.name || acc.name).charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">{acc.settings.name || acc.name}</p>
                                <p className="text-xs text-slate-500">{acc.settings.email || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4"><Badge status={acc.status} /></td>
                          <td className="px-4 py-4"><PlanBadge plan={acc.plan || "trial"} /></td>
                          <td className="px-4 py-4 text-sm text-slate-300">{acc.userCount}</td>
                          <td className="px-4 py-4 text-sm text-slate-300">{acc.jobCount}</td>
                          <td className="px-4 py-4 text-sm text-slate-400">{new Date(acc.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-4">
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          </td>
                        </tr>
                      ))}
                      {filteredAccounts.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No businesses match your filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SUBSCRIPTIONS TAB ─────────────────────────────────────────── */}
            {activeTab === "subscriptions" && (
              <div className="p-8 space-y-6">
                <div>
                  <h1 className="text-2xl font-black text-white">Subscriptions</h1>
                  <p className="text-slate-500 text-sm mt-1">{subscriptions.length} total subscriptions</p>
                </div>

                <div className="bg-slate-800/40 border border-white/5 rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Account</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Sub Status</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Period End</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {subscriptions.map(sub => (
                        <tr key={sub.id} className="hover:bg-white/3 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-white">{sub.accountName}</p>
                            <Badge status={sub.accountStatus || "active"} label={sub.accountStatus} />
                          </td>
                          <td className="px-4 py-4"><Badge status={sub.status} /></td>
                          <td className="px-4 py-4"><PlanBadge plan={sub.plan} /></td>
                          <td className="px-4 py-4 text-sm text-slate-400">
                            {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-500">{new Date(sub.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Account Drawer */}
      {selectedAccount && (
        <AccountDrawer
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
          onAction={refresh}
        />
      )}
    </div>
  );
}
