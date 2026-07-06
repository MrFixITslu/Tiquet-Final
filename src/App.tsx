import React, { useState, useEffect } from "react";
import { Search, Bell, Shield, LogOut, CheckSquare, RefreshCw, Zap, ChevronDown, UserPlus, Clock, X, Sun, Moon } from "lucide-react";
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
import { Job, Employee, PayrollRecord, AppUser, FileItem, Client, BusinessSettings, AuthenticatedUser, Business, GlobalPayrollSettings } from "./types";
import { generateUUID } from "./utils";
import { api } from "./lib/api";

// SECURE MULTI-TENANT WORKSPACE ROOT

const ACTIVE_BUSINESS_ID_KEY = "tickit_active_business_id";

export default function App() {
  // Auth state is no longer read from localStorage - it's restored from the
  // server session (httpOnly cookie) on load, so login now works the same
  // way from any browser/device rather than being trapped in one browser's
  // localStorage.
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        setCurrentUser(user);

        await api.refreshCsrf();
        const { businesses } = await api.listBusinesses();
        const rememberedId = localStorage.getItem(ACTIVE_BUSINESS_ID_KEY);
        const restored = businesses.find((b) => b.id === rememberedId) || businesses[0] || null;
        setActiveBusiness(restored);
      } catch (err) {
        // No valid session - fall through to the login gate.
        setCurrentUser(null);
        setActiveBusiness(null);
      } finally {
        setSessionLoading(false);
      }
    })();
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
  const [payrollSettings, setPayrollSettings] = useState<GlobalPayrollSettings>({
    defaultHourlyRate: 25,
    defaultCommissionRate: 10,
    defaultFlatFee: 1500,
    taxWithholdingRate: 12,
  });

  // Fetch partitioned business data from the server when activeBusiness changes.
  useEffect(() => {
    if (!activeBusiness) {
      setDataReady(false);
      return;
    }

    let cancelled = false;
    setDataReady(false);

    (async () => {
      const [jobsData, clientsData, employeesData, filesData, payrollData, usersData, payrollSettingsData] = await Promise.all([
        api.getBusinessData<Job[]>(activeBusiness.id, "jobs"),
        api.getBusinessData<Client[]>(activeBusiness.id, "clients"),
        api.getBusinessData<Employee[]>(activeBusiness.id, "employees"),
        api.getBusinessData<FileItem[]>(activeBusiness.id, "files"),
        api.getBusinessData<PayrollRecord[]>(activeBusiness.id, "payroll"),
        api.getBusinessData<AppUser[]>(activeBusiness.id, "users"),
        api.getBusinessData<GlobalPayrollSettings>(activeBusiness.id, "payrollSettings"),
      ]);

      if (cancelled) return;

      setJobs(jobsData.data);
      setClients(clientsData.data);
      setEmployees(employeesData.data);
      setFiles(filesData.data);
      setPayrollRecords(payrollData.data);
      setUsers(usersData.data.length ? usersData.data : currentUser ? [
        {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: "Admin",
          permissions: ["dashboard", "jobs", "new-request", "payroll", "invoices", "users", "files", "clients"],
        }
      ] : []);
      setPayrollSettings(payrollSettingsData.data);
      setSettings(activeBusiness.settings);
      setDataReady(true);
    })().catch((err) => {
      console.error("Failed to load business data:", err);
      if (!cancelled) setDataReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [activeBusiness, currentUser]);

  // Synchronize partitioned database on state changes. Server persistence is
  // authoritative; localStorage is intentionally not used for business data.
  useEffect(() => {
    if (!activeBusiness || !dataReady) return;
    api.updateBusinessData(activeBusiness.id, "jobs", jobs).catch((err) => console.error("Failed to sync jobs:", err));
  }, [jobs, activeBusiness, dataReady]);

  useEffect(() => {
    if (!activeBusiness || !dataReady) return;
    api.updateBusinessData(activeBusiness.id, "clients", clients).catch((err) => console.error("Failed to sync clients:", err));
  }, [clients, activeBusiness, dataReady]);

  useEffect(() => {
    if (!activeBusiness || !dataReady) return;
    api.updateBusinessData(activeBusiness.id, "employees", employees).catch((err) => console.error("Failed to sync employees:", err));
  }, [employees, activeBusiness, dataReady]);

  useEffect(() => {
    if (!activeBusiness || !dataReady) return;
    api.updateBusinessData(activeBusiness.id, "files", files).catch((err) => console.error("Failed to sync files:", err));
  }, [files, activeBusiness, dataReady]);

  useEffect(() => {
    if (!activeBusiness || !dataReady) return;
    api.updateBusinessData(activeBusiness.id, "payroll", payrollRecords).catch((err) => console.error("Failed to sync payroll:", err));
  }, [payrollRecords, activeBusiness, dataReady]);

  useEffect(() => {
    if (!activeBusiness || !dataReady) return;
    api.updateBusinessData(activeBusiness.id, "users", users).catch((err) => console.error("Failed to sync users:", err));
  }, [users, activeBusiness, dataReady]);

  useEffect(() => {
    if (!activeBusiness || !dataReady) return;
    api.updateBusinessData(activeBusiness.id, "payrollSettings", payrollSettings).catch((err) => console.error("Failed to sync payroll settings:", err));
  }, [payrollSettings, activeBusiness, dataReady]);

  const handleUpdateSettings = (newSettings: BusinessSettings) => {
    setSettings(newSettings);
    if (activeBusiness) {
      const updatedBiz = { ...activeBusiness, name: newSettings.name, settings: newSettings };
      setActiveBusiness(updatedBiz);

      // Persist the business record (name/settings) to the server too, so
      // it shows correctly if this user logs in from another device.
      api.updateBusinessSettings(activeBusiness.id, newSettings).catch((err) => {
        console.error("Failed to sync business settings to server:", err);
      });
    }
  };

  const handleAuthComplete = (user: AuthenticatedUser, business: Business) => {
    setCurrentUser(user);
    setActiveBusiness(business);
    // Only remembering *which* business was last active locally, as a UX
    // nicety - the account and business records themselves live server-side.
    localStorage.setItem(ACTIVE_BUSINESS_ID_KEY, business.id);
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    api.logout().catch(() => {});
    setCurrentUser(null);
    setActiveBusiness(null);
    localStorage.removeItem(ACTIVE_BUSINESS_ID_KEY);
  };

  const handleSwitchBusiness = () => {
    setActiveBusiness(null);
    localStorage.removeItem(ACTIVE_BUSINESS_ID_KEY);
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-t-indigo-600 border-r-indigo-600/20 border-b-indigo-600/20 border-l-indigo-600/20 animate-spin" />
      </div>
    );
  }

  // If session is unauthenticated or active business is not selected, direct to security gate
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
      />

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Workspace Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 rounded-xl px-3 py-2 w-80 border border-slate-200">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search jobs, clients, or files..."
                className="bg-transparent border-none outline-none ml-2 text-sm w-full text-slate-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Actions Dropdown */}
            <div className="relative">
              <button
                id="btn-quick-actions"
                onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" />
                <span>Quick Actions</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isQuickActionsOpen ? "rotate-180" : ""}`} />
              </button>

              {isQuickActionsOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
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
        <div className="flex-1 overflow-auto p-8">
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
              payrollSettings={payrollSettings}
              setPayrollSettings={setPayrollSettings}
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
                onSave={(jobData) => {
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
                  setJobs([newJob, ...jobs]);
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Add New Client</h3>
              <button
                onClick={() => setIsNewClientModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const target = e.currentTarget;
              const name = (target.elements.namedItem("clientName") as HTMLInputElement).value;
              const company = (target.elements.namedItem("clientCompany") as HTMLInputElement).value;
              const email = (target.elements.namedItem("clientEmail") as HTMLInputElement).value;
              const phone = (target.elements.namedItem("clientPhone") as HTMLInputElement).value;
              const address = (target.elements.namedItem("clientAddress") as HTMLInputElement).value;
              
              const newClient = {
                id: `c_${generateUUID().slice(0, 8)}`,
                name,
                company: company || "Individual",
                email,
                phone,
                address,
                createdAt: new Date().toISOString()
              };
              
              setClients([newClient, ...clients]);
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
              <div className="grid grid-cols-2 gap-4">
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-150">
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
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
