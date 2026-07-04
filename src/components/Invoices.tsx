import React, { useState } from "react";
import { Job, Employee, Client, BusinessSettings } from "../types";
import {
  FileText,
  Search,
  Filter,
  MoreVertical,
  CheckCircle2,
  Clock,
  DollarSign,
  Printer,
  Eye,
  Download,
} from "lucide-react";
import { JobDetailModal } from "./JobDetailModal";
import { jsPDF } from "jspdf";

export function Invoices({
  jobs,
  setJobs,
  employees,
  clients,
  settings,
}: {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  employees: Employee[];
  clients: Client[];
  settings: BusinessSettings;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Filter jobs that are either 'invoiced', 'completed', or 'paid'
  const invoiceableJobs = jobs.filter(
    (job) =>
      (job.status === "invoiced" || job.status === "completed" || job.status === "paid") &&
      (job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.client.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleMarkAsPaid = (jobId: string) => {
    setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'paid' } : j));
  };

  const totalPaid = jobs
    .filter((j) => j.status === "paid")
    .reduce((sum, j) => sum + (j.amount || 0), 0);

  const totalPending = jobs
    .filter((j) => j.status === "invoiced" || j.status === "completed")
    .reduce((sum, j) => sum + (j.amount || 0), 0);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  const handleDownloadPDF = (job: Job) => {
    try {
      const doc = new jsPDF();
      const client = clients.find(
        (c) => c.id === job.clientId || c.company.toLowerCase() === job.client.toLowerCase()
      );

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
      doc.text("INVOICE SUMMARY", 15, 25);

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
      doc.text("INVOICE DETAILS", 15, 55);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      
      const invoiceRef = `INV-${job.id.slice(0, 8).toUpperCase()}`;
      doc.text(`Reference No: ${invoiceRef}`, 15, 62);
      doc.text(`Created Date: ${new Date(job.createdAt).toLocaleDateString()}`, 15, 68);
      const dueDateText = job.dueDate ? new Date(job.dueDate).toLocaleDateString() : "Upon receipt";
      doc.text(`Due Date: ${dueDateText}`, 15, 74);
      doc.text(`Status: ${job.status.toUpperCase()}`, 15, 80);

      // Client Info Card (right side)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("BILL TO", 120, 55);

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

      // Line Items Table Header
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(15, currentY, 180, 8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Description", 18, currentY + 5.5);
      doc.text("Amount", 175, currentY + 5.5, { align: "right" });

      currentY += 8;

      // Render line items or fallback to Job Title
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

      const currencySymbol = settings.currency === "XCD" ? "EC$" : "$";

      if (job.invoiceNotes) {
        const lines = job.invoiceNotes.split("\n").filter(line => line.trim());
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

      // Payment Terms / Footnote
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Terms & Conditions:", 15, currentY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      const termsText = settings.paymentTerms || "Please make payment within 30 days of receiving this invoice.";
      const termsLines = doc.splitTextToSize(termsText, 180);
      doc.text(termsLines, 15, currentY + 5);

      // Download the file
      doc.save(`invoice_${invoiceRef.toLowerCase()}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("An error occurred while generating the PDF. Please try again.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Invoices</h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage billing and view invoices for completed projects.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Paid</p>
            <p className="text-2xl font-bold text-slate-900">${totalPaid.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Pending</p>
            <p className="text-2xl font-bold text-slate-900">${totalPending.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by job title or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Job / Client
              </th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Amount
              </th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Date
              </th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoiceableJobs.map((job) => (
              <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-semibold text-slate-900">{job.title}</p>
                    <p className="text-xs text-slate-500">{job.client}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-semibold text-slate-900">
                    ${job.amount?.toLocaleString() || "0"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                      job.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : job.status === "paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {new Date(job.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {job.status !== "paid" && (
                      <button
                        onClick={() => handleMarkAsPaid(job.id)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark as Paid
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedJobId(job.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                    >
                      <Eye className="w-4 h-4" />
                      View & Invoice
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(job)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                      title="Download Invoice PDF"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {invoiceableJobs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-12 h-12 opacity-20" />
                    <p>No completed or invoiced jobs found.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          employees={employees}
          clients={clients}
          settings={settings}
          onClose={() => setSelectedJobId(null)}
          onUpdate={(updatedJob) => {
            setJobs(jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
          }}
        />
      )}
    </div>
  );
}
