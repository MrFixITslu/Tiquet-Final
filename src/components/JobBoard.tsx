import React, { useState } from "react";
import { Job, JobStatus, ActivityLogEntry, COLUMNS, Employee, Client, BusinessSettings } from "../types";
import { Plus, MoreHorizontal, Clock, DollarSign, ArrowRight, ArrowLeft } from "lucide-react";
import { JobModal } from "./JobModal";
import { JobDetailModal } from "./JobDetailModal";

export function JobBoard({
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
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const moveJob = (jobId: string, newStatus: JobStatus) => {
    setJobs(
      jobs.map((job) => {
        if (job.id === jobId) {
          const newLog: ActivityLogEntry = {
            id: crypto.randomUUID(),
            action: `Moved from ${job.status} to ${newStatus}`,
            timestamp: new Date().toISOString(),
            user: "Current User", // In a real app, this would be the logged-in user
          };
          return {
            ...job,
            status: newStatus,
            activityLog: [...(job.activityLog || []), newLog],
          };
        }
        return job;
      }),
    );
  };

  const handleSaveNewJob = (jobData: Omit<Job, "id" | "createdAt">) => {
    const newJob: Job = {
      ...jobData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setJobs([...jobs, newJob]);
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Job Pipeline</h2>
          <p className="text-slate-500 text-sm mt-1">
            Track and manage jobs from request to completion.
          </p>
        </div>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex-shrink-0 w-80 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-700">{col.label}</h3>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.color}`}
                >
                  {jobs.filter((j) => j.status === col.id).length}
                </span>
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-slate-100/50 rounded-xl p-3 flex flex-col gap-3 overflow-y-auto border border-slate-200/50">
              {jobs
                .filter((j) => j.status === col.id)
                .map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    moveJob={moveJob}
                    onClick={() => setSelectedJobId(job.id)}
                  />
                ))}
              {jobs.filter((j) => j.status === col.id).length === 0 && (
                <div className="h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                  No jobs here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <JobModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSave={handleSaveNewJob}
        employees={employees}
        clients={clients}
      />

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

const JobCard: React.FC<{
  job: Job;
  moveJob: (id: string, status: JobStatus) => void;
  onClick: () => void;
}> = ({ job, moveJob, onClick }) => {
  const currentIndex = COLUMNS.findIndex((c) => c.id === job.status);
  const prevStatus = currentIndex > 0 ? COLUMNS[currentIndex - 1].id : null;
  const nextStatus =
    currentIndex < COLUMNS.length - 1 ? COLUMNS[currentIndex + 1].id : null;

  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 group hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex justify-between items-start mb-2">
        <span
          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${
            job.priority === "high"
              ? "bg-red-50 text-red-600"
              : job.priority === "medium"
                ? "bg-yellow-50 text-yellow-600"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {job.priority}
        </span>
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(job.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      <h4 className="font-semibold text-slate-900 mb-1 leading-tight">
        {job.title}
      </h4>
      <p className="text-sm text-slate-500 mb-2 line-clamp-2">{job.client}</p>

      {job.tags && job.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {job.tags.map((tag) => (
            <span
              key={tag}
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {job.dueDate && (
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-orange-600 mb-4 bg-orange-50 px-2 py-1 rounded-md w-fit">
          <Clock className="w-3 h-3" />
          Due: {new Date(job.dueDate).toLocaleDateString()}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-slate-400">
          {job.amount !== undefined && (
            <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
              <DollarSign className="w-3.5 h-3.5" />
              {job.amount.toLocaleString()}
            </div>
          )}
          {job.assignedTo && (
            <div
              className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold"
              title={`Assigned to ${job.assignedTo}`}
            >
              {job.assignedTo.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {prevStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                moveJob(job.id, prevStatus);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 text-slate-600 hover:bg-slate-100 p-1.5 rounded-md flex items-center gap-1 text-xs font-medium"
              title={`Move back to ${COLUMNS.find((c) => c.id === prevStatus)?.label}`}
            >
              <ArrowLeft className="w-3 h-3" />
            </button>
          )}

          {nextStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                moveJob(job.id, nextStatus);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-md flex items-center gap-1 text-xs font-medium"
              title={`Move to ${COLUMNS.find((c) => c.id === nextStatus)?.label}`}
            >
              Advance <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
