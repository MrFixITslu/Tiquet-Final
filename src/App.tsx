import React, { useState, useEffect } from "react";
import { Search, Bell, LogOut } from "lucide-react";
import { JobBoard } from "./components/JobBoard";
import { Sidebar } from "./components/Sidebar";
import { JobDetailView } from "./components/JobDetailView";
import { JobRequestForm } from "./components/JobRequestForm";
import { Dashboard } from "./components/Dashboard";

const Payroll = React.lazy(() => import("./components/Payroll").then(m => ({ default: m.Payroll })));
const UserManagement = React.lazy(() => import("./components/UserManagement").then(m => ({ default: m.UserManagement })));
const FileRepository = React.lazy(() => import("./components/FileRepository").then(m => ({ default: m.FileRepository })));
const Invoices = React.lazy(() => import("./components/Invoices").then(m => ({ default: m.Invoices })));

import { Settings, BusinessSettings } from "./components/Settings";
import { ClientPortal } from "./components/ClientPortal";
import { Clients } from "./components/Clients";
import { MyProfile } from "./components/MyProfile";
import { NotificationDropdown, Notification } from "./components/NotificationDropdown";
import { AccountSuspended } from "./components/AccountSuspended";
import { SuperAdminLogin } from "./components/SuperAdminLogin";
import { SuperAdminPortal } from "./components/SuperAdminPortal";
import { SubscriptionPlans } from "./components/SubscriptionPlans";
import { Help } from "./components/Help";
import { Job, Employee, PayrollRecord, AppUser, FileItem } from "./types";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import { apiFetch } from "./lib/api";

function MainApp() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [activeTab, setActiveTab] = useState("dashboard");

  const handleSetTab = (tab: string) => {
    setActiveTab(tab);
  };
  const [jobs, setJobs] = useState<Job[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [jobsRes, employeesRes, settingsRes] = await Promise.all([
        apiFetch("/api/jobs").then(res => {
          if (res.status === 402) { setIsSuspended(true); throw new Error("suspended"); }
          if (!res.ok) throw new Error("Failed to fetch jobs");
          return res.json();
        }),
        apiFetch("/api/employees").then(res => {
          if (!res.ok) throw new Error("Failed to fetch employees");
          return res.json();
        }),
        apiFetch("/api/settings").then(res => {
          if (!res.ok) throw new Error("Failed to fetch settings");
          return res.json();
        })
      ]);

      setJobs(jobsRes);
      setEmployees(employeesRes);
      setSettings(settingsRes);
    } catch (err: any) {
      if (err.message === "suspended") return;
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load application data. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const markNotificationRead = async (id?: string) => {
    try {
      const res = await apiFetch("/api/notifications/read", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        if (id) {
          setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: 1 } : n));
        } else {
          setNotifications(notifications.map(n => ({ ...n, isRead: 1 })));
        }
      }
    } catch (err) {
      console.error("Error marking notification read:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000); // Poll every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  // Clear selected job when switching tabs
  useEffect(() => {
    setSelectedJobId(null);
  }, [activeTab]);

  if (authLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 text-slate-400 gap-4">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="font-medium">Loading Auvic Solutions...</p>
      </div>
    );
  }

  if (!user) {
    return showSignup ? <Signup onSwitchToLogin={() => setShowSignup(false)} /> : <Login onSwitchToSignup={() => setShowSignup(true)} />;
  }

  if (isSuspended) {
    return <AccountSuspended onLogout={logout} />;
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
        <div className="bg-red-100 text-red-600 rounded-full p-4 mb-4">
          <Search className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-slate-500 mb-6 max-w-md">{error}</p>
        <button
          onClick={() => fetchData()}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading || !settings) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 text-slate-400 gap-4">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="font-medium">Loading Auvic Solutions...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={handleSetTab} onUpgradeClick={() => setShowUpgrade(true)} />

      {showUpgrade && <SubscriptionPlans onClose={() => setShowUpgrade(false)} />}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2 w-96">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search jobs, clients... or settings"
              className="bg-transparent border-none outline-none ml-2 text-sm w-full"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                type="button" 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-lg transition-colors relative ${showNotifications ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="View notifications" 
                aria-label="View notifications"
              >
                <Bell className="w-6 h-6" />
                {notifications.some(n => !n.isRead) && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              
              {showNotifications && (
                <NotificationDropdown 
                  notifications={notifications} 
                  onMarkRead={markNotificationRead}
                  onClose={() => setShowNotifications(false)}
                />
              )}
            </div>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-2">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-sm font-bold text-slate-900">{user.name}</span>
                <span className="text-xs text-slate-500">{user.role}</span>
              </div>
              <button 
                onClick={() => setActiveTab("profile")}
                className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-semibold text-sm hover:ring-2 hover:ring-indigo-500 hover:ring-offset-2 transition-all"
                title="My Profile"
              >
                {user.name.charAt(0)}
              </button>
              <button onClick={logout} title="Log out" className="ml-2 text-slate-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50">
                <LogOut className="w-5 h-5"/>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedJobId ? (
            <div className="flex-1 overflow-auto bg-white">
              <JobDetailView
                job={jobs.find(j => j.id === selectedJobId)!}
                employees={employees}
                settings={settings}
                onBack={() => setSelectedJobId(null)}
                onUpdate={(updatedJob) => {
                  setJobs(jobs.map(j => j.id === updatedJob.id ? updatedJob : j));
                }}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-8">
              <React.Suspense fallback={
                <div className="flex h-full items-center justify-center text-slate-400 gap-2 animate-pulse">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                </div>
              }>
                {activeTab === "dashboard" && <Dashboard jobs={jobs} />}
                {activeTab === "jobs" && (
                  <JobBoard
                    jobs={jobs}
                    setJobs={setJobs}
                    employees={employees}
                    settings={settings}
                    onSelectJob={setSelectedJobId}
                  />
                )}
                {activeTab === "payroll" && (
                  <Payroll
                    employees={employees}
                    setEmployees={setEmployees}
                    payrollRecords={payrollRecords}
                    setPayrollRecords={setPayrollRecords}
                  />
                )}
                {activeTab === "users" && (
                  <UserManagement users={users} setUsers={setUsers} />
                )}
                {activeTab === "files" && (
                  <FileRepository files={files} setFiles={setFiles} />
                )}
                {activeTab === "invoices" && (
                  <Invoices
                    jobs={jobs}
                    setJobs={setJobs}
                    employees={employees}
                    settings={settings}
                    onSelectJob={setSelectedJobId}
                  />
                )}
                {activeTab === "settings" && (
                  <Settings settings={settings} setSettings={setSettings} />
                )}
                {activeTab === "clients" && <Clients />}
                {activeTab === "new-request" && (
                  <div className="max-w-4xl mx-auto">
                    <JobRequestForm
                      employees={employees}
                      onSave={async (jobData) => {
                        try {
                          const newId = crypto.randomUUID();
                          const response = await apiFetch('/api/jobs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              ...jobData,
                              id: newId,
                              createdAt: new Date().toISOString()
                            })
                          });
                          if (response.ok) {
                            const newJob = await response.json();
                            setJobs([newJob, ...jobs]);
                            setActiveTab("jobs");
                          }
                        } catch (error) {
                          console.error("Error creating job:", error);
                        }
                      }}
                    />
                  </div>
                )}
                {activeTab === "profile" && <MyProfile />}
                {activeTab === "help" && <Help />}
              </React.Suspense>
              
              {!["dashboard", "jobs", "payroll", "users", "files", "invoices", "settings", "clients", "new-request", "profile", "help"].includes(activeTab) && (
                <div className="flex items-center justify-center h-full text-slate-400">
                  {activeTab} content coming soon
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get("token");
  const isSuperAdmin = params.get("superadmin") === "true";
  
  // Also check pathname for /portal/TOKEN format
  const pathParts = window.location.pathname.split('/portal/');
  const pathToken = pathParts.length > 1 ? pathParts[1] : null;

  const token = queryToken || pathToken;

  if (token) {
    return <ClientPortal token={token} />;
  }

  // Super Admin Portal
  if (isSuperAdmin) {
    return <SuperAdminApp />;
  }

  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

// ─── Super Admin App Shell ─────────────────────────────────────────────────
function SuperAdminApp() {
  const [saToken, setSaToken] = React.useState<string | null>(null);
  const [saAdmin, setSaAdmin] = React.useState<{ id: string; email: string } | null>(null);

  const handleSALogin = (token: string, admin: { id: string; email: string }) => {
    setSaToken(token);
    setSaAdmin(admin);
  };

  const handleSALogout = () => {
    setSaToken(null);
    setSaAdmin(null);
  };

  if (!saToken || !saAdmin) {
    return <SuperAdminLogin onLogin={handleSALogin} />;
  }

  return <SuperAdminPortal admin={saAdmin} onLogout={handleSALogout} />;
}

