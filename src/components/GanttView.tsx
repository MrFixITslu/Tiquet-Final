import React from "react";
import { Job } from "../types";
import { Calendar, Clock } from "lucide-react";

interface GanttViewProps {
  jobs: Job[];
  onJobClick: (id: string) => void;
}

/**
 * GanttView — Timeline / Gantt-style view of jobs.
 * Renders jobs ordered by due date with a visual bar proportional to their age.
 */
export function GanttView({ jobs, onJobClick }: GanttViewProps) {
  const sortedJobs = [...jobs]
    .filter((j) => j.dueDate || j.createdAt)
    .sort((a, b) => {
      const aDate = a.dueDate || a.createdAt;
      const bDate = b.dueDate || b.createdAt;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

  if (sortedJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Calendar className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No jobs with dates to display in timeline view.</p>
      </div>
    );
  }

  const now = Date.now();
  const earliest = Math.min(...sortedJobs.map((j) => new Date(j.createdAt).getTime()));
  const latest = Math.max(
    ...sortedJobs.map((j) =>
      new Date(j.dueDate || j.createdAt).getTime() + 86_400_000 * 3
    )
  );
  const range = latest - earliest || 1;

  const STATUS_COLOURS: Record<string, string> = {
    request: "bg-blue-400",
    estimation: "bg-yellow-400",
    "in-progress": "bg-purple-400",
    review: "bg-orange-400",
    invoiced: "bg-indigo-400",
    completed: "bg-green-400",
    paid: "bg-emerald-400",
  };

  return (
    <div className="overflow-x-auto p-4">
      <div className="min-w-[600px]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4 px-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Timeline View
          </span>
        </div>

        <div className="space-y-2">
          {sortedJobs.map((job) => {
            const start = new Date(job.createdAt).getTime();
            const end = new Date(job.dueDate || job.createdAt).getTime();
            const leftPct = ((start - earliest) / range) * 100;
            const widthPct = Math.max(((end - start) / range) * 100, 1.5);
            const isOverdue = job.dueDate && new Date(job.dueDate).getTime() < now && job.status !== "completed" && job.status !== "paid";
            const barColour = STATUS_COLOURS[job.status] || "bg-slate-400";

            return (
              <div
                key={job.id}
                className="flex items-center gap-3 group cursor-pointer"
                onClick={() => onJobClick(job.id)}
              >
                {/* Label */}
                <div className="w-40 shrink-0 text-right">
                  <p className="text-xs font-medium text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
                    {job.title}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{job.client}</p>
                </div>

                {/* Bar track */}
                <div className="flex-1 relative h-7 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-1 bottom-1 rounded-full ${barColour} ${isOverdue ? "opacity-60 ring-2 ring-red-400 ring-offset-1" : ""} transition-all group-hover:brightness-110`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                  />
                  {/* "Today" marker */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-400/70"
                    style={{ left: `${((now - earliest) / range) * 100}%` }}
                  />
                </div>

                {/* Due date */}
                <div className="w-20 shrink-0">
                  {job.dueDate ? (
                    <span
                      className={`text-[10px] font-mono ${isOverdue ? "text-red-500 font-semibold" : "text-slate-400"}`}
                    >
                      {new Date(job.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300">No due date</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
