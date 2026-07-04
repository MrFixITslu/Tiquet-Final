import React from "react";
import { ShieldOff, Mail, RefreshCw } from "lucide-react";

interface AccountSuspendedProps {
  onLogout: () => void;
}

export function AccountSuspended({ onLogout }: AccountSuspendedProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 flex items-center justify-center p-6">
      {/* Glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl">
          {/* Icon */}
          <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-red-500/30">
            <ShieldOff className="w-12 h-12 text-red-400" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
            Account Suspended
          </div>

          <h1 className="text-3xl font-black text-white mb-3 leading-tight">
            Your Account Has Been<br />Suspended
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
            Access to this account has been temporarily restricted by the platform administrator. 
            This may be due to a billing issue or a policy violation.
          </p>

          {/* Info box */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 text-left space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">What to do next</p>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-slate-300">1</span>
              </div>
              <p className="text-sm text-slate-300">Check your registered email for a suspension notice with details.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-slate-300">2</span>
              </div>
              <p className="text-sm text-slate-300">Contact platform support to resolve the issue and restore access.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-slate-300">3</span>
              </div>
              <p className="text-sm text-slate-300">Once resolved, log back in to regain full access to your account.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href="mailto:support@v79tickit.com"
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-5 rounded-xl transition-all shadow-lg shadow-indigo-900/40"
            >
              <Mail className="w-4 h-4" />
              Contact Support
            </a>
            <button
              onClick={onLogout}
              className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-slate-300 font-semibold py-3 px-5 rounded-xl transition-all border border-white/10"
            >
              <RefreshCw className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          V79 Tick-It Platform &nbsp;·&nbsp; support@v79tickit.com
        </p>
      </div>
    </div>
  );
}
