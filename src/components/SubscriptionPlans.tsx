import React, { useState, useEffect } from "react";
import { X, Check, Zap, Star, Building2, Loader2, CheckCircle2 } from "lucide-react";
import { apiFetch } from "../lib/api";

interface Plan {
  name: string;
  price: number;
  features: string[];
}

interface PlansData {
  starter: Plan;
  pro: Plan;
  enterprise: Plan;
}

interface SubscriptionPlansProps {
  onClose: () => void;
}

const PLAN_ICONS: Record<keyof PlansData, React.ElementType> = {
  starter: Zap,
  pro: Star,
  enterprise: Building2,
};

const PLAN_COLORS: Record<keyof PlansData, { bg: string; accent: string; ring: string; btn: string; badge: string }> = {
  starter: { bg: "from-slate-800 to-slate-900", accent: "text-sky-400", ring: "ring-sky-500/30", btn: "bg-sky-500 hover:bg-sky-400", badge: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  pro: { bg: "from-indigo-900 to-slate-900", accent: "text-indigo-400", ring: "ring-indigo-500/40", btn: "bg-indigo-500 hover:bg-indigo-400", badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  enterprise: { bg: "from-purple-900 to-slate-900", accent: "text-purple-400", ring: "ring-purple-500/30", btn: "bg-purple-500 hover:bg-purple-400", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
};

export function SubscriptionPlans({ onClose }: SubscriptionPlansProps) {
  const [plans, setPlans] = useState<PlansData | null>(null);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/stripe/plans").then(r => r.json()),
      apiFetch("/api/stripe/subscription-status").then(r => r.ok ? r.json() : null),
    ]).then(([p, s]) => {
      setPlans(p as PlansData);
      setCurrentSub(s);
    }).finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (planKey: string) => {
    setSubscribing(planKey);
    try {
      const res = await apiFetch("/api/stripe/simulate-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      if (res.ok) {
        setSuccess(planKey);
        setCurrentSub({ ...currentSub, status: "active", plan: planKey });
        setTimeout(onClose, 2500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black text-white">Choose Your Plan</h2>
            <p className="text-slate-400 mt-1">Unlock more power. Cancel anytime.</p>
          </div>
          <button
            onClick={onClose}
            title="Close plans"
            className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Current subscription info */}
        {currentSub && (
          <div className="mb-8 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-sm text-slate-300">
              Currently on: <span className="font-bold text-white capitalize">{currentSub.plan}</span> plan
              {currentSub.status === "trialing" && currentSub.daysLeft > 0 && (
                <span className="ml-2 text-amber-400">· {currentSub.daysLeft} days left in trial</span>
              )}
            </p>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans && (Object.entries(plans) as [keyof PlansData, Plan][]).map(([planKey, planData]) => {
            const colors = PLAN_COLORS[planKey];
            const Icon = PLAN_ICONS[planKey];
            const isCurrentPlan = currentSub?.plan === planKey && currentSub?.status === "active";
            const isPro = planKey === "pro";
            const isSucceeded = success === planKey;

            return (
              <div
                key={planKey}
                className={`relative bg-gradient-to-b ${colors.bg} border border-white/10 rounded-3xl p-7 flex flex-col ring-1 ${isPro ? colors.ring : "ring-transparent"} ${isPro ? "scale-[1.02] shadow-2xl" : ""} transition-transform`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-black uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg">
                    Most Popular
                  </div>
                )}

                {/* Plan header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 ${colors.badge} border rounded-xl flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">{planData.name}</h3>
                    <span className={`text-xs ${colors.badge} border rounded-full px-2 py-0.5 font-medium capitalize`}>{planKey}</span>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-end gap-1">
                    <span className={`text-4xl font-black ${colors.accent}`}>${planData.price}</span>
                    <span className="text-slate-400 text-sm mb-1.5">/month</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-8 flex-1">
                  {planData.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 ${colors.accent} shrink-0 mt-0.5`} />
                      <span className="text-sm text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrentPlan ? (
                  <div className="w-full flex items-center justify-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold py-3 rounded-xl text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Current Plan
                  </div>
                ) : isSucceeded ? (
                  <div className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm animate-in zoom-in-95 duration-300">
                    <CheckCircle2 className="w-4 h-4" />
                    Subscribed! Activating…
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(planKey)}
                    disabled={!!subscribing}
                    title={`Subscribe to ${planData.name} plan`}
                    className={`w-full ${colors.btn} text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50`}
                  >
                    {subscribing === planKey ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Activating…
                      </>
                    ) : (
                      `Get ${planData.name}`
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          🔒 Simulated mode — No real charges. Add Stripe keys to process real payments.
        </p>
      </div>
    </div>
  );
}
