import React from "react";
import { Job, COLUMNS } from "../types";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Briefcase, CheckCircle2, Clock, AlertCircle, History, Timer, TrendingUp } from "lucide-react";

export function Dashboard({ jobs }: { jobs: Job[] }) {
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setHasMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

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

  const totalTimeLogged = jobs.reduce((total, job) => {
    if (!job.timeLogs) return total;
    return total + job.timeLogs.reduce((jobTotal, log) => {
      if (!log.endTime) return jobTotal;
      const start = new Date(log.startTime).getTime();
      const end = new Date(log.endTime).getTime();
      return jobTotal + (end - start) / (1000 * 60 * 60);
    }, 0);
  }, 0);

  const estimatedRevenue = jobs
    .filter(j => j.status === 'completed' || j.status === 'invoiced' || j.status === 'paid')
    .reduce((total, job) => total + (job.amount || 0), 0);

  const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'paid');
  const avgCompletionTime = completedJobs.length > 0
    ? completedJobs.reduce((sum, job) => {
        const jobTime = job.timeLogs?.reduce((t, l) => {
          if (!l.endTime) return t;
          return t + (new Date(l.endTime).getTime() - new Date(l.startTime).getTime()) / (1000 * 60 * 60);
        }, 0) || 0;
        return sum + jobTime;
      }, 0) / completedJobs.length
    : 0;

  const stagePerformanceData = (['estimation', 'in-progress', 'review', 'invoiced', 'completed'] as const).map(status => {
    const jobsWithTimeInStage = jobs.filter(j => j.timeLogs?.some(l => l.status === status));
    const totalHoursInStage = jobs.reduce((sum, job) => {
      const stageTime = job.timeLogs?.filter(l => l.status === status).reduce((t, l) => {
        if (!l.endTime) return t;
        return t + (new Date(l.endTime).getTime() - new Date(l.startTime).getTime()) / (1000 * 60 * 60);
      }, 0) || 0;
      return sum + stageTime;
    }, 0);
    
    return {
      name: status.replace('-', ' '),
      avgHours: jobsWithTimeInStage.length > 0 ? Number((totalHoursInStage / jobsWithTimeInStage.length).toFixed(1)) : 0
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">System Overview</h2>
        <p className="text-slate-500 text-sm mt-1">Premium analytics and performance metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <div className="col-span-1 md:col-span-2">
          <StatCard
            icon={<Briefcase className="w-5 h-5 text-blue-600" />}
            label="Total Jobs"
            value={jobs.length}
            color="bg-blue-50"
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <StatCard
            icon={<Timer className="w-5 h-5 text-indigo-600" />}
            label="Total Hours Logged"
            value={Number(totalTimeLogged.toFixed(1))}
            color="bg-indigo-50"
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
            label="Est. Revenue"
            value={`$${estimatedRevenue.toLocaleString()}`}
            color="bg-emerald-50"
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            label="Avg. Completion"
            value={`${avgCompletionTime.toFixed(1)} hrs`}
            color="bg-emerald-50"
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <StatCard
            icon={<Clock className="w-5 h-5 text-purple-600" />}
            label="In Progress"
            value={jobs.filter((j) => j.status === "in-progress").length}
            color="bg-purple-50"
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
            label="Completed"
            value={jobs.filter((j) => j.status === "completed").length}
            color="bg-green-50"
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <StatCard
            icon={<AlertCircle className="w-5 h-5 text-red-600" />}
            label="High Priority"
            value={jobs.filter((j) => j.priority === "high").length}
            color="bg-red-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Jobs by Status</h3>
          <div className="h-80 min-h-[320px] relative w-full">
            {hasMounted && (
              <ResponsiveContainer key="status-chart" width="100%" height={320} id="status-chart-container" debounce={50}>
                <PieChart id="status-pie-chart">
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Priority Distribution</h3>
          <div className="h-80 min-h-[320px] relative w-full">
            {hasMounted && (
              <ResponsiveContainer key="priority-chart" width="100%" height={320} id="priority-chart-container" debounce={50}>
                <BarChart data={priorityData} id="priority-bar-chart">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Timer className="w-5 h-5 text-indigo-500" /> Avg. Performance by Stage
          </h3>
          <div className="h-80 min-h-[320px] relative w-full">
            {hasMounted && (
              <ResponsiveContainer width="100%" height={320} debounce={50}>
                <BarChart data={stagePerformanceData} layout="vertical" margin={{ left: 30, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    width={90}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="avgHours" 
                    fill="#6366f1" 
                    radius={[0, 4, 4, 0]} 
                    barSize={24}
                    label={{ position: 'right', fill: '#6366f1', fontSize: 11, fontWeight: 700, offset: 8 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" /> Recent System Activity
          </h3>
          <div className="space-y-4 flex-1 overflow-y-auto max-h-[320px] pr-2">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 leading-tight">
                    {activity.action} <span className="text-slate-400 font-normal">on</span> <span className="truncate inline-block max-w-[150px] align-bottom">{activity.jobTitle}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">
                    {activity.user} • {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="text-center py-8 text-slate-400 italic text-sm">No recent activity recorded.</div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
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
