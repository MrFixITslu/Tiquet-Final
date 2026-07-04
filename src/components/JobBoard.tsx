import React, { useState } from "react";
import { apiFetch } from '../lib/api';
import { Job, JobStatus, ActivityLogEntry, COLUMNS, Employee } from "../types";
import { Plus, MoreHorizontal, Clock, DollarSign, ArrowRight, ArrowLeft } from "lucide-react";
import { JobModal } from "./JobModal";
import { GanttView } from "./GanttView";
import { BusinessSettings } from "./Settings";

export function JobBoard({
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
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "timeline">("kanban");
  const [jobsMoving, setJobsMoving] = useState<Set<string>>(new Set());


  const moveJob = async (jobId: string, newStatus: JobStatus) => {
    if (jobsMoving.has(jobId)) return;

    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    if (job.status === "estimation" && newStatus === "in-progress" && !job.quoteApproved) {
      alert("Quote must be approved by the client before moving to In-Progress.");
      return;
    }

    setJobsMoving(prev => new Set(prev).add(jobId));


    const newLog: ActivityLogEntry = {
      id: crypto.randomUUID(),
      action: `Moved from ${job.status} to ${newStatus}`,
      timestamp: new Date().toISOString(),
      user: "System Workflow",
    };

    let additionalUpdates: Partial<Job> = {};

    // Smart Workflow: Auto-generate invoice template when moved to Invoiced
    if (newStatus === "invoiced" && !job.invoiceNotes) {
      const timeLoggedHours = job.timeLogs?.reduce((total, log) => {
        if (!log.endTime) return total;
        const start = new Date(log.startTime).getTime();
        const end = new Date(log.endTime).getTime();
        return total + (end - start) / (1000 * 60 * 60);
      }, 0) || 0;

      let description = `1. Project Delivery: ${job.title} - $${job.amount || 0}\n`;
      if (timeLoggedHours > 0) {
        description += `2. Hourly Labor: ${timeLoggedHours.toFixed(1)} hrs\n`;
      }
      additionalUpdates.invoiceNotes = description;

      newLog.action = `Moved to Invoiced + Auto-drafted invoice`;
    }

    // Smart Workflow: Auto-generate estimate when moved to Estimation
    if (newStatus === "estimation" && !job.amount) {
      additionalUpdates.amount = 500; // Default estimate
      newLog.action = `Moved to Estimation + Generated $500 baseline estimate`;
    }

    const updatedJob = {
      ...job,
      ...additionalUpdates,
      status: newStatus,
      activityLog: [newLog], // We only send the new log to the backend, it appends it.
    };

    try {
      const response = await apiFetch(`/api/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedJob)
      });

      if (!response.ok) throw new Error("Failed to update job status");

      // Update UI with FULL server response (includes timer rotation, logs, etc)
      const serverJob = await response.json();
      setJobs(jobs.map(j => j.id === jobId ? serverJob : j));
    } catch (error) {
      console.error("Failed to move job:", error);
      alert("Failed to update status. The server might be busy. Please try again.");
    } finally {
      setJobsMoving(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleSaveNewJob = async (jobData: Omit<Job, "id" | "createdAt">) => {
    const newJob: Job = {
      ...jobData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await apiFetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newJob)
      });

      if (!response.ok) throw new Error("Failed to save job");

      const savedJob = await response.json();
      setJobs([savedJob, ...jobs]);
      setIsNewModalOpen(false); // Close modal on success
    } catch (error) {
      console.error("Failed to create job:", error);
      alert("Failed to create job. Please try again.");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Job Pipeline</h2>
          <p className="text-slate-500 text-sm mt-1">
            Track and manage jobs from request to completion.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-200 p-1 rounded-lg flex items-center text-sm font-medium">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 rounded-md transition-all ${viewMode === "kanban" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1.5 rounded-md transition-all ${viewMode === "timeline" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
            >
              Timeline
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Job
          </button>
        </div>
      </div>

      {viewMode === "kanban" ? (
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
                <button className="text-slate-400 hover:text-slate-600" title="More options">
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
                      isMoving={jobsMoving.has(job.id)}
                      moveJob={moveJob}
                      onClick={() => onSelectJob(job.id)}
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
      ) : (
        <div className="flex-1 overflow-hidden">
          <GanttView jobs={jobs} onJobClick={(id) => onSelectJob(id)} />
        </div>
      )
      }

      <JobModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSave={(jobData) => {
          handleSaveNewJob(jobData);
        }}
        employees={employees}
      />
    </div >
  );
}

const JobCard: React.FC<{
  job: Job;
  isMoving?: boolean;
  moveJob: (id: string, status: JobStatus) => void;
  onClick: () => void;
}> = ({ job, isMoving, moveJob, onClick }) => {
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
          className={`text-xs uppercase font-bold tracking-wider px-2 py-1 rounded-md ${job.priority === "high"
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
              className="text-xs font-bold uppercase tracking-widest px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {job.dueDate && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 mb-4 bg-orange-50 px-2 py-1 rounded-md w-fit">
          <Clock className="w-3 h-3" />
          Due: {new Date(job.dueDate).toLocaleDateString()}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-slate-400">
          {job.amount != null && (
            <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
              <DollarSign className="w-3.5 h-3.5" />
              {Number(job.amount).toLocaleString()}
            </div>
          )}
          {job.assignedTo && (
            <div
              className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold"
              title={`Assigned to ${job.assignedTo}`}
            >
              {job.assignedTo.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {prevStatus && (
            <button
              type="button"
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
              type="button"
              disabled={isMoving}
              onClick={(e) => {
                e.stopPropagation();
                moveJob(job.id, nextStatus);
              }}
              className={`opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-md flex items-center gap-1 text-xs font-medium disabled:opacity-50`}
              title={`Move to ${COLUMNS.find((c) => c.id === nextStatus)?.label}`}
            >
              {isMoving ? (
                <div className="w-3 h-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
              ) : (
                <>
                  Advance <ArrowRight className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
