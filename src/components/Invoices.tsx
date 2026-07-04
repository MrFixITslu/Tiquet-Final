import React, { useState } from "react";
import { Job, Employee } from "../types";
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
} from "lucide-react";
import { JobDetailView } from "./JobDetailView";
import { BusinessSettings } from "./Settings";

export function Invoices({
  jobs,
  setJobs,
  employees,
  settings,
  onSelectJob,
}: {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  employees: Employee[];
  settings: BusinessSettings;
  onSelectJob: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

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
                    className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
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
                      onClick={() => onSelectJob(job.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                    >
                      <Eye className="w-4 h-4" />
                      View & Invoice
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
    </div>
  );
}
