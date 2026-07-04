import React from "react";
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Settings,
  PlusCircle,
  CreditCard,
  Users,
  FolderOpen,
  HelpCircle,
} from "lucide-react";
import { SubscriptionBanner } from "./SubscriptionBanner";

export function Sidebar({
  activeTab,
  setActiveTab,
  onUpgradeClick,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onUpgradeClick: () => void;
}) {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <img
          src="/assets/auvic_logo.png"
          alt="Auvic Solutions"
          className="h-10 object-contain shrink-0"
        />
        <span className="text-lg font-bold text-slate-900 leading-tight">Auvic<br /><span className="text-xs font-medium text-slate-400 tracking-wide uppercase">Solutions</span></span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        <NavItem
          icon={<PlusCircle />}
          label="New Request"
          active={activeTab === "new-request"}
          onClick={() => setActiveTab("new-request")}
        />
        <NavItem
          icon={<LayoutDashboard />}
          label="Dashboard"
          active={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
        />
        <NavItem
          icon={<ClipboardList />}
          label="Jobs"
          active={activeTab === "jobs"}
          onClick={() => setActiveTab("jobs")}
        />
        <NavItem
          icon={<Users />}
          label="Clients"
          active={activeTab === "clients"}
          onClick={() => setActiveTab("clients")}
        />
        <NavItem
          icon={<CreditCard />}
          label="Payroll"
          active={activeTab === "payroll"}
          onClick={() => setActiveTab("payroll")}
        />
        <NavItem
          icon={<FolderOpen />}
          label="Files"
          active={activeTab === "files"}
          onClick={() => setActiveTab("files")}
        />
        <NavItem
          icon={<Users />}
          label="Team"
          active={activeTab === "users"}
          onClick={() => setActiveTab("users")}
        />
        <NavItem
          icon={<FileText />}
          label="Invoices"
          active={activeTab === "invoices"}
          onClick={() => setActiveTab("invoices")}
        />
        <NavItem
          icon={<Settings />}
          label="Settings"
          active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
        />
        <NavItem
          icon={<Users />}
          label="My Profile"
          active={activeTab === "profile"}
          onClick={() => setActiveTab("profile")}
        />
        <NavItem
          icon={<HelpCircle />}
          label="Help Center"
          active={activeTab === "help"}
          onClick={() => setActiveTab("help")}
        />
      </nav>
      <SubscriptionBanner onUpgradeClick={onUpgradeClick} />
      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
            Automations
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">AI Invoice Gen</span>
            <span className="w-8 h-4 bg-indigo-600 rounded-full relative cursor-pointer">
              <span className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></span>
            </span>
          </div>
        </div>
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
  const handleClick = () => {
    console.log("NavItem Clicked:", label);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active
        ? "bg-indigo-50 text-indigo-600"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
      {label}
    </button>
  );
}
