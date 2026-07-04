import React, { useState } from "react";
import { Search, BookOpen, ChevronRight, HelpCircle, Key, Layout, Users, FileText, Settings as SettingsIcon, ShieldCheck } from "lucide-react";

interface HelpTopic {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
  keywords: string[];
}

export function Help() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>("getting-started");

  const topics: HelpTopic[] = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: BookOpen,
      keywords: ["login", "signup", "register", "start"],
      content: (
        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">How to Login & Use the App</h3>
            <p className="text-slate-600 mb-4">Auvic Solutions is designed to be intuitive and powerful. Follow these steps to get your business up and running.</p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                Sign In / Register
              </h4>
              <p className="text-sm text-slate-600 mb-4 font-body">Navigate to the login screen. If you're new, click "register your company" to create a new organization.</p>
              <img src="/assets/manual/login.png" alt="Login Page" className="rounded-xl border border-slate-200 shadow-sm w-full max-w-2xl" />
            </div>
          </section>
        </div>
      )
    },
    {
      id: "dashboard",
      title: "Dashboard Overview",
      icon: Layout,
      keywords: ["stats", "overview", "metrics", "analytics"],
      content: (
        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Platform Overview</h3>
            <p className="text-slate-600 mb-4">The dashboard provides a high-level summary of your business performance.</p>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <img src="/assets/manual/dashboard.png" alt="Dashboard" className="rounded-xl border border-slate-200 shadow-sm w-full" />
              <ul className="mt-6 space-y-3">
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5 shrink-0"></div>
                  <span><strong>Total Jobs:</strong> Ongoing and completed projects.</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5 shrink-0"></div>
                  <span><strong>Active Revenue:</strong> Real-time financial health monitoring.</span>
                </li>
              </ul>
            </div>
          </section>
        </div>
      )
    },
    {
      id: "jobs",
      title: "Managing Jobs",
      icon: FileText,
      keywords: ["jobs", "projects", "kanban", "status"],
      content: (
        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Job Pipeline</h3>
            <p className="text-slate-600 mb-4">Track every project through its lifecycle using the Job Board.</p>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <img src="/assets/manual/jobs.png" alt="Job Board" className="rounded-xl border border-slate-200 shadow-sm w-full" />
              <p className="mt-4 text-sm text-slate-600">Click any job card to view detailed stage breakdowns, logs, and messaging directly with clients.</p>
            </div>
          </section>
        </div>
      )
    },
    {
      id: "security",
      title: "Security & 2FA",
      icon: ShieldCheck,
      keywords: ["security", "2fa", "mfa", "password", "profile"],
      content: (
        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Protecting Your Account</h3>
            <p className="text-slate-600 mb-4">We use enterprise-grade security, but you can add an extra layer of protection.</p>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 font-body">
              <h4 className="font-bold text-slate-800 mb-2">Enable Two-Factor Authentication</h4>
              <p className="text-sm text-slate-600 mb-4">Go to "My Profile" tab and toggle on "Enable Two-Factor Authentication". Use an app like Google Authenticator to scan the QR code.</p>
              <img src="/assets/manual/profile.png" alt="Profile Security" className="rounded-xl border border-slate-200 shadow-sm w-full max-w-2xl" />
            </div>
          </section>
        </div>
      )
    }
  ];

  const filteredTopics = topics.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Sidebar / List */}
      <div className="flex h-full">
        <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
          <div className="p-6">
            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              Help Center
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-body"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-6">
            {filteredTopics.map((topic) => {
              const Icon = topic.icon;
              return (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all mb-1 ${
                    selectedTopic === topic.id 
                    ? "bg-white border border-slate-200 text-indigo-600 shadow-sm" 
                    : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${selectedTopic === topic.id ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="text-sm font-bold truncate">{topic.title}</span>
                  {selectedTopic === topic.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl p-10 mx-auto">
            {selectedTopic ? (
              topics.find(t => t.id === selectedTopic)?.content
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <HelpCircle className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a topic or search to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
