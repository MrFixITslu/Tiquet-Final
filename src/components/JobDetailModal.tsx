import React, { useState } from "react";
import { Job, Employee, JobNote, Client } from "../types";
import { BusinessSettings } from "./Settings";
import {
  X,
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  User,
  Tag,
  Calendar,
  History,
  Building2,
  Image as ImageIcon,
  Printer,
  MessageSquare,
  Send,
  Sparkles,
  FileSpreadsheet,
  CheckSquare,
  Download
} from "lucide-react";
import { jsPDF } from "jspdf";

export function JobDetailModal({
  job,
  employees,
  clients,
  settings,
  onClose,
  onUpdate,
}: {
  job: Job;
  employees: Employee[];
  clients: Client[];
  settings: BusinessSettings;
  onClose: () => void;
  onUpdate: (updatedJob: Job) => void;
}) {
  const [invoiceNotes, setInvoiceNotes] = useState(job.invoiceNotes || "");
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [docType, setDocType] = useState<"estimate" | "work_order" | "invoice">("invoice");
  const [newNote, setNewNote] = useState("");

  const handleSaveNotes = () => {
    onUpdate({ ...job, invoiceNotes });
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();
      const client = clientDetails;

      // Color Palette
      const primaryColor = [15, 23, 42]; // Slate 900
      const secondaryColor = [99, 102, 241]; // Indigo 500
      const lightGray = [241, 245, 249]; // Slate 100
      const darkGray = [71, 85, 105]; // Slate 600

      // Header Band
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 40, "F");

      // Title on Header Band
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      
      const docTitleText = docType === "estimate" 
        ? "ESTIMATE & PROPOSAL" 
        : docType === "work_order" 
        ? "WORK ORDER" 
        : "COMMERCIAL INVOICE";
        
      doc.text(docTitleText, 15, 25);

      // Business Name & Info on Header Band
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`${settings.name || "V79 TIQUET Enterprise"}`, 140, 18);
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225); // Slate 300
      doc.text(`${settings.address || ""}`, 140, 24, { maxWidth: 55 });
      doc.text(`${settings.email || ""} | ${settings.phone || ""}`, 140, 34);

      // Invoice Meta (under header)
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(docType === "estimate" ? "ESTIMATE DETAILS" : docType === "work_order" ? "WORK ORDER DETAILS" : "INVOICE DETAILS", 15, 55);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      
      const prefix = docType === "estimate" ? "EST" : docType === "work_order" ? "WO" : "INV";
      const invoiceRef = `${prefix}-${job.id.slice(0, 8).toUpperCase()}`;
      doc.text(`Reference No: ${invoiceRef}`, 15, 62);
      doc.text(`Created Date: ${new Date(job.createdAt).toLocaleDateString()}`, 15, 68);
      const dueDateText = job.dueDate ? new Date(job.dueDate).toLocaleDateString() : "Upon receipt";
      doc.text(`Target/Due Date: ${dueDateText}`, 15, 74);
      doc.text(`Status: ${job.status.toUpperCase()}`, 15, 80);

      // Client Info Card (right side)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(docType === "work_order" ? "CLIENT / LOCATION" : "BILL TO", 120, 55);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(`Client Name: ${job.client}`, 120, 62);
      if (client) {
        doc.text(`Contact: ${client.name}`, 120, 68);
        doc.text(`Email: ${client.email}`, 120, 74);
        if (client.phone) doc.text(`Phone: ${client.phone}`, 120, 80);
        if (client.address) {
          doc.text(`Address: ${client.address}`, 120, 86, { maxWidth: 75 });
        }
      } else {
        doc.text("No additional contact info registered.", 120, 68);
      }

      // Horizontal line
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.line(15, 105, 195, 105);

      // Scope / Title Details
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("PROJECT SCOPE & DETAILS", 15, 115);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Job Title: ${job.title}`, 15, 123);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      const descriptionLines = doc.splitTextToSize(job.description || "No description provided.", 180);
      doc.text(descriptionLines, 15, 129);

      const descHeight = descriptionLines.length * 4.5;
      let currentY = 129 + descHeight + 10;

      if (docType !== "work_order") {
        // Line Items Table Header
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.rect(15, currentY, 180, 8, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("Description / Line Items", 18, currentY + 5.5);
        doc.text("Amount", 175, currentY + 5.5, { align: "right" });

        currentY += 8;

        // Render line items or fallback to Job Title
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

        const currencySymbol = settings.currency === "XCD" ? "EC$" : "$";

        if (invoiceNotes) {
          const lines = invoiceNotes.split("\n").filter(line => line.trim());
          lines.forEach((line) => {
            let amt = "-";
            if (line.includes("$")) {
              amt = `${currencySymbol}${line.split("$")[1].trim()}`;
            } else if (line.includes("EC$")) {
              amt = `EC$${line.split("EC$")[1].trim()}`;
            }
            
            const wrappedLine = doc.splitTextToSize(line, 140);
            doc.text(wrappedLine, 18, currentY + 6);
            doc.text(amt, 175, currentY + 6, { align: "right" });
            currentY += Math.max(wrappedLine.length * 4.5 + 2, 7);
          });
        } else {
          doc.text(`${job.title} - Full Scope Service`, 18, currentY + 6);
          doc.text(`${currencySymbol}${job.amount?.toLocaleString() || "0"}`, 175, currentY + 6, { align: "right" });
          currentY += 8;
        }

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(15, currentY + 2, 195, currentY + 2);
        currentY += 8;

        // Total
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("TOTAL AMOUNT DUE", 100, currentY);
        
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.text(`${currencySymbol}${job.amount?.toLocaleString() || "0"}`, 175, currentY, { align: "right" });

        currentY += 15;
      } else {
        // Work Order details
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("Operations Checklist & Compliance:", 15, currentY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.text("- Deliver complete project scope according to description.", 18, currentY + 6);
        doc.text("- Check all code, design templates, and marketing parameters.", 18, currentY + 12);
        doc.text("- Internal test and quality review complete.", 18, currentY + 18);
        
        if (job.assignedTo) {
          doc.setFont("helvetica", "bold");
          doc.text(`Assigned Operator: ${job.assignedTo}`, 18, currentY + 26);
        }

        currentY += 36;
      }

      // Payment Terms / Footnote
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Terms & Conditions:", 15, currentY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      const termsText = docType === "estimate" 
        ? "This estimate is based on the current scope description and holds no binding contract until acceptance."
        : docType === "work_order"
        ? "All operational tasks must be handled in compliance with local workspace laws."
        : settings.paymentTerms || "Please make payment within 30 days of receiving this invoice.";
      const termsLines = doc.splitTextToSize(termsText, 180);
      doc.text(termsLines, 15, currentY + 5);

      // Download the file
      doc.save(`${docType}_${invoiceRef.toLowerCase()}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("An error occurred while generating the PDF. Please try again.");
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const note: JobNote = {
      id: crypto.randomUUID(),
      text: newNote,
      timestamp: new Date().toISOString(),
      user: "Current User",
    };
    onUpdate({ ...job, notes: [...(job.notes || []), note] });
    setNewNote("");
  };

  // Find full client details — Job stores the name in job.client (no clientId)
  const clientDetails = clients.find(
    (c) => (c.name ?? "").toLowerCase() === job.client.toLowerCase()
      || (c.company ?? "").toLowerCase() === job.client.toLowerCase()
  );

  const getDocTitle = () => {
    switch (docType) {
      case "estimate":
        return "Estimate & Proposal";
      case "work_order":
        return "Work Order";
      case "invoice":
        return "Commercial Invoice";
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-slate-900">{job.title}</h3>
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                job.priority === "high"
                  ? "bg-red-100 text-red-700"
                  : job.priority === "medium"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-slate-200 text-slate-700"
              }`}
            >
              {job.priority}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Client
              </p>
              <p className="font-semibold text-slate-900 truncate">
                {job.client}
              </p>
            </div>
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
                {job.amount ? `${settings.currency === "XCD" ? "EC$" : "$"}${job.amount.toLocaleString()}` : "TBD"}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Due Date
              </p>
              <p className="font-semibold text-slate-900">
                {job.dueDate
                  ? new Date(job.dueDate).toLocaleDateString()
                  : "Not set"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" /> Assigned To
              </h4>
              <select
                value={job.assignedTo || ""}
                onChange={(e) =>
                  onUpdate({ ...job, assignedTo: e.target.value })
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
                <Tag className="w-4 h-4 text-indigo-500" /> Tags (comma separated)
              </h4>
              <input
                type="text"
                value={job.tags?.join(", ") || ""}
                onChange={(e) =>
                  onUpdate({
                    ...job,
                    tags: e.target.value.split(",").map((t) => t.trim()),
                  })
                }
                placeholder="e.g. urgent, design, web"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
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

          {/* Document Generation Options - 100% Automated, non-AI */}
          <div className="border-t border-slate-100 pt-6">
            <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
              Automated Business Documents
            </h4>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <p className="text-xs text-slate-500">
                Generate secure, professional, compliant documents automatically based on active job status and parameters.
              </p>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDocType("estimate");
                    setShowDocPreview(true);
                  }}
                  className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-sm transition-all"
                >
                  <FileText className="w-5 h-5 text-amber-500 mb-1" />
                  <span className="text-[10px] font-bold text-slate-700 uppercase">Estimate</span>
                  <span className="text-[8px] text-slate-400 mt-0.5">Prop / Pricing</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDocType("work_order");
                    setShowDocPreview(true);
                  }}
                  className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-sm transition-all"
                >
                  <CheckSquare className="w-5 h-5 text-indigo-500 mb-1" />
                  <span className="text-[10px] font-bold text-slate-700 uppercase">Work Order</span>
                  <span className="text-[8px] text-slate-400 mt-0.5">Ops / Assignee</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDocType("invoice");
                    setShowDocPreview(true);
                  }}
                  className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-sm transition-all"
                >
                  <Printer className="w-5 h-5 text-emerald-500 mb-1" />
                  <span className="text-[10px] font-bold text-slate-700 uppercase">Invoice</span>
                  <span className="text-[8px] text-slate-400 mt-0.5">Billing / Receipt</span>
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-500" /> Job Notes
            </h4>
            <div className="space-y-4 mb-4">
              {job.notes?.map((note) => (
                <div key={note.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-sm text-slate-700 mb-1">{note.text}</p>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
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
                placeholder="Add a note..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                onClick={handleAddNote}
                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {job.activityLog && job.activityLog.length > 0 && (
            <div className="border-t border-slate-100 pt-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" /> Activity Log
              </h4>
              <div className="space-y-4">
                {job.activityLog
                  .slice()
                  .reverse()
                  .map((log) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm text-slate-700">{log.action}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                          {log.user} •{" "}
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {job.status === "invoiced" ||
          job.status === "completed" ||
          invoiceNotes ? (
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                Line Item Details
              </h4>
              <textarea
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                onBlur={handleSaveNotes}
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none text-sm text-slate-700"
                placeholder="Enter document line items (e.g., 1. Web Design - $500)..."
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Dynamic Document Preview Screen */}
      {showDocPreview && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl my-8 rounded-none shadow-2xl p-12 relative print:p-0 print:shadow-none print:my-0">
            <button
              onClick={() => setShowDocPreview(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 print:hidden"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Document Header */}
            <div className="flex justify-between items-start mb-12">
              <div>
                {settings.logoUrl && (
                  <img src={settings.logoUrl} alt="Logo" className="h-16 mb-4 object-contain" referrerPolicy="no-referrer" />
                )}
                <h2 className="text-2xl font-bold text-slate-900">{settings.name}</h2>
                <p className="text-sm text-slate-500 max-w-xs">{settings.address}</p>
                <p className="text-sm text-slate-500">{settings.email} | {settings.phone}</p>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-light text-slate-400 uppercase tracking-widest mb-4">
                  {getDocTitle()}
                </h1>
                <p className="text-sm font-bold text-slate-900">
                  REF #: {docType.toUpperCase().slice(0, 3)}-{job.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-sm text-slate-500">Date: {new Date().toLocaleDateString()}</p>
                {docType === "estimate" && (
                  <p className="text-xs text-amber-600 font-bold mt-1">Valid for 30 Days</p>
                )}
                {docType === "work_order" && job.dueDate && (
                  <p className="text-xs text-indigo-600 font-bold mt-1">Target: {new Date(job.dueDate).toLocaleDateString()}</p>
                )}
                {docType === "invoice" && job.status === "paid" && (
                  <div className="inline-block mt-2 px-3 py-1 border-2 border-emerald-500 text-emerald-500 rounded font-bold uppercase text-xs tracking-widest rotate-[-5deg]">
                    Fully Paid
                  </div>
                )}
              </div>
            </div>

            {/* Document Addresses */}
            <div className="grid grid-cols-2 gap-12 mb-12 border-t border-b border-slate-100 py-6">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {docType === "work_order" ? "Client / Location:" : "Bill To / Recipient:"}
                </h4>
                <p className="font-bold text-slate-900">{job.client}</p>
                {clientDetails ? (
                  <div className="text-sm text-slate-500 space-y-0.5 mt-1">
                    <p>{clientDetails.name}</p>
                    <p>{clientDetails.email}</p>
                    <p>{clientDetails.phone}</p>
                    <p className="max-w-xs">{clientDetails.address}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No additional client contact details registered.</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Scope of Project:</h4>
                <p className="font-bold text-slate-900">{job.title}</p>
                <p className="text-sm text-slate-500 mt-1 line-clamp-4">{job.description}</p>
                {docType === "work_order" && job.assignedTo && (
                  <div className="mt-3 bg-slate-50 p-2 rounded border border-slate-100 text-xs">
                    <span className="font-bold text-slate-600">Assigned Operator:</span> {job.assignedTo}
                  </div>
                )}
              </div>
            </div>

            {/* Document Details / Line Items */}
            {docType !== "work_order" ? (
              <table className="w-full mb-12">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="text-left py-3 text-xs font-bold uppercase tracking-widest">Description / Line Items</th>
                    <th className="text-right py-3 text-xs font-bold uppercase tracking-widest">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoiceNotes.split('\n').filter(line => line.trim()).map((line, i) => (
                    <tr key={i}>
                      <td className="py-4 text-sm text-slate-700">{line}</td>
                      <td className="py-4 text-right text-sm font-medium text-slate-900">
                        {line.includes('$') ? line.split('$')[1] : line.includes('EC$') ? line.split('EC$')[1] : '-'}
                      </td>
                    </tr>
                  ))}
                  {!invoiceNotes && (
                    <tr>
                      <td className="py-4 text-sm text-slate-700">{job.title} - Full Scope</td>
                      <td className="py-4 text-right text-sm font-medium text-slate-900">
                        {settings.currency === "XCD" ? "EC$" : "$"}{job.amount?.toLocaleString() || "0"}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900">
                    <td className="py-6 text-right font-bold text-slate-900 uppercase tracking-widest">Total Value</td>
                    <td className="py-6 text-right text-xl font-bold text-indigo-600">
                      {settings.currency === "XCD" ? "EC$" : "$"}{job.amount?.toLocaleString() || "0"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              // Work Order Operations Checklist
              <div className="mb-12 space-y-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                  Operations Checklist & Compliance
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase">
                      <CheckSquare className="w-4 h-4 text-indigo-500" /> Standard Deliverables
                    </div>
                    <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4">
                      <li>Deliver complete project scope according to description.</li>
                      <li>Check all code, design templates, and marketing parameters.</li>
                      <li>Internal test and quality review complete.</li>
                    </ul>
                  </div>
                  <div className="border border-slate-200 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase">
                      <Clock className="w-4 h-4 text-indigo-500" /> Completion Logs
                    </div>
                    <p className="text-xs text-slate-500">
                      Assigned employee must log active labor hours under payroll sheet. Review is required by management before invoice submission.
                    </p>
                  </div>
                </div>

                <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs">
                  <div>
                    <div className="border-b border-slate-300 h-8" />
                    <p className="mt-2 text-slate-400 font-bold uppercase">Customer Acceptance Signature</p>
                  </div>
                  <div>
                    <div className="border-b border-slate-300 h-8" />
                    <p className="mt-2 text-slate-400 font-bold uppercase">Operator Signature</p>
                  </div>
                </div>
              </div>
            )}

            {/* Document Footer */}
            <div className="border-t border-slate-100 pt-8">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Terms & Compliances:</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {docType === "estimate" 
                  ? "This estimate is based on the current scope description and holds no binding contract until acceptance."
                  : docType === "work_order"
                  ? "All operational tasks must be handled in compliance with local workspace laws."
                  : settings.paymentTerms}
                <br />
                Thank you for your ongoing partnership!
              </p>
            </div>

            <div className="mt-12 flex justify-center gap-4 print:hidden">
              <button
                onClick={() => window.print()}
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl"
              >
                <Printer className="w-5 h-5" />
                Print Document
              </button>
              <button
                onClick={handleDownloadPDF}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
