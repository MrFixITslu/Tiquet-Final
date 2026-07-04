import React, { useState, useEffect } from "react";
import { apiFetch } from '../lib/api';
import {
    User,
    Mail,
    Phone,
    Building2,
    ChevronRight,
    ArrowLeft,
    Briefcase,
    DollarSign,
    CheckCircle2,
    Clock,
    FileEdit,
    Save,
    X,
    AlertCircle,
    TrendingUp,
} from "lucide-react";

interface ClientJob {
    id: string;
    title: string;
    status: string;
    amount: number | null;
    createdAt: string;
    dueDate: string | null;
    priority: string;
    assignedTo: string | null;
}

interface Client {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    notes: string | null;
    createdAt: string;
    jobs: ClientJob[];
    totalJobs: number;
    activeJobs: number;
    totalRevenue: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    request: { label: "Request", color: "text-blue-700", bg: "bg-blue-50" },
    estimation: { label: "Estimation", color: "text-yellow-700", bg: "bg-yellow-50" },
    "in-progress": { label: "In Progress", color: "text-purple-700", bg: "bg-purple-50" },
    review: { label: "Review", color: "text-orange-700", bg: "bg-orange-50" },
    invoiced: { label: "Invoiced", color: "text-indigo-700", bg: "bg-indigo-50" },
    completed: { label: "Completed", color: "text-emerald-700", bg: "bg-emerald-50" },
};

const PRIORITY_COLOR: Record<string, string> = {
    high: "text-red-600", medium: "text-yellow-600", low: "text-slate-400",
};

export function Clients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [selected, setSelected] = useState<Client | null>(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ email: "", phone: "", company: "", notes: "" });
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    const fetchClients = async () => {
        try {
            const res = await apiFetch("/api/clients");
            if (res.ok) {
                const data = await res.json();
                setClients(data);
                // Refresh selected client if one is open
                if (selected) {
                    const refreshed = data.find((c: Client) => c.id === selected.id);
                    if (refreshed) setSelected(refreshed);
                }
            }
        } catch (e) {
            console.error("Failed to fetch clients:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClients(); }, []);

    const openProfile = (client: Client) => {
        setSelected(client);
        setForm({ email: client.email || "", phone: client.phone || "", company: client.company || "", notes: client.notes || "" });
        setEditing(false);
    };

    const saveContact = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            await apiFetch(`/api/clients/${selected.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            await fetchClients();
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const filtered = clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.company || "").toLowerCase().includes(search.toLowerCase())
    );

    // ── Profile View ─────────────────────────────────────────────────────────────
    if (selected) {
        const s = selected;
        return (
            <div className="space-y-6">
                {/* Back + header */}
                <div className="flex items-center gap-4">
                    <button type="button" onClick={() => setSelected(null)} title="Back to clients list" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{s.name}</h2>
                        <p className="text-slate-500 text-sm">{s.company || "Client Profile"}</p>
                    </div>
                    <div className="ml-auto">
                        {editing ? (
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors">
                                    <X className="w-4 h-4" /> Cancel
                                </button>
                                <button type="button" onClick={saveContact} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium transition-colors disabled:opacity-60">
                                    <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors">
                                <FileEdit className="w-4 h-4" /> Edit Contact
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Contact card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl font-bold">
                            {s.name.charAt(0).toUpperCase()}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">{s.name}</h3>

                        {editing ? (
                            <div className="space-y-3">
                                {[
                                    { label: "Email", key: "email", type: "email", icon: <Mail className="w-4 h-4" /> },
                                    { label: "Phone", key: "phone", type: "tel", icon: <Phone className="w-4 h-4" /> },
                                    { label: "Company", key: "company", type: "text", icon: <Building2 className="w-4 h-4" /> },
                                ].map(({ label, key, type }) => (
                                    <div key={key}>
                                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</label>
                                        <input
                                            type={type}
                                            value={form[key as keyof typeof form]}
                                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                            className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                            placeholder={`Enter ${label.toLowerCase()}`}
                                        />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Notes</label>
                                    <textarea
                                        value={form.notes}
                                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        rows={3}
                                        className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                                        placeholder="Internal notes about this client…"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {[
                                    { icon: <Mail className="w-4 h-4 text-slate-400" />, val: s.email, label: "No email" },
                                    { icon: <Phone className="w-4 h-4 text-slate-400" />, val: s.phone, label: "No phone" },
                                    { icon: <Building2 className="w-4 h-4 text-slate-400" />, val: s.company, label: "No company" },
                                ].map(({ icon, val, label }, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        {icon}
                                        <span className={val ? "text-sm text-slate-800" : "text-sm text-slate-400 italic"}>{val || label}</span>
                                    </div>
                                ))}
                                {s.notes && (
                                    <div className="mt-2 bg-slate-50 rounded-xl p-3 text-sm text-slate-600 border border-slate-100">
                                        {s.notes}
                                    </div>
                                )}
                                <p className="text-xs text-slate-400">Client since {new Date(s.createdAt).toLocaleDateString()}</p>
                            </div>
                        )}
                    </div>

                    {/* Stats + job list */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { icon: <Briefcase className="w-5 h-5 text-indigo-600" />, label: "Total Jobs", val: s.totalJobs, bg: "bg-indigo-50" },
                                { icon: <Clock className="w-5 h-5 text-amber-600" />, label: "Active Jobs", val: s.activeJobs, bg: "bg-amber-50" },
                                { icon: <TrendingUp className="w-5 h-5 text-emerald-600" />, label: "Total Revenue", val: `$${s.totalRevenue.toLocaleString()}`, bg: "bg-emerald-50" },
                            ].map(({ icon, label, val, bg }) => (
                                <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
                                    <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
                                        <p className="text-xl font-bold text-slate-900">{val}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Job history */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <div className="px-6 py-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-900">Job History</h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {s.jobs.length === 0 && (
                                    <div className="px-6 py-10 text-center text-slate-400 text-sm">No jobs found for this client.</div>
                                )}
                                {s.jobs.map(job => {
                                    const sc = STATUS_CONFIG[job.status] || { label: job.status, color: "text-slate-600", bg: "bg-slate-100" };
                                    const isOverdue = job.dueDate && new Date(job.dueDate) < new Date() && !["completed", "invoiced"].includes(job.status);
                                    return (
                                        <div key={job.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="font-semibold text-slate-900 text-sm truncate">{job.title}</p>
                                                    {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" title="Overdue" />}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                                    <span>Created {new Date(job.createdAt).toLocaleDateString()}</span>
                                                    {job.dueDate && <span>· Due {new Date(job.dueDate).toLocaleDateString()}</span>}
                                                    {job.assignedTo && <span>· {job.assignedTo}</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                {job.amount != null && (
                                                    <div className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                                                        <DollarSign className="w-3.5 h-3.5" />
                                                        {Number(job.amount).toLocaleString()}
                                                    </div>
                                                )}
                                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
                                                <span className={`text-xs font-medium capitalize ${PRIORITY_COLOR[job.priority] || "text-slate-400"}`}>{job.priority}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── List View ─────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Clients</h2>
                    <p className="text-slate-500 text-sm mt-1">{clients.length} client{clients.length !== 1 ? "s" : ""} on record</p>
                </div>
                <input
                    type="search"
                    placeholder="Search clients…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map(c => (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => openProfile(c)}
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-left hover:shadow-md hover:border-indigo-200 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-base mb-0.5 truncate">{c.name}</h3>
                        {c.company && <p className="text-xs text-slate-500 mb-3 truncate">{c.company}</p>}

                        <div className="space-y-1.5 mb-4">
                            {c.email && (
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Mail className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{c.email}</span>
                                </div>
                            )}
                            {c.phone && (
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Phone className="w-3.5 h-3.5 shrink-0" />
                                    <span>{c.phone}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
                                <Briefcase className="w-3.5 h-3.5" />
                                {c.totalJobs} job{c.totalJobs !== 1 ? "s" : ""}
                            </div>
                            {c.activeJobs > 0 && (
                                <div className="flex items-center gap-1 text-xs font-medium text-amber-600">
                                    <Clock className="w-3.5 h-3.5" />
                                    {c.activeJobs} active
                                </div>
                            )}
                            {c.totalRevenue > 0 && (
                                <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 ml-auto">
                                    <DollarSign className="w-3.5 h-3.5" />
                                    {c.totalRevenue.toLocaleString()}
                                </div>
                            )}
                        </div>
                    </button>
                ))}
                {filtered.length === 0 && (
                    <div className="col-span-3 text-center py-16 text-slate-400">
                        <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No clients found</p>
                        <p className="text-sm">Clients are automatically created when you add a new job.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
