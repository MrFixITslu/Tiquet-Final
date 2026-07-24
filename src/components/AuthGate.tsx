import React, { useState } from "react";
import { 
  Briefcase, 
  Check, 
  Building2, 
  Shield, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  KeyRound
} from "lucide-react";
import { AuthenticatedUser, Business } from "../types";
import { apiFetch } from "../lib/api";

export function AuthGate({
  onAuthComplete,
}: {
  onAuthComplete: (user: AuthenticatedUser, activeBusiness: Business) => void;
}) {
  const [authStep, setAuthStep] = useState<"login" | "loading" | "two_factor">("login");
  const [loadingText, setLoadingText] = useState("");

  // Email Auth state
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // 2FA state (server supports TOTP 2FA on login — see /api/auth/login/2fa)
  const [tempToken, setTempToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // Stores the JWT and hands off to the parent with a real AuthenticatedUser + Business
  // built from the server's response, instead of anything read from localStorage.
  const completeLogin = async (token: string, user: any) => {
    localStorage.setItem("token", token);

    let settings: Business["settings"] = {
      name: user.name ? `${user.name}'s Business` : "My Business",
      address: "",
      email: user.email || "",
      phone: "",
      logoUrl: "",
      paymentTerms: "Due within 30 days.",
      currency: "USD",
      taxRate: 0,
    };

    try {
      const res = await apiFetch("/api/settings");
      if (res.ok) {
        const s = await res.json();
        if (s && s.name) settings = s;
      }
    } catch {
      // Fall back to the defaults above — settings can be filled in later from the
      // Settings tab, this shouldn't block login.
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      provider: (user.oauth_provider as AuthenticatedUser["provider"]) || "email",
    };

    const business: Business = {
      id: user.account_id,
      name: settings.name,
      ownerEmail: user.email,
      settings,
    };

    onAuthComplete(authenticatedUser, business);
  };

  // EMAIL REGISTRATION & LOGIN — now calls the restored backend directly instead of
  // reading/writing localStorage.
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    if (isRegistering) {
      if (!name.trim()) {
        setErrorMessage("Please enter your full name.");
        return;
      }
      if (!companyName.trim()) {
        setErrorMessage("Please enter your company or business name.");
        return;
      }
    }

    setLoadingText(isRegistering ? "Creating your account..." : "Verifying credentials...");
    setAuthStep("loading");

    try {
      if (isRegistering) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            companyName: companyName.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Registration failed.");
          setAuthStep("login");
          return;
        }
        await completeLogin(data.token, data.user);
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Invalid email or password.");
          setAuthStep("login");
          return;
        }
        if (data.requires2FA) {
          setTempToken(data.tempToken);
          setAuthStep("two_factor");
          return;
        }
        await completeLogin(data.token, data.user);
      }
    } catch (err) {
      console.error("Auth request failed:", err);
      setErrorMessage("Could not reach the server. Please check your connection and try again.");
      setAuthStep("login");
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoadingText("Verifying your 2FA code...");
    setAuthStep("loading");
    try {
      const res = await fetch("/api/auth/login/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code: twoFactorCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Invalid 2FA code.");
        setAuthStep("two_factor");
        return;
      }
      await completeLogin(data.token, data.user);
    } catch (err) {
      console.error("2FA verification failed:", err);
      setErrorMessage("Could not reach the server. Please try again.");
      setAuthStep("two_factor");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Background radial highlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0,transparent_100%)] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-10 p-8 space-y-6">
        
        {/* LOGO AREA */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-900/40">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">V79 TIQUET Manager</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-500" />
            100% Multi-Tenant Isolation Gate
          </p>
        </div>

        {/* LOGIN CHANNELS */}
        {authStep === "login" && (
          <div className="space-y-6">
            {/* EMAIL LOGIN & REGISTRATION FORM */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-200">
                  {isRegistering ? "Create a Secure Tenant Profile" : "Email & Password Sign In"}
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {isRegistering 
                    ? "Register an email account to initiate full multi-tenant business partitions."
                    : "Provide credentials to retrieve your database divisions securely."}
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl flex items-start gap-2.5 text-xs text-red-400 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-xl flex items-start gap-2.5 text-xs text-emerald-400">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="space-y-3.5">
                {isRegistering && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Elizabeth Bennet"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-white text-sm placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                )}

                {isRegistering && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Company / Business Name
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Starlight Industries"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-white text-sm placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. elizabeth@domain.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-white text-sm placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-white text-sm placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer mt-2"
              >
                {isRegistering ? "Register Account" : "Sign In Securely"}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline underline-offset-4"
                >
                  {isRegistering 
                    ? "Already have an account? Sign In" 
                    : "Don't have an email partition? Create Account"}
                </button>
              </div>


            </form>
            
            <div className="h-px bg-slate-800" />
            <p className="text-[10px] text-slate-600 text-center leading-normal">
              Secure multi-tenant data structures restrict cross-organizational data leakage automatically.
            </p>
          </div>
        )}

        {/* LOADING HANDSHAKE ANIMATION */}
        {authStep === "loading" && (
          <div className="py-12 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              {/* Outer spinning ring */}
              <div className="w-16 h-16 rounded-full border-4 border-t-indigo-600 border-r-indigo-600/20 border-b-indigo-600/20 border-l-indigo-600/20 animate-spin" />
              {/* Inner pulsing logo */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
            </div>
            
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-300 animate-pulse">{loadingText}</p>
              <p className="text-xs text-slate-600">Verifying cryptographical session tokens...</p>
            </div>
          </div>
        )}

        {/* TWO-FACTOR VERIFICATION */}
        {authStep === "two_factor" && (
          <form onSubmit={handleTwoFactorSubmit} className="space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-indigo-950/60 border border-indigo-900/50 rounded-2xl flex items-center justify-center mx-auto">
                <KeyRound className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Two-Factor Verification</h2>
              <p className="text-xs text-slate-500">
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                required
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-white text-center text-lg tracking-[0.4em] font-mono"
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                Verify &amp; Continue
              </button>
              <button
                type="button"
                onClick={() => { setAuthStep("login"); setTwoFactorCode(""); }}
                className="w-full py-2.5 bg-transparent border border-slate-800 hover:bg-slate-900/50 text-slate-400 hover:text-white rounded-xl text-xs transition-all cursor-pointer font-semibold"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
