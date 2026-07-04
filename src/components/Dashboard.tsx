import React from "react";
import { Job, COLUMNS } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Briefcase, CheckCircle2, Clock, AlertCircle, History, PieChart as PieIcon } from "lucide-react";
import { D3PieChartWidget } from "./D3PieChartWidget";

export function Dashboard({ jobs }: { jobs: Job[] }) {
  const statusData = [
    { name: "Request", value: jobs.filter((j) => j.status === "request").length, color: "#3b82f6" },
    { name: "Estimation", value: jobs.filter((j) => j.status === "estimation").length, color: "#eab308" },
    { name: "In Progress", value: jobs.filter((j) => j.status === "in-progress").length, color: "#a855f7" },
    { name: "Review", value: jobs.filter((j) => j.status === "review").length, color: "#f97316" },
    { name: "Invoiced", value: jobs.filter((j) => j.status === "invoiced").length, color: "#6366f1" },
    { name: "Completed", value: jobs.filter((j) => j.status === "completed").length, color: "#22c55e" },
  ];

  const priorityData = [
    { name: "High", count: jobs.filter((j) => j.priority === "high").length },
    { name: "Medium", count: jobs.filter((j) => j.priority === "medium").length },
    { name: "Low", count: jobs.filter((j) => j.priority === "low").length },
  ];

  const recentActivity = jobs
    .flatMap((j) => (j.activityLog || []).map((l) => ({ ...l, jobTitle: j.title })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">System Overview</h2>
        <p className="text-slate-500 text-sm mt-1">Premium analytics and performance metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          icon={<Briefcase className="w-5 h-5 text-blue-600" />}
          label="Total Jobs"
          value={jobs.length}
          color="bg-blue-50"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-purple-600" />}
          label="In Progress"
          value={jobs.filter((j) => j.status === "in-progress").length}
          color="bg-purple-50"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          label="Completed"
          value={jobs.filter((j) => j.status === "completed").length}
          color="bg-green-50"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          label="High Priority"
          value={jobs.filter((j) => j.priority === "high").length}
          color="bg-red-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-indigo-500" />
              Stage Distribution (D3 Interactive)
            </h3>
            <p className="text-slate-400 text-xs mt-1">Hover slices to inspect active stage telemetry.</p>
          </div>
          <div className="mt-4 flex-1 flex flex-col justify-center">
            <D3PieChartWidget jobs={jobs} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Priority Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" />
          Recent System Activity
        </h3>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {activity.action} <span className="text-slate-400 font-normal">on</span> {activity.jobTitle}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activity.user} • {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <div className="text-center py-8 text-slate-400">No recent activity recorded.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
