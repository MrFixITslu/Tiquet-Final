import React from "react";
import { Job, Employee, Client } from "../types";
import { X } from "lucide-react";
import { JobRequestForm } from "./JobRequestForm";

export function JobModal({
  isOpen,
  onClose,
  onSave,
  employees,
  clients: _clients,  // reserved for future use
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: Omit<Job, "id" | "createdAt">) => void;
  employees: Employee[];
  clients?: Client[];
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            New Job Request
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto">
          <JobRequestForm 
            employees={employees}
            onSave={(job) => {
              onSave(job);
              onClose();
            }} 
            className="border-none shadow-none rounded-none"
          />
        </div>
      </div>
    </div>
  );
}
