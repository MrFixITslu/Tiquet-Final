import React from "react";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Settings,
  PlusCircle,
  CreditCard,
  Users,
  FolderOpen,
  Contact,
  Building2,
  LogOut,
  ArrowLeftRight
} from "lucide-react";

export function Sidebar({
  activeTab,
  setActiveTab,
  businessName,
  onSwitchBusiness,
  onLogout,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  businessName: string;
  onSwitchBusiness: () => void;
  onLogout: () => void;
}) {
  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen shrink-0">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-200 block truncate max-w-[140px]">{businessName}</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">V79 TIQUET Admin</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <NavItem
          icon={<PlusCircle className="w-4 h-4 text-emerald-400" />}
          label="New Request"
          active={activeTab === "new-request"}
          onClick={() => setActiveTab("new-request")}
        />
        <NavItem
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="Dashboard"
          active={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
        />
        <NavItem
          icon={<Briefcase className="w-4 h-4" />}
          label="Jobs"
          active={activeTab === "jobs"}
          onClick={() => setActiveTab("jobs")}
        />
        <NavItem
          icon={<Contact className="w-4 h-4" />}
          label="Clients"
          active={activeTab === "clients"}
          onClick={() => setActiveTab("clients")}
        />
        <NavItem
          icon={<CreditCard className="w-4 h-4" />}
          label="Payroll"
          active={activeTab === "payroll"}
          onClick={() => setActiveTab("payroll")}
        />
        <NavItem
          icon={<FolderOpen className="w-4 h-4" />}
          label="Files"
          active={activeTab === "files"}
          onClick={() => setActiveTab("files")}
        />
        <NavItem
          icon={<Users className="w-4 h-4" />}
          label="Users & Admins"
          active={activeTab === "users"}
          onClick={() => setActiveTab("users")}
        />
        <NavItem
          icon={<FileText className="w-4 h-4" />}
          label="Invoices"
          active={activeTab === "invoices"}
          onClick={() => setActiveTab("invoices")}
        />
        <NavItem
          icon={<Settings className="w-4 h-4" />}
          label="Settings"
          active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
        />
      </nav>

      {/* Footer Business & Auth Session Isolation display */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3">
        <div className="space-y-1">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Business</p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 truncate max-w-[130px]">{businessName}</span>
            <button
              onClick={onSwitchBusiness}
              className="text-indigo-400 hover:text-indigo-300 text-[10px] font-bold flex items-center gap-1 uppercase transition-colors"
              title="Switch Business Tenant"
            >
              <ArrowLeftRight className="w-3 h-3" />
              Switch
            </button>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-red-950 hover:text-red-300 rounded-lg text-xs font-semibold text-slate-300 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Log Out
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
        active
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/40"
          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
