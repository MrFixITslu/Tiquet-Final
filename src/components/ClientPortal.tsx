import React from "react";
import { Job } from "../types";
import { Clock, DollarSign, Calendar, History, FileText, MessageSquare, Send, User, Download, X, Package, Lock, Truck } from "lucide-react";
import { BusinessSettings } from "./Settings";
import { InvoiceView } from "./InvoiceView";
import { PaymentModal } from "./PaymentModal";

export function ClientPortal({
    token
}: {
    token: string;
}) {
    const [job, setJob] = React.useState<Job | null>(null);
    const [settings, setSettings] = React.useState<BusinessSettings | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [isPaying, setIsPaying] = React.useState(false);
    const [isPayingDeposit, setIsPayingDeposit] = React.useState(false);
    const [isApproving, setIsApproving] = React.useState(false);
    const [paymentSuccess, setPaymentSuccess] = React.useState(false);

    const [messages, setMessages] = React.useState<any[]>([]);
    const [newMessage, setNewMessage] = React.useState("");
    const [isSending, setIsSending] = React.useState(false);
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const [showInvoice, setShowInvoice] = React.useState(false);
    const [paymentModalConfig, setPaymentModalConfig] = React.useState<{ isOpen: boolean, type: "deposit" | "final", amount: number } | null>(null);
    const chatEndRef = React.useRef<HTMLDivElement>(null);


    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/portal/${token}`);
                if (!res.ok) {
                    setError("Invalid or expired portal link.");
                    return;
                }
                const data = await res.json();
                setJob(data.job);
                setSettings(data.settings);
                setMessages(data.job.messages || []); // Assuming messages are now part of data.job
                setPaymentSuccess(data.job.status === "paid"); // Assuming status is now part of data.job
            } catch (err) {
                setError("Failed to load portal data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        // Polling for messages
        const pollInterval = setInterval(async () => {
            if (!token) return;
            try {
                const res = await fetch(`/api/portal/${token}`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.messages || []);
                }
            } catch (e) {
                console.error("Polling error:", e);
            }
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [token]);

    React.useEffect(() => {
        if (isChatOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isChatOpen]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !job || isSending) return;

        setIsSending(true);
        try {
            const res = await fetch(`/api/jobs/${job.id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sender: "Client",
                    content: newMessage.trim()
                })
            });

            if (res.ok) {
                const sentMsg = await res.json();
                setMessages(prev => [...prev, sentMsg]);
                setNewMessage("");
            }
        } catch (e) {
            console.error("Send error:", e);
        } finally {
            setIsSending(false);
        }
    };

    const handlePayment = async () => {
        setIsPaying(true);
        try {
            const res = await fetch(`/api/portal/${token}/pay-final`, { method: "POST" });
            if (res.ok) {
                setPaymentSuccess(true);
                setJob(prev => prev ? { ...prev, status: 'paid' } : null);
            }
        } catch (e) {
            console.error("Payment error:", e);
        } finally {
            setIsPaying(false);
        }
    };

    const handlePayDeposit = async () => {
        setIsPayingDeposit(true);
        try {
            const res = await fetch(`/api/portal/${token}/pay-deposit`, { method: "POST" });
            if (res.ok) {
                setJob(prev => prev ? { ...prev, depositPaid: true } : null);
            }
        } catch (e) {
            console.error("Deposit payment error:", e);
        } finally {
            setIsPayingDeposit(false);
        }
    };

    const handleApproveQuote = async () => {
        setIsApproving(true);
        try {
            const res = await fetch(`/api/portal/${token}/approve-quote`, { method: "POST" });
            if (res.ok) {
                setJob(prev => prev ? { ...prev, quoteApproved: 1 } : null);
            }
        } catch (e) {
            console.error("Approval error:", e);
        } finally {
            setIsApproving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="animate-pulse text-slate-500">Loading your project portal...</div>
            </div>
        );
    }

    if (error || !job || !settings) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl font-bold">!</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Invalid Link</h2>
                    <p className="text-slate-500">
                        {error || "This tracking link has expired or is invalid. Please contact support."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {settings.logoUrl && (
                            <img
                                src={settings.logoUrl}
                                alt="Logo"
                                className="h-8 object-contain"
                                referrerPolicy="no-referrer"
                            />
                        )}
                        <span className="font-bold text-slate-900">{settings.name}</span>
                    </div>
                    <div className="text-sm font-medium text-slate-500">Client Portal</div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{job.title}</h1>
                    <p className="text-slate-500">Prepared for {job.client}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Status
                            </p>
                            <p className="font-semibold text-slate-900 capitalize">
                                {job.status.replace("-", " ")}
                            </p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <DollarSign className="w-3 h-3" /> Amount
                            </p>
                            <p className="font-semibold text-slate-900 flex items-center">
                                {job.amount ? job.amount.toLocaleString() : "TBD"}
                            </p>
                        </div>
                        <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Target Date
                            </p>
                            <p className="font-semibold text-slate-900">
                                {job.dueDate
                                    ? new Date(job.dueDate).toLocaleDateString()
                                    : "Not set"}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-semibold text-slate-900">Scope of Work</h4>
                        {job.amount ? (
                            <button
                                onClick={() => setShowInvoice(true)}
                                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <FileText className="w-4 h-4" />
                                View Document
                            </button>
                        ) : null}
                    </div>
                    <div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                            {job.description || "No description provided."}
                        </div>
                    </div>

                    {job.deliverables && job.deliverables.length > 0 && (
                        <div className="border border-slate-200 p-6 rounded-2xl mb-6 bg-white shadow-sm">
                            <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Package className="w-5 h-5 text-indigo-500" /> Secure Deliverables
                            </h4>
                            <div className="space-y-3">
                                {job.deliverables.map(d => (
                                    <div key={d.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            {d.type === 'digital' ? <Download className="w-5 h-5 text-slate-400" /> : <Truck className="w-5 h-5 text-slate-400" />}
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">{d.title || "Unnamed Asset"}</p>
                                                <p className="text-xs text-slate-500 capitalize">{d.type} {d.type === 'physical' && d.deliveryMethod ? `• ${d.deliveryMethod}` : ''}</p>
                                            </div>
                                        </div>
                                        {d.type === 'digital' ? (
                                            <button 
                                                disabled={job.status !== "paid"}
                                                onClick={() => { if(d.fileUrl) window.open(d.fileUrl, "_blank"); }}
                                                className={`text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm ${job.status === "paid" ? "bg-red-500 hover:bg-red-600 text-white shadow-red-200" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
                                            >
                                                {job.status === "paid" ? <><Download className="w-4 h-4" /> Download</> : <><Lock className="w-4 h-4" /> Locked</>}
                                            </button>
                                        ) : (
                                            <div className="text-right">
                                                {d.deliveryFee ? <p className="text-sm font-bold text-slate-900">+${d.deliveryFee}</p> : <p className="text-sm font-bold text-emerald-600">Free</p>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quote Approval Section */}
                    {job.status === "estimation" && !job.quoteApproved && (
                        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl mb-6">
                            <div className="flex items-center gap-2 mb-4 text-indigo-700 font-bold">
                                <FileText className="w-5 h-5" />
                                <h3>Quote Approval Required</h3>
                            </div>
                            <p className="text-sm text-indigo-900/80 mb-6">
                                Please review the scope of work and estimate amount. Once approved, you can proceed to secure the project with a deposit.
                            </p>
                            <button
                                onClick={handleApproveQuote}
                                disabled={isApproving}
                                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
                            >
                                {isApproving ? (
                                    <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                                ) : (
                                    <>Approve Quote</>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Deposit Section */}
                    {job.amount && !job.depositPaid && !["invoiced", "completed", "paid"].includes(job.status) && (job.status !== "estimation" || !!job.quoteApproved) && (
                        <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl mb-6">
                            <div className="flex items-center gap-2 mb-4 text-amber-700 font-bold">
                                <DollarSign className="w-5 h-5" />
                                <h3>30% Deposit Required</h3>
                            </div>
                            <p className="text-sm text-amber-900/80 mb-6">
                                A 30% deposit is required to secure your project and begin engineering work.
                            </p>
                            <button
                                onClick={() => setPaymentModalConfig({ isOpen: true, type: "deposit", amount: job.amount ? job.amount * 0.3 : 0 })}
                                disabled={isPayingDeposit}
                                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-2"
                            >
                                {isPayingDeposit ? (
                                    <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                                ) : (
                                    <>Pay Deposit - ${(job.amount ? job.amount * 0.3 : 0).toLocaleString()}</>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Final Payment Section */}
                    {job.status === "invoiced" && !paymentSuccess && (
                        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl">
                            <div className="flex items-center gap-2 mb-4 text-indigo-700 font-bold">
                                <FileText className="w-5 h-5" />
                                <h3>Invoice Ready</h3>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => setPaymentModalConfig({ isOpen: true, type: "final", amount: job.amount || 0 })}
                                    disabled={isPaying}
                                    title="Secure payment for this invoice"
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
                                >
                                    {isPaying ? (
                                        <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                                    ) : (
                                        <>Pay Final Balance - ${(job.amount || 0).toLocaleString()}</>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowInvoice(true)}
                                    className="flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <FileText className="w-5 h-5" />
                                    View Invoice
                                </button>
                            </div>
                            <p className="text-xs text-indigo-400 mt-4 text-center sm:text-left flex items-center justify-center sm:justify-start gap-1">
                                Secure payment powered by <strong>Stripe</strong>
                            </p>
                        </div>
                    )}

                    {paymentSuccess && (
                        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 ring-4 ring-emerald-50">
                                <DollarSign className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-emerald-900 mb-2">Payment Successful!</h3>
                            <p className="text-sm text-emerald-700 mb-4">
                                Thank you for your business. A receipt has been sent to your email.
                            </p>
                            <button
                                onClick={() => setShowInvoice(true)}
                                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-6 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                <FileText className="w-5 h-5" />
                                View Receipt
                            </button>
                        </div>
                    )}
                </div>

                {job.activityLog && job.activityLog.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-900 mb-6 flex items-center gap-2">
                            <History className="w-4 h-4 text-indigo-500" /> Project Timeline
                        </h4>
                        <div className="space-y-6">
                            {job.activityLog
                                .slice()
                                .reverse()
                                .map((log) => (
                                    <div key={log.id} className="flex gap-4">
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shrink-0 ring-4 ring-indigo-50" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">
                                                {log.action}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {new Date(log.timestamp).toLocaleDateString(undefined, {
                                                    weekday: "long",
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Floating Chat */}
            <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-end transition-all duration-300 ${isChatOpen ? 'w-80 h-[450px]' : 'w-14 h-14'}`}>
                {isChatOpen ? (
                    <div className="bg-white w-full h-full rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        {/* Chat Header */}
                        <div className="bg-indigo-600 p-4 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                                    <User className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold leading-tight">Project Team</p>
                                    <p className="text-xs opacity-70">Active Now</p>
                                </div>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} title="Close chat" className="hover:bg-indigo-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                            {messages.length === 0 && (
                                <div className="text-center py-10">
                                    <p className="text-xs text-slate-400 italic">No messages yet. Send a message to the team!</p>
                                </div>
                            )}
                            {messages.map((m, i) => (
                                <div key={m.id || i} className={`flex ${m.sender === 'Client' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.sender === 'Client'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                                        }`}>
                                        <p>{m.content}</p>
                                        <p className={`text-xs mt-1 opacity-60 ${m.sender === 'Client' ? 'text-right' : 'text-left'}`}>
                                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Chat Input */}
                        <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 bg-white">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type your message..."
                                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || isSending}
                                    title="Send message to team"
                                    className="absolute right-1.5 top-1.5 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsChatOpen(true)}
                        title="Open live chat"
                        className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-all flex items-center justify-center relative group"
                    >
                        <MessageSquare className="w-6 h-6" />
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full border-2 border-slate-50 group-hover:animate-bounce">
                            Live
                        </span>
                    </button>
                )}
            </div>

            {paymentModalConfig?.isOpen && (
                <PaymentModal
                    amount={paymentModalConfig.amount}
                    type={paymentModalConfig.type}
                    onSuccess={() => {
                        setPaymentModalConfig(null);
                        if (paymentModalConfig.type === "deposit") handlePayDeposit();
                        else handlePayment();
                    }}
                    onClose={() => setPaymentModalConfig(null)}
                />
            )}

            {showInvoice && (
                <InvoiceView
                    job={job}
                    settings={settings}
                    onClose={() => setShowInvoice(false)}
                />
            )}
        </div>
    );
}
