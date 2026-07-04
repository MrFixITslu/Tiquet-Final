import React, { useState } from "react";
import { Job, Employee, JobNote, JobMessage, JobLineItem, Deliverable, JobStatus, TimeLog } from "../types";
import { apiFetch } from '../lib/api';
import { ArrowLeft, X, FileText, CheckCircle2, Clock, DollarSign, User, Tag, Calendar, History, Building2, Image as ImageIcon, Printer, MessageSquare, Send, Timer, Play, Square, Box, Plus, Trash2, Package, Download, Truck, FolderOpen, UploadCloud, FileIcon, AlertCircle, ScrollText, Copy, ExternalLink, Sparkles } from "lucide-react";
import { BusinessSettings } from "./Settings";
import { InvoiceView } from "./InvoiceView";

export function JobDetailView({
  job,
  employees,
  settings,
  onBack,
  onUpdate,
}: {
  job: Job;
  employees: Employee[];
  settings: BusinessSettings;
  onBack: () => void;
  onUpdate: (updatedJob: Job) => void;
}) {
  const [invoiceNotes, setInvoiceNotes] = useState(job.invoiceNotes || "");
  const [lineItems, setLineItems] = useState<JobLineItem[]>(job.lineItems || []);
  const [deliverables, setDeliverables] = useState<Deliverable[]>(job.deliverables || []);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [newNote, setNewNote] = useState("");
  
  // Derived Timer State (from DB)
  const isTimerRunning = !!job.timerStartedAt;
  const activeTimerStart = job.timerStartedAt;
  const [activeTab, setActiveTab] = useState<"activity" | "notes" | "chat" | "deliverables" | "files">("activity");
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [newChatMessage, setNewChatMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // File Repository State
  const fileInputRef2 = React.useRef<HTMLInputElement>(null);
  const [repoFiles, setRepoFiles] = useState<any[]>([]);
  const [projectLog, setProjectLog] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [, setTick] = useState(0); // Force re-render for timer counter


  // For Demo purposes, hardcode current employee
  const currentEmployeeId = employees[0]?.id || "e1";
  const currentUser = employees[0]?.name || "Team";

  React.useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await apiFetch(`/api/jobs/${job.id}/messages`);
        if (res.ok) setMessages(await res.json());
      } catch (e) {
        console.error("Fetch messages error:", e);
      }
    };

    fetchMessages();
    const poll = setInterval(fetchMessages, 5000);
    return () => clearInterval(poll);
  }, [job.id]);

  React.useEffect(() => {
    if (activeTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  // Load files when the Files tab is opened
  const fetchFiles = React.useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const res = await apiFetch(`/api/jobs/${job.id}/files`);
      if (res.ok) {
        const data = await res.json();
        setRepoFiles(data.files || []);
        setProjectLog(data.log || []);
      }
    } catch (e) {
      console.error('Fetch files error:', e);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [job.id]);

  React.useEffect(() => {
    if (activeTab === 'files') fetchFiles();
  }, [activeTab, fetchFiles]);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('files', f));
      const res = await apiFetch(`/api/jobs/${job.id}/files`, {
        method: 'POST',
        body: formData, // no Content-Type header — browser sets multipart boundary automatically
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Upload failed'); }
      await fetchFiles(); // Refresh
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  React.useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTick(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`Delete ${filename.replace(/^\d+-/, '')}?`)) return;
    try {
      await apiFetch(`/api/jobs/${job.id}/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      await fetchFiles();
    } catch (e) {
      console.error('Delete file error:', e);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSendChatMessage = async () => {
    if (!newChatMessage.trim() || isSendingMessage) return;
    setIsSendingMessage(true);
    try {
      const res = await apiFetch(`/api/jobs/${job.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: currentUser,
          content: newChatMessage.trim()
        })
      });
      if (res.ok) {
        const sent = await res.json();
        setMessages(prev => [...prev, sent]);
        setNewChatMessage("");
      }
    } catch (e) {
      console.error("Send message error:", e);
    } finally {
      setIsSendingMessage(false);
    }
  };


  const updateJobInDb = async (updatedJob: Job) => {
    try {
      const response = await apiFetch(`/api/jobs/${job.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedJob)
      });
      if (!response.ok) throw new Error("Failed to update job");
      const serverJob = await response.json();
      onUpdate(serverJob);
    } catch (error) {
      console.error("Error updating job:", error);
      alert("Failed to save changes. Please try again.");
    }
  };

  const handleSaveNotes = () => {
    const calculatedAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    updateJobInDb({ ...job, invoiceNotes, lineItems, deliverables, amount: lineItems.length > 0 ? calculatedAmount : job.amount });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const note: JobNote = {
      id: crypto.randomUUID(),
      text: newNote,
      timestamp: new Date().toISOString(),
      user: "Current User",
    };
    updateJobInDb({ ...job, notes: [...(job.notes || []), note] });
    setNewNote("");
  };

  const handleToggleTimer = () => {
    if (!job.depositPaid && !isTimerRunning) {
      alert("A 30% deposit must be paid before work can start on this job.");
      return;
    }
    if (isTimerRunning) {
      // Stop timer logic
      const sessionStart = activeTimerStart || new Date().toISOString();
      const sessionEnd = new Date().toISOString();
      const newTimeLog: TimeLog = {
        id: crypto.randomUUID(),
        employeeId: currentEmployeeId,
        startTime: sessionStart,
        endTime: sessionEnd,
        status: job.status,
      };

      updateJobInDb({
        ...job,
        timeLogs: [...(job.timeLogs || []), newTimeLog],
        timerStartedAt: null, // Clear the timer in DB
      });
    } else {
      // Start timer logic
      updateJobInDb({
        ...job,
        timerStartedAt: new Date().toISOString(), // Persist start time to DB
      });
    }
  };

  const [isSendingLink, setIsSendingLink] = useState(false);
  const [sendResult, setSendResult] = useState<"idle" | "success" | "error">("idle");
  const [isSendingQuote, setIsSendingQuote] = useState(false);
  const [quoteSendResult, setQuoteSendResult] = useState<"idle" | "success" | "error">("idle");

  const handleSendQuote = async () => {
    if (!job.clientEmail) {
      alert("Please add a client email address to send the quote.");
      return;
    }

    setIsSendingQuote(true);
    setQuoteSendResult("idle");
    try {
      const response = await apiFetch(`/api/jobs/${job.id}/send-quote`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to send quote");
      setQuoteSendResult("success");
      // Removed timeout as per user request to stay inactive
    } catch (error) {
      console.error("Error sending quote:", error);
      setQuoteSendResult("error");
      setTimeout(() => setQuoteSendResult("idle"), 3000);
    } finally {
      setIsSendingQuote(false);
    }
  };

  const handleSendLink = async () => {
    if (!job.clientEmail) {
      alert("Please add a client email address to send the link.");
      return;
    }

    setIsSendingLink(true);
    setSendResult("idle");
    try {
      const response = await apiFetch(`/api/jobs/${job.id}/send-portal`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to send");
      setSendResult("success");
      setTimeout(() => setSendResult("idle"), 3000);
    } catch (error) {
      console.error("Error sending link:", error);
      setSendResult("error");
      setTimeout(() => setSendResult("idle"), 3000);
    } finally {
      setIsSendingLink(false);
    }
  };

  const [copyResult, setCopyResult] = useState<"idle" | "success">("idle");
  const handleCopyPortalLink = () => {
    const portalUrl = `${window.location.origin}/portal/${job.secureToken}`;
    navigator.clipboard.writeText(portalUrl);
    setCopyResult("success");
    setTimeout(() => setCopyResult("idle"), 2000);
  };

  const calculateTotalHours = () => {
    const storedTime = job.timeLogs?.reduce((total, log) => {
      if (!log.endTime) return total;
      const start = new Date(log.startTime).getTime();
      const end = new Date(log.endTime).getTime();
      return total + (end - start) / (1000 * 60 * 60);
    }, 0) || 0;

    if (isTimerRunning && activeTimerStart) {
      const elapsedMs = Date.now() - new Date(activeTimerStart).getTime();
      return storedTime + elapsedMs / (1000 * 60 * 60);
    }

    return storedTime;
  };

  const formatTime = (hours: number) => {
    const totalSeconds = Math.floor(hours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalHours = calculateTotalHours();

  return (
    <div className="flex flex-col h-full bg-slate-50 animate-in fade-in duration-300">
      <header className="px-8 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-20 shrink-0 h-20">
        <div className="flex items-center gap-6 min-w-0">
          <button
            onClick={onBack}
            title="Back to jobs"
            className="p-2 -ml-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all flex items-center gap-2 font-bold text-sm shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-8 w-px bg-slate-200 shrink-0" />
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <h3 className="text-xl font-bold text-slate-900 truncate">{job.title}</h3>
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${job.priority === "high"
                ? "bg-red-100 text-red-700"
                : job.priority === "medium"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-slate-200 text-slate-700"
                }`}
            >
              {job.priority}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button
              onClick={handleSendLink}
              disabled={isSendingLink || !job.clientEmail || sendResult === "success"}
              className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${sendResult === "success"
                ? "bg-emerald-100 text-emerald-700"
                : sendResult === "error"
                  ? "bg-red-100 text-red-700"
                  : job.clientEmail
                    ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              title={!job.clientEmail ? "Client email required" : "Email client portal link"}
            >
              {isSendingLink ? (
                <span className="animate-spin w-3 h-3 border-2 border-indigo-700/30 border-t-indigo-700 rounded-full" />
              ) : sendResult === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {sendResult === "success" ? "Sent!" : sendResult === "error" ? "Failed" : "Send Portal Link"}
            </button>
            <button
              onClick={handleCopyPortalLink}
              title="Copy client portal link"
              className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${copyResult === "success"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
            >
              {copyResult === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copyResult === "success" ? "Copied!" : "Copy Link"}
            </button>
            <a
              href={`/portal/${job.secureToken}`}
              target="_blank"
              rel="noreferrer"
              title="View client portal"
              className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-inter"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Portal
            </a>
            {job.status === "estimation" && (
                <button
                  onClick={handleSendQuote}
                  disabled={isSendingQuote || !job.clientEmail || quoteSendResult === "success"}
                  className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${quoteSendResult === "success"
                    ? "bg-emerald-100 text-emerald-700"
                    : quoteSendResult === "error"
                      ? "bg-red-100 text-red-700"
                      : job.clientEmail
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  title={!job.clientEmail ? "Client email required" : "Email quote for approval"}
                >
                  {isSendingQuote ? (
                    <span className="animate-spin w-3 h-3 border-2 border-amber-700/30 border-t-amber-700 rounded-full" />
                  ) : quoteSendResult === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  {quoteSendResult === "success" ? "Sent!" : quoteSendResult === "error" ? "Failed" : "Send Quote"}
                </button>
            )}
            {/* Removed X button, now using Back button */}
          </div>
        </header>

        <div className="p-8 space-y-8 flex-1">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <User className="w-3 h-3 text-indigo-500" /> Client Info
              </p>
              <p className="font-bold text-slate-900 truncate">
                {job.client}
              </p>
              <input
                type="email"
                placeholder="Client Email"
                value={job.clientEmail || ""}
                onChange={(e) => updateJobInDb({ ...job, clientEmail: e.target.value })}
                className="text-xs w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 relative">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-500" /> Status
              </p>
              <div className="flex items-center justify-between">
                <select
                  value={job.status}
                  title="Change job status"
                  onChange={(e) => updateJobInDb({ ...job, status: e.target.value as JobStatus })}
                  className="font-black text-slate-900 capitalize bg-transparent border-none focus:ring-0 p-0 cursor-pointer hover:text-indigo-600 transition-colors"
                >
                  <option value="estimation">Estimation</option>
                  <option value="in-progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="completed">Completed</option>
                  <option value="paid" disabled>Paid (Automated)</option>
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Deposit</span>
                  <button
                    onClick={() => updateJobInDb({ ...job, depositPaid: !job.depositPaid })}
                    title={`Mark deposit as ${job.depositPaid ? 'unpaid' : 'paid'}`}
                    className={`w-8 h-4 rounded-full transition-colors relative ${job.depositPaid ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${job.depositPaid ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Amount
              </p>
              <p className="font-semibold text-slate-900 flex items-center">
                {job.amount ? job.amount.toLocaleString() : "TBD"}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5" /> Time Logged
                  </p>
                  <button
                    onClick={handleToggleTimer}
                    className={`p-1.5 rounded-full flex items-center gap-1 text-xs font-bold uppercase transition-all shadow-sm ${isTimerRunning
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      }`}
                  >
                    {isTimerRunning ? (
                      <>
                        <Square className="w-3 h-3 fill-current" /> Stop
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" /> Start Timer
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-mono font-black text-slate-900 tracking-tight">
                    {formatTime(totalHours)}
                  </p>
                  {isTimerRunning && (
                    <span className="flex h-2.5 w-2.5 relative mb-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" /> Time Breakdown by Stage
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {(['estimation', 'in-progress', 'review', 'invoiced', 'completed'] as JobStatus[]).map(status => {
                const stageTime = job.timeLogs?.filter(log => log.status === status).reduce((total, log) => {
                  if (!log.endTime) return total;
                  const start = new Date(log.startTime).getTime();
                  const end = new Date(log.endTime).getTime();
                  return total + (end - start) / (1000 * 60 * 60);
                }, 0) || 0;
                
                let currentTick = 0;
                if (isTimerRunning && job.status === status && activeTimerStart) {
                   currentTick = (Date.now() - new Date(activeTimerStart).getTime()) / (1000 * 60 * 60);
                }

                const totalStageTime = stageTime + currentTick;

                return (
                  <div key={status} className="bg-white p-3 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{status.replace('-', ' ')}</p>
                    <p className="text-lg font-mono font-bold text-slate-900">{formatTime(totalStageTime)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" /> Assigned To
              </h4>
              <select
                value={job.assignedTo || ""}
                title="Assign job to team member"
                onChange={(e) =>
                  updateJobInDb({ ...job, assignedTo: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-500" /> Tags
              </h4>
              <input
                type="text"
                title="Job tags (comma separated)"
                value={job.tags?.join(", ") || ""}
                onChange={(e) =>
                  updateJobInDb({
                    ...job,
                    tags: e.target.value.split(",").map((t) => t.trim()),
                  })
                }
                placeholder="e.g. urgent, design, web"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" /> Pipeline Assignments
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {(['estimation', 'in-progress', 'review', 'invoiced'] as JobStatus[]).map(status => (
                <div key={status} className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{status.replace('-', ' ')}</label>
                  <select
                    value={job.stageAssignments?.[status] || ""}
                    title={`Assign team member for ${status} stage`}
                    onChange={(e) => {
                      const newAssignments = { ...(job.stageAssignments || {}), [status]: e.target.value };
                      updateJobInDb({ ...job, stageAssignments: newAssignments });
                    }}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="">Unassigned</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">
              Description
            </h4>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 text-sm whitespace-pre-wrap">
              {job.description || "No description provided."}
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-slate-100 mb-2">
            <button
              onClick={() => setActiveTab("activity")}
              className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === "activity" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              <History className="w-4 h-4" /> Activity
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === "notes" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              <FileText className="w-4 h-4" /> Notes
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === "chat" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              <MessageSquare className="w-4 h-4" /> Client Chat
              {messages.some(m => m.sender === 'Client') && (
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("deliverables")}
              className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === "deliverables" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              <Package className="w-4 h-4" /> Deliverables
              {deliverables.length > 0 && (
                <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">{deliverables.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("files")}
              className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === "files" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              <FolderOpen className="w-4 h-4" /> Files
              {repoFiles.length > 0 && (
                <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">{repoFiles.length}</span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px] flex flex-col">
            {activeTab === "activity" && (
              <div className="space-y-4 py-4">
                {job.activityLog?.slice().reverse().map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700">{log.action}</p>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        {log.user} • {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {(!job.activityLog || job.activityLog.length === 0) && (
                  <p className="text-sm text-slate-400 italic">No activity logged yet.</p>
                )}
              </div>
            )}

            {activeTab === "notes" && (
              <div className="flex flex-col h-full py-4">
                <div className="space-y-4 mb-4 flex-1">
                  {job.notes?.map((note) => (
                    <div key={note.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-sm text-slate-700 mb-1">{note.text}</p>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        {note.user} • {new Date(note.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {(!job.notes || job.notes.length === 0) && (
                    <p className="text-sm text-slate-400 italic">No notes yet.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                    placeholder="Add a private note..."
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    onClick={handleAddNote}
                    title="Send note"
                    className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === "chat" && (
              <div className="flex flex-col h-[350px] py-4">
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                  {messages.length === 0 && (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400 italic">No messages with the client yet.</p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={m.id || i} className={`flex ${m.sender === 'Client' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.sender !== 'Client'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-100 text-slate-700 border border-slate-200 rounded-tl-none'
                        }`}>
                        <div className="flex items-center gap-1.5 mb-1 opacity-60 text-xs font-bold uppercase tracking-wider">
                          <User className="w-2.5 h-2.5" /> {m.sender}
                        </div>
                        <p>{m.content}</p>
                        <p className={`text-xs mt-1 opacity-60 ${m.sender !== 'Client' ? 'text-right' : 'text-left'}`}>
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2 mt-auto">
                  <input
                    type="text"
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                    placeholder="Reply to client..."
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    onClick={handleSendChatMessage}
                    title="Send message"
                    disabled={!newChatMessage.trim() || isSendingMessage}
                    className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:bg-slate-200 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === "deliverables" && (
              <div className="flex flex-col h-full py-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Box className="w-4 h-4 text-indigo-500" /> Secure Deliverables
                  </h4>
                  <button
                    onClick={() => {
                      const newD: Deliverable = { id: crypto.randomUUID(), title: "", type: "digital" };
                      setDeliverables([...deliverables, newD]);
                    }}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Asset
                  </button>
                </div>
                
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {deliverables.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400 italic">No deliverables assigned yet. Add digital files or physical goods to release upon payment.</p>
                    </div>
                  ) : deliverables.map((d, index) => (
                    <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <input 
                              type="text" 
                              placeholder="Deliverable Name (e.g. Final Source Code.zip)"
                              value={d.title}
                              onChange={(e) => setDeliverables(deliverables.map(x => x.id === d.id ? { ...x, title: e.target.value } : x))}
                              onBlur={handleSaveNotes}
                              className="text-sm font-bold text-slate-900 w-full focus:outline-none placeholder:font-normal placeholder:text-slate-400"
                            />
                            <select
                              title="Asset type"
                              value={d.type}
                              onChange={(e) => {
                                setDeliverables(deliverables.map(x => x.id === d.id ? { ...x, type: e.target.value as "digital" | "physical" } : x));
                                handleSaveNotes();
                              }}
                              className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md border-none focus:ring-0"
                            >
                              <option value="digital">Digital File</option>
                              <option value="physical">Physical Asset</option>
                            </select>
                          </div>
                          
                          {d.type === "digital" ? (
                            <div className="flex items-center gap-2">
                              <Download className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                placeholder="Secure File URL (e.g. https://s3.aws.com/link...)"
                                value={d.fileUrl || ""}
                                onChange={(e) => setDeliverables(deliverables.map(x => x.id === d.id ? { ...x, fileUrl: e.target.value } : x))}
                                onBlur={handleSaveNotes}
                                className="text-xs w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-400"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                              <div className="flex items-center gap-2 flex-1">
                                <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                                <select 
                                  title="Delivery method"
                                  value={d.deliveryMethod || "pickup"}
                                  onChange={(e) => {
                                    setDeliverables(deliverables.map(x => x.id === d.id ? { ...x, deliveryMethod: e.target.value as "pickup" | "delivery" } : x));
                                    handleSaveNotes();
                                  }}
                                  className="text-xs bg-white text-slate-700 px-2 py-1 rounded border border-slate-200"
                                >
                                  <option value="pickup">Client Pickup</option>
                                  <option value="delivery">Ship/Deliver</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">Delivery Fee:</span>
                                <div className="relative w-24">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                  <input 
                                    type="number"
                                    title="Delivery fee amount"
                                    value={d.deliveryFee || 0}
                                    onChange={(e) => setDeliverables(deliverables.map(x => x.id === d.id ? { ...x, deliveryFee: Number(e.target.value) } : x))}
                                    onBlur={handleSaveNotes}
                                    className="w-full pl-5 pr-2 py-1 text-xs border border-slate-200 rounded focus:border-indigo-400 outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <button 
                          title="Remove deliverable"
                          onClick={() => {
                            setDeliverables(deliverables.filter(x => x.id !== d.id));
                            handleSaveNotes();
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "files" && (
              <div className="flex flex-col h-full py-4 space-y-4">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef2}
                  type="file"
                  multiple
                  title="Upload project files"
                  className="hidden"
                  onChange={e => handleUploadFiles(e.target.files)}
                />

                {/* Drag & Drop Upload Zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragOver(false);
                    handleUploadFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef2.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 bg-white'
                  }`}
                >
                  {isUploading ? (
                    <><span className="animate-spin w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full"/><p className="text-sm font-bold text-indigo-600">Uploading...</p></>
                  ) : (
                    <>
                      <UploadCloud className={`w-8 h-8 ${isDragOver ? 'text-indigo-500' : 'text-slate-300'}`} />
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-700">Drop files here or click to browse</p>
                        <p className="text-xs text-slate-400 mt-1">Quotes, designs, contracts, assets — up to 50MB each</p>
                      </div>
                    </>
                  )}
                </div>

                {uploadError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-2.5 rounded-xl text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />{uploadError}
                  </div>
                )}

                {/* File List */}
                {isLoadingFiles ? (
                  <div className="text-center py-4"><span className="animate-spin inline-block w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full"/></div>
                ) : repoFiles.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Project Files</p>
                    {repoFiles.map(f => (
                      <div key={f.filename} className="flex items-center gap-3 bg-white border border-slate-100 p-3 rounded-xl hover:border-slate-200 transition-colors group">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                          <FileIcon className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{f.name}</p>
                          <p className="text-xs text-slate-400">{formatFileSize(f.size)} · {new Date(f.uploadedAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={f.url}
                            download={f.name}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Download file"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            title="Delete file"
                            onClick={() => handleDeleteFile(f.filename)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Project Audit Log */}
                {projectLog.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <ScrollText className="w-3.5 h-3.5" /> Project Audit Log
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl bg-slate-50 p-3">
                      {[...projectLog].reverse().map((entry, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-700">{entry.action}</p>
                            <p className="text-[10px] text-slate-400">{entry.user} · {new Date(entry.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>


          {job.status === "invoiced" ||
            job.status === "completed" ||
            invoiceNotes ? (
            <div className="border-t border-slate-100 pt-6 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Invoice Configuration
                </h4>
                <button
                  onClick={() => setShowInvoicePreview(true)}
                  className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Preview & Print Invoice
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Business Details
                  </p>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <p className="text-sm font-bold text-slate-900">{settings.name}</p>
                    <p className="text-xs text-slate-500">{settings.address}</p>
                  </div>
                  <p className="text-xs text-slate-400 italic">Manage these details in the Settings tab.</p>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Invoice Terms
                  </p>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-600 line-clamp-3">{settings.paymentTerms}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quote & Invoice Line Items</p>
                  <button
                    onClick={() => {
                      const newItem: JobLineItem = { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 };
                      setLineItems([...lineItems, newItem]);
                    }}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>
                
                {lineItems.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left bg-white">
                      <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="px-4 py-3 w-1/2">Description</th>
                          <th className="px-4 py-3 w-1/6">Qty</th>
                          <th className="px-4 py-3 w-1/5">Price</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-2 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lineItems.map(item => (
                          <tr key={item.id} className="focus-within:bg-indigo-50/30 transition-colors">
                            <td className="p-2">
                              <input 
                                type="text"
                                value={item.description}
                                placeholder="Service or product description..."
                                onChange={e => setLineItems(lineItems.map(x => x.id === item.id ? { ...x, description: e.target.value } : x))}
                                onBlur={handleSaveNotes}
                                className="w-full px-2 py-1.5 text-sm bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded outline-none placeholder:text-slate-300 font-medium text-slate-700"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" 
                                min="1"
                                title="Quantity"
                                value={item.quantity}
                                onChange={e => setLineItems(lineItems.map(x => x.id === item.id ? { ...x, quantity: Number(e.target.value) } : x))}
                                onBlur={handleSaveNotes}
                                className="w-full px-2 py-1.5 text-sm bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-400 rounded outline-none text-slate-700"
                              />
                            </td>
                            <td className="p-2">
                              <div className="relative">
                                <DollarSign className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                <input 
                                  type="number"
                                  title="Unit price"
                                  value={item.unitPrice}
                                  onChange={e => setLineItems(lineItems.map(x => x.id === item.id ? { ...x, unitPrice: Number(e.target.value) } : x))}
                                  onBlur={handleSaveNotes}
                                  className="w-full pl-6 pr-2 py-1.5 text-sm bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-400 rounded outline-none text-slate-700"
                                />
                              </div>
                            </td>
                            <td className="p-2 text-right text-sm font-bold text-slate-900">
                              ${(item.quantity * item.unitPrice).toLocaleString()}
                            </td>
                            <td className="p-2 text-right">
                              <button
                                title="Remove line item"
                                onClick={() => {
                                  const updated = lineItems.filter(x => x.id !== item.id);
                                  setLineItems(updated);
                                  const calculatedAmount = updated.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
                                  updateJobInDb({ ...job, lineItems: updated, amount: calculatedAmount });
                                }}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/80 border-t border-slate-200">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Subtotal</td>
                          <td className="px-4 py-3 text-right text-base font-black text-indigo-600">${lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toLocaleString()}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 mb-3 px-4">Line items define the Quote and Invoice exactly. Break down the full cost into individual services.</p>
                    <button
                      onClick={() => {
                        const newItem: JobLineItem = { id: crypto.randomUUID(), description: "Main Service", quantity: 1, unitPrice: job.amount || 0 };
                        setLineItems([newItem]);
                        updateJobInDb({ ...job, lineItems: [newItem] });
                      }}
                      className="text-xs font-bold text-indigo-600 bg-white border border-indigo-100 shadow-sm hover:bg-indigo-50 px-4 py-2 rounded-lg transition-all"
                    >
                      Convert current ${job.amount} to Line Item
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
      </div>

      {showInvoicePreview && (
        <InvoiceView
          job={job}
          settings={settings}
          onClose={() => setShowInvoicePreview(false)}
        />
      )}
    </div>
  );
}
