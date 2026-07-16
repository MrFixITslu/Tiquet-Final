import React, { useState, useEffect } from "react";
import { Search, Bell, Shield, LogOut, CheckSquare, RefreshCw, Zap, ChevronDown, UserPlus, Clock, X, Sun, Moon, Menu } from "lucide-react";
import { JobBoard } from "./components/JobBoard";
import { Sidebar } from "./components/Sidebar";
import { JobRequestForm } from "./components/JobRequestForm";
import { Dashboard } from "./components/Dashboard";
import { Payroll } from "./components/Payroll";
import { UserManagement } from "./components/UserManagement";
import { FileRepository } from "./components/FileRepository";
import { Invoices } from "./components/Invoices";
import { Clients } from "./components/Clients";
import { Settings } from "./components/Settings";
import { AuthGate } from "./components/AuthGate";
import { ClientPortal } from "./components/ClientPortal";
import { Job, Employee, PayrollRecord, AppUser, FileItem, Client, BusinessSettings, AuthenticatedUser, Business } from "./types";
import { generateUUID } from "./utils";
import { apiFetch } from "./lib/api";

// SECURE MULTI-TENANT WORKSPACE ROOT


export default function App() {
  // Client portal link: /portal/{secureToken} or ?token={secureToken}. Renders standalone,
  // completely bypassing login — the token itself is the credential, validated server-side.
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get("token");
  const pathParts = window.location.pathname.split("/portal/");
  const pathToken = pathParts.length > 1 ? pathParts[1] : null;
  const portalToken = queryToken || pathToken;

  if (portalToken) {
    return <ClientPortal token={portalToken} />;
  }

  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  // While we check for an existing JWT and try to restore the session, show nothing
  // rather than flashing the login screen first.
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // On mount, try to restore a session from a previously-stored JWT (real backend auth,
  // replacing the old localStorage user/business bootstrapping).
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsRestoringSession(false);
        return;
      }

      try {
        const meRes = await apiFetch("/api/auth/me");
        if (!meRes.ok) {
          localStorage.removeItem("token");
          setIsRestoringSession(false);
          return;
        }
        const me = await meRes.json();

        let settings: BusinessSettings = {
          name: "My Business", address: "", email: me.email || "", phone: "",
          logoUrl: "", paymentTerms: "Due within 30 days.", currency: "USD", taxRate: 0,
        };
        try {
          const settingsRes = await apiFetch("/api/settings");
          if (settingsRes.ok) {
            const s = await settingsRes.json();
            if (s && s.name) settings = s;
          }
        } catch { /* use defaults above */ }

        setCurrentUser({
          id: me.id,
          name: me.name,
          email: me.email,
          provider: "email",
        });
        setActiveBusiness({
          id: me.account_id,
          name: settings.name,
          ownerEmail: me.email,
          settings,
        });
      } catch (err) {
        console.error("Session restore failed:", err);
        localStorage.removeItem("token");
      } finally {
        setIsRestoringSession(false);
      }
    };

    restoreSession();
  }, []);


  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("tickit_theme") as "light" | "dark") || "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("tickit_theme", nextTheme);
  };

  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Quick Action menu states
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isLogTimeModalOpen, setIsLogTimeModalOpen] = useState(false);

  // Partitioned state variables loaded based on activeBusiness.id
  const [jobs, setJobs] = useState<Job[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>({
    name: "",
    address: "",
    email: "",
    phone: "",
    logoUrl: "",
    paymentTerms: "",
    currency: "USD",
    taxRate: 0,
  });

  // Load real, server-backed data (jobs/clients/employees/settings) whenever the active
  // account changes. Payroll/users/files have no backend endpoints yet (see Phase 2 notes)
  // and remain on localStorage, keyed by account_id.
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    if (!activeBusiness) return;
    const accountId = activeBusiness.id;

    const loadPartition = <T,>(key: string, fallbackValue: T): T => {
      const stored = localStorage.getItem(`tickit_${accountId}_${key}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // parse error, fall through to default
        }
      }
      localStorage.setItem(`tickit_${accountId}_${key}`, JSON.stringify(fallbackValue));
      return fallbackValue;
    };

    const loadServerData = async () => {
      setIsLoadingData(true);
      try {
        const [jobsRes, clientsRes, employeesRes, settingsRes] = await Promise.all([
          apiFetch("/api/jobs"),
          apiFetch("/api/clients"),
          apiFetch("/api/employees"),
          apiFetch("/api/settings"),
        ]);

        if (jobsRes.ok) setJobs(await jobsRes.json());
        if (clientsRes.ok) setClients(await clientsRes.json());
        if (employeesRes.ok) {
          const serverEmployees = await employeesRes.json();
          // Employees have no backend CRUD yet — merge server-known employees with
          // any purely-local payroll bookkeeping (timeCards) already stored locally.
          const localEmployees = loadPartition<Employee[]>("employees", []);
          const merged = serverEmployees.length > 0 ? serverEmployees : localEmployees;
          setEmployees(merged);
        }
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          if (s && s.name) setSettings(s);
        }
      } catch (err) {
        console.error("Failed to load account data from server:", err);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadServerData();

    // Payroll/users/files: still local-only until a real backend exists for them.
    setPayrollRecords(loadPartition<PayrollRecord[]>("payroll", []));

    const defaultUsers: AppUser[] = currentUser ? [
      {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: "Admin",
        permissions: ["dashboard", "jobs", "new-request", "payroll", "invoices", "users", "files", "clients"]
      }
    ] : [];
    setUsers(loadPartition<AppUser[]>("users", defaultUsers));
    setFiles(loadPartition<FileItem[]>("files", []));
  }, [activeBusiness]);

  // Payroll/users/files remain client-side for now — keep persisting those to
  // localStorage. Jobs/clients/employees/settings are server-backed and persisted via
  // their own API calls at the point of mutation instead (see handlers below).
  useEffect(() => {
    if (!activeBusiness) return;
    localStorage.setItem(`tickit_${activeBusiness.id}_payroll`, JSON.stringify(payrollRecords));
  }, [payrollRecords, activeBusiness]);

  useEffect(() => {
    if (!activeBusiness) return;
    localStorage.setItem(`tickit_${activeBusiness.id}_users`, JSON.stringify(users));
  }, [users, activeBusiness]);

  useEffect(() => {
    if (!activeBusiness) return;
    localStorage.setItem(`tickit_${activeBusiness.id}_files`, JSON.stringify(files));
  }, [files, activeBusiness]);

  useEffect(() => {
    if (!activeBusiness) return;
    localStorage.setItem(`tickit_${activeBusiness.id}_employees`, JSON.stringify(employees));
  }, [employees, activeBusiness]);


  const handleUpdateSettings = async (newSettings: BusinessSettings) => {
    setSettings(newSettings);
    try {
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) console.error("Failed to save settings to server");
    } catch (err) {
      console.error("Failed to save settings:", err);
    }

    if (activeBusiness) {
      setActiveBusiness({ ...activeBusiness, name: newSettings.name, settings: newSettings });
    }
  };

  const handleAuthComplete = (user: AuthenticatedUser, business: Business) => {
    setCurrentUser(user);
    setActiveBusiness(business);
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveBusiness(null);
    localStorage.removeItem("token");
  };

  // The real backend ties exactly one account to each login — there is no longer a
  // concept of switching between multiple businesses under one user, so this now just
  // logs out and returns to the login screen.
  const handleSwitchBusiness = () => {
    handleLogout();
  };

  // Still restoring a session from a stored JWT — avoid flashing the login screen.
  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // If session is unauthenticated, direct to security gate
  if (!currentUser || !activeBusiness) {
    return <AuthGate onAuthComplete={handleAuthComplete} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION - Scoped strictly to the active business */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        businessName={settings.name || activeBusiness.name}
        onSwitchBusiness={handleSwitchBusiness}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Workspace Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 md:px-8 z-10 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center bg-slate-100 rounded-xl px-3 py-2 w-full max-w-80 border border-slate-200">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search jobs, clients, or files..."
                className="bg-transparent border-none outline-none ml-2 text-sm w-full text-slate-700 min-w-0"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Quick Actions Dropdown */}
            <div className="relative">
              <button
                id="btn-quick-actions"
                onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
                className="flex items-center gap-1.5 sm:gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse shrink-0" />
                <span className="hidden sm:inline">Quick Actions</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${isQuickActionsOpen ? "rotate-180" : ""}`} />
              </button>

              {isQuickActionsOpen && (
                <div className="absolute right-0 mt-2 w-52 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-1.5 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workspace Shortcuts</p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsNewClientModalOpen(true);
                      setIsQuickActionsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-indigo-500" />
                    New Client
                  </button>

                  <button
                    onClick={() => {
                      setIsLogTimeModalOpen(true);
                      setIsQuickActionsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-emerald-500" />
                    Log Time / Time Card
                  </button>
                </div>
              )}
            </div>

            {/* Theme Toggle Switch */}
            <button
              onClick={toggleTheme}
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-all active:scale-95 cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-200/50"
            >
              {theme === "light" ? (
                <Moon className="w-4.5 h-4.5 text-slate-600" />
              ) : (
                <Sun className="w-4.5 h-4.5 text-amber-400" />
              )}
            </button>

            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              {currentUser.photoUrl ? (
                <img
                  src={currentUser.photoUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full border-2 border-indigo-100 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs uppercase">
                  {currentUser.name.slice(0, 2)}
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-none">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 font-semibold leading-none mt-1 truncate max-w-[120px]">{currentUser.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Component Render Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          {activeTab === "dashboard" && <Dashboard jobs={jobs} />}
          {activeTab === "jobs" && (
            <JobBoard
              jobs={jobs}
              setJobs={setJobs}
              employees={employees}
              clients={clients}
              settings={settings}
            />
          )}
          {activeTab === "clients" && (
            <Clients
              clients={clients}
              setClients={setClients}
              jobs={jobs}
            />
          )}
          {activeTab === "payroll" && (
            <Payroll
              employees={employees}
              setEmployees={setEmployees}
              payrollRecords={payrollRecords}
              setPayrollRecords={setPayrollRecords}
              businessId={activeBusiness.id}
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
              clients={clients}
              settings={settings}
            />
          )}
          {activeTab === "settings" && (
            <Settings settings={settings} setSettings={handleUpdateSettings} businessId={activeBusiness.id} />
          )}
          {activeTab === "new-request" && (
            <div className="max-w-4xl mx-auto">
              <JobRequestForm
                employees={employees}
                clients={clients}
                onSave={async (jobData) => {
                  const newJob: Job = {
                    ...jobData,
                    id: generateUUID(),
                    createdAt: new Date().toISOString(),
                    activityLog: [
                      {
                        id: generateUUID(),
                        action: `Job request initiated for ${jobData.client}`,
                        timestamp: new Date().toISOString(),
                        user: currentUser.name,
                      }
                    ]
                  };
                  try {
                    const res = await apiFetch("/api/jobs", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(newJob),
                    });
                    if (res.ok) {
                      const serverJob = await res.json();
                      setJobs([serverJob, ...jobs]);
                    } else {
                      console.error("Failed to save job to server, keeping local copy only");
                      setJobs([newJob, ...jobs]);
                    }
                  } catch (err) {
                    console.error("Failed to save job to server:", err);
                    setJobs([newJob, ...jobs]);
                  }
                  setActiveTab("jobs");
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* New Client Quick Action Modal */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Add New Client</h3>
              <button
                onClick={() => setIsNewClientModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const target = e.currentTarget;
              const name = (target.elements.namedItem("clientName") as HTMLInputElement).value;
              const company = (target.elements.namedItem("clientCompany") as HTMLInputElement).value;
              const email = (target.elements.namedItem("clientEmail") as HTMLInputElement).value;
              const phone = (target.elements.namedItem("clientPhone") as HTMLInputElement).value;
              const address = (target.elements.namedItem("clientAddress") as HTMLInputElement).value;

              const localClient: Client = {
                id: `c_${generateUUID().slice(0, 8)}`,
                name,
                company: company || "Individual",
                email,
                phone,
                address,
                createdAt: new Date().toISOString()
              };

              try {
                const res = await apiFetch("/api/clients", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, company: company || "Individual", email, phone, address }),
                });
                if (res.ok) {
                  const serverClient = await res.json();
                  setClients([serverClient, ...clients]);
                } else {
                  const errData = await res.json().catch(() => ({}));
                  alert(`Failed to add client: ${errData.error || "Unknown error"}`);
                  setIsNewClientModalOpen(false);
                  return;
                }
              } catch (err) {
                console.error("Failed to save client to server:", err);
                setClients([localClient, ...clients]);
              }

              setIsNewClientModalOpen(false);
              alert(`Successfully added new client: ${name} (${company || "Individual"})`);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Name *</label>
                <input
                  name="clientName"
                  type="text"
                  required
                  placeholder="John Smith"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Company / Organization</label>
                <input
                  name="clientCompany"
                  type="text"
                  placeholder="e.g. Acme Corp"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm text-slate-800"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email *</label>
                  <input
                    name="clientEmail"
                    type="email"
                    required
                    placeholder="john@example.com"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone</label>
                  <input
                    name="clientPhone"
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm text-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Billing Address</label>
                <textarea
                  name="clientAddress"
                  placeholder="123 Corporate Way, City, ST"
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm text-slate-800 resize-none"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-md cursor-pointer"
                >
                  Add Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Time / Time Card Quick Action Modal */}
      {isLogTimeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Log Hours / Time Card</h3>
              <button
                onClick={() => setIsLogTimeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {employees.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="text-sm">No employees configured for this tenant partition.</p>
                <p className="text-xs text-slate-400 mt-2">Please register an employee in the Payroll panel first.</p>
              </div>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                const target = e.currentTarget;
                const employeeId = (target.elements.namedItem("employeeId") as HTMLSelectElement).value;
                const date = (target.elements.namedItem("logDate") as HTMLInputElement).value;
                const hours = parseFloat((target.elements.namedItem("logHours") as HTMLInputElement).value);
                const clockIn = (target.elements.namedItem("clockIn") as HTMLInputElement).value || "09:00";
                const clockOut = (target.elements.namedItem("clockOut") as HTMLInputElement).value || "17:00";

                const matchedEmployee = employees.find(emp => emp.id === employeeId);
                if (!matchedEmployee) return;

                const newTimeCard = {
                  id: `tc_${generateUUID().slice(0, 8)}`,
                  date,
                  clockIn,
                  clockOut,
                  hoursWorked: hours
                };

                const updatedEmployees = employees.map(emp => {
                  if (emp.id === employeeId) {
                    const currentCards = emp.timeCards || [];
                    return {
                      ...emp,
                      hoursWorked: (emp.hoursWorked || 0) + hours,
                      timeCards: [newTimeCard, ...currentCards]
                    };
                  }
                  return emp;
                });

                setEmployees(updatedEmployees);
                setIsLogTimeModalOpen(false);
                alert(`Successfully logged ${hours} hours for ${matchedEmployee.name} on ${date}.`);
              }} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select Employee *</label>
                  <select
                    name="employeeId"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm text-slate-800"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role} - {emp.workerType})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date *</label>
                    <input
                      name="logDate"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Hours Worked *</label>
                    <input
                      name="logHours"
                      type="number"
                      required
                      min="0.1"
                      max="24"
                      step="0.1"
                      defaultValue="8"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm text-slate-800"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Clock In (Optional)</label>
                    <input
                      name="clockIn"
                      type="time"
                      defaultValue="09:00"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Clock Out (Optional)</label>
                    <input
                      name="clockOut"
                      type="time"
                      defaultValue="17:00"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm text-slate-800"
                    />
                  </div>
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLogTimeModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-md cursor-pointer"
                  >
                    Save Time Card
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
