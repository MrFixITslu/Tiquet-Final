import React from "react";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Shield,
  Bell,
  Palette,
  Save,
  Image as ImageIcon,
} from "lucide-react";
import { BusinessSettings } from "../types";

export function Settings({
  settings,
  setSettings,
  businessId,
}: {
  settings: BusinessSettings;
  setSettings: (settings: BusinessSettings) => void;
  businessId?: string;
}) {
  const [activeTab, setActiveTab] = React.useState<"general" | "notifications">("general");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings({
      ...settings,
      [name]: name === "taxRate" ? parseFloat(value) : value,
    });
  };

  const handleToggle = (key: "notificationNewJobAlert" | "notificationStatusChangeAlert") => {
    const currentValue = settings[key] !== false; // defaults to true if undefined
    setSettings({
      ...settings,
      [key]: !currentValue,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-slate-500 text-sm mt-1">
          Configure your business profile, invoice defaults, and application preferences.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`pb-4 px-1 border-b-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "general"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
            }`}
          >
            General Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`pb-4 px-1 border-b-2 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "notifications"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Notifications
          </button>
        </nav>
      </div>

      {activeTab === "general" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Business Profile</h3>
              <p className="text-sm text-slate-500">
                This information will appear on your generated invoices and documents.
              </p>
            </div>
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                {businessId && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workspace Tenant ID</p>
                      <p className="text-sm font-mono font-semibold text-slate-700 mt-0.5">{businessId}</p>
                    </div>
                    <div className="self-start sm:self-auto px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                      Active Partition
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <span className="text-[10px] text-white font-bold uppercase">Change</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Logo URL</label>
                    <input
                      type="text"
                      name="logoUrl"
                      value={settings.logoUrl}
                      onChange={handleChange}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Business Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        name="name"
                        value={settings.name}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        name="email"
                        value={settings.email}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        name="phone"
                        value={settings.phone}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Website</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="www.example.com"
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      name="address"
                      value={settings.address}
                      onChange={handleChange}
                      rows={3}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-200" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Invoice Defaults</h3>
              <p className="text-sm text-slate-500">
                Set default values for new invoices to save time.
              </p>
            </div>
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Currency</label>
                    <select
                      name="currency"
                      value={settings.currency}
                      onChange={handleChange}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="XCD">XCD (EC$)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Default Tax Rate (%)</label>
                    <input
                      type="number"
                      name="taxRate"
                      value={settings.taxRate}
                      onChange={handleChange}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Default Payment Terms</label>
                  <textarea
                    name="paymentTerms"
                    value={settings.paymentTerms}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-200">
          <div className="md:col-span-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Notification Settings</h3>
            <p className="text-sm text-slate-500">
              Control when automated notifications are dispatched to keep division members up to date.
            </p>
          </div>
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              
              {/* Toggle 1: New Job Requests */}
              <div className="flex items-start justify-between gap-4 p-2.5 rounded-xl hover:bg-slate-50/50 transition-colors">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 mt-0.5">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">New Job Request Alerts</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Receive instant notification emails when any prospective or existing client submits a new job request through the intake form.
                    </p>
                  </div>
                </div>
                
                {/* Custom Toggle Switch */}
                <button
                  type="button"
                  onClick={() => handleToggle("notificationNewJobAlert")}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 flex-shrink-0 ${
                    settings.notificationNewJobAlert !== false ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      settings.notificationNewJobAlert !== false ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Toggle 2: Status Changes */}
              <div className="flex items-start justify-between gap-4 p-2.5 rounded-xl hover:bg-slate-50/50 transition-colors">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 mt-0.5">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Status Change Alerts</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Send automated email updates when jobs are transitioned between different stages (e.g., Request to In-Progress, or Invoiced to Paid).
                    </p>
                  </div>
                </div>

                {/* Custom Toggle Switch */}
                <button
                  type="button"
                  onClick={() => handleToggle("notificationStatusChangeAlert")}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 flex-shrink-0 ${
                    settings.notificationStatusChangeAlert !== false ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      settings.notificationStatusChangeAlert !== false ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Context Callout */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 font-mono text-xs font-bold">i</div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Operational Target Email</h5>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Alert notifications will be sent directly to your configured business email address: <strong className="text-slate-700 font-mono">{settings.email || "No email configured"}</strong>. Make sure this matches your active operational mailbox.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => {
            alert("Changes discarded.");
          }}
          className="px-6 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
        >
          Discard Changes
        </button>
        <button
          type="button"
          onClick={() => {
            alert("All configuration settings and notification alerts saved successfully.");
          }}
          className="px-8 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
}
