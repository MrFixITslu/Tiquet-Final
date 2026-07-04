import React, { useEffect, useState } from "react";
import { AlertTriangle, Zap, X } from "lucide-react";
import { apiFetch } from "../lib/api";

interface SubStatus {
  status: string;
  plan: string;
  daysLeft: number;
  current_period_end: string;
}

interface SubscriptionBannerProps {
  onUpgradeClick: () => void;
}

export function SubscriptionBanner({ onUpgradeClick }: SubscriptionBannerProps) {
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    apiFetch("/api/stripe/subscription-status")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSub(data); })
      .catch(() => {});
  }, []);

  if (!sub || dismissed) return null;

  const isTrialing = sub.status === "trialing";
  const isPastDue = sub.status === "past_due";
  const isCanceled = sub.status === "canceled";
  const isActive = sub.status === "active";

  // Only show banner for trial (<=7 days left), past_due, or canceled
  const showTrialWarning = isTrialing && sub.daysLeft <= 7;
  const showTrialInfo = isTrialing && sub.daysLeft > 7;
  const shouldShow = showTrialWarning || showTrialInfo || isPastDue || isCanceled;

  if (!shouldShow) return null;

  if (isPastDue) {
    return (
      <div className="mx-3 mb-2 bg-red-50 border border-red-200 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-700">Payment Failed</p>
            <p className="text-xs text-red-600 mt-0.5">Update your billing to keep access.</p>
          </div>
          <button onClick={() => setDismissed(true)} title="Dismiss notification" className="text-red-400 hover:text-red-600 shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
        <button
          onClick={onUpgradeClick}
          className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1.5 rounded-lg transition-colors"
        >
          Update Payment
        </button>
      </div>
    );
  }

  if (isCanceled) {
    return (
      <div className="mx-3 mb-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-orange-700">Subscription Canceled</p>
            <p className="text-xs text-orange-600 mt-0.5">Reactivate to restore full access.</p>
          </div>
        </div>
        <button
          onClick={onUpgradeClick}
          className="w-full mt-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-1.5 rounded-lg transition-colors"
        >
          Reactivate
        </button>
      </div>
    );
  }

  // Trial banner
  const isUrgent = sub.daysLeft <= 3;
  const bgColor = isUrgent ? "bg-red-50 border-red-200" : showTrialWarning ? "bg-amber-50 border-amber-200" : "bg-indigo-50 border-indigo-200";
  const textColor = isUrgent ? "text-red-700" : showTrialWarning ? "text-amber-700" : "text-indigo-700";
  const subColor = isUrgent ? "text-red-600" : showTrialWarning ? "text-amber-600" : "text-indigo-600";
  const btnColor = isUrgent ? "bg-red-600 hover:bg-red-700" : showTrialWarning ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700";

  return (
    <div className={`mx-3 mb-2 ${bgColor} border rounded-xl p-3`}>
      <div className="flex items-start gap-2">
        <Zap className={`w-4 h-4 ${subColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${textColor}`}>
            {sub.daysLeft === 0 ? "Trial Expired" : `${sub.daysLeft} day${sub.daysLeft !== 1 ? "s" : ""} left`}
          </p>
          <p className={`text-xs ${subColor} mt-0.5`}>
            {sub.daysLeft === 0 ? "Upgrade now to keep access." : "Upgrade to unlock all features."}
          </p>
        </div>
        <button onClick={() => setDismissed(true)} title="Dismiss notification" className={`${subColor} opacity-60 hover:opacity-100 shrink-0`}>
          <X className="w-3 h-3" />
        </button>
      </div>
      <button
        onClick={onUpgradeClick}
        className={`w-full mt-2 ${btnColor} text-white text-xs font-bold py-1.5 rounded-lg transition-colors`}
      >
        Upgrade Now →
      </button>
    </div>
  );
}
