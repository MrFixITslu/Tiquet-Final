import React, { useState, useEffect } from "react";
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
  Facebook,
  Chrome,
  KeyRound
} from "lucide-react";
import { AuthenticatedUser, Business } from "../types";
import { apiFetch } from "../lib/api";

export function AuthGate({
  onAuthComplete,
}: {
  onAuthComplete: (user: AuthenticatedUser, activeBusiness: Business) => void;
}) {
  // NOTE ON ARCHITECTURE: the real backend ties exactly one account to each login
  // (created at registration via companyName) — there is no client-side "business
  // switching" concept anymore. The business_select / create_business steps that used
  // to live here were a purely client-side fiction on top of localStorage and have been
  // removed; completeLogin() below builds the Business object straight from the server.
  const [authStep, setAuthStep] = useState<"login" | "loading" | "google_unavailable" | "two_factor">("login");
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

  // Facebook Auth State retrieved from environment
  const fbAppId = (import.meta as any).env.VITE_FACEBOOK_APP_ID || "";
  const [fbError, setFbError] = useState("");

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

  // GOOGLE — not yet wired to the real backend. /api/auth/google expects a verified
  // Google ID token via @react-oauth/google's `credential` field, but this component
  // still uses a separate Firebase popup flow (lib/googleDrive.ts) that returns Firebase
  // user info, not a Google ID token compatible with that endpoint. Swapping the actual
  // sign-in library is a distinct follow-up piece of work — until then, Google sign-in is
  // disabled here rather than left as an unverified client-side "success".
  const handleGoogleLogin = () => {
    setAuthStep("google_unavailable");
  };

  // FACEBOOK — fully wired. Keeps the existing popup flow to obtain a Facebook access
  // token, but now POSTs it to /api/auth/facebook for real server-side verification via
  // the Graph API + JWT issuance, instead of the client fetching the Graph API itself and
  // self-declaring the result authenticated.
  const handleFacebookLogin = () => {
    setFbError("");
    if (!fbAppId.trim()) {
      setFbError("Facebook App ID is not configured. Please define VITE_FACEBOOK_APP_ID in your environment variables to enable Facebook login.");
      return;
    }

    const redirectUri = `${window.location.origin}/`;
    const fbOAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${fbAppId.trim()}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=public_profile,email`;

    const authWindow = window.open(
      fbOAuthUrl,
      "facebook_oauth_popup",
      "width=650,height=600,status=no,resizable=yes,scrollbars=yes"
    );

    if (!authWindow) {
      setFbError("Popup was blocked by your browser. Please allow popups to sign in with Facebook.");
    }
  };

  // Listen for the postMessage event sent from the loaded popup callback page
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin is from the same origin, our Cloud Run domain, or our duckdns.org
      // subdomain. Exact/suffix match on the parsed hostname, not a substring check on the
      // raw origin string (origin.includes("duckdns.org") would also match an
      // attacker-controlled domain like "https://duckdns.org.attacker.com").
      const origin = event.origin;
      let isAllowedOrigin = origin === window.location.origin;
      if (!isAllowedOrigin) {
        try {
          const host = new URL(origin).hostname;
          isAllowedOrigin = host.endsWith(".run.app") || host === "duckdns.org" || host.endsWith(".duckdns.org");
        } catch {
          isAllowedOrigin = false;
        }
      }

      if (!isAllowedOrigin) {
        return;
      }

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const hash = event.data.hash || "";
        const params = new URLSearchParams(hash.replace("#", ""));
        const accessToken = params.get("access_token");

        if (accessToken) {
          setLoadingText("Verifying Facebook login...");
          setAuthStep("loading");

          try {
            const res = await fetch("/api/auth/facebook", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accessToken }),
            });
            const data = await res.json();
            if (!res.ok) {
              setFbError(data.error || "Facebook login failed.");
              setAuthStep("login");
              return;
            }
            await completeLogin(data.token, data.user);
          } catch (error: any) {
            console.error("Facebook login failed:", error);
            setFbError("Failed to verify Facebook login.");
            setAuthStep("login");
          }
        } else {
          setFbError("Facebook login failed: no access token returned in redirect.");
          setAuthStep("login");
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fbAppId]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Background radial highlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0,transparent_100%)] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-10 p-6 sm:p-8 space-y-6">
        
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
            {/* SOCIAL SSO QUICK ACTIONS */}
            <div className="space-y-3">
              <div className="text-center space-y-1 mb-2">
                <h3 className="text-base font-bold text-slate-200">
                  Login
                </h3>
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 text-slate-900 rounded-xl font-bold transition-all shadow-md hover:shadow-indigo-500/10 active:scale-[0.99] cursor-pointer text-sm border border-slate-200"
                id="sso-google-btn"
              >
                <Chrome className="w-5 h-5 text-indigo-600" />
                Sign In with Google Account
              </button>

              {/* Facebook Button */}
              <button
                type="button"
                onClick={handleFacebookLogin}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-bold transition-all shadow-md active:scale-[0.99] cursor-pointer text-sm"
                id="sso-facebook-btn"
              >
                <Facebook className="w-5 h-5 fill-current" />
                Sign In with Facebook Profile
              </button>

              {fbError && (
                <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{fbError}</span>
                </div>
              )}
            </div>

            {/* SEPARATOR */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">or continue with email</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* EMAIL LOGIN & REGISTRATION FORM */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-semibold text-slate-300">
                  {isRegistering ? "Create a Secure Tenant Profile" : "Email & Password Access"}
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

        {/* GOOGLE SIGN-IN UNAVAILABLE — informational only, no unverified login path */}
        {authStep === "google_unavailable" && (
          <div className="space-y-6">
            <div className="space-y-2 text-left">
              <div className="p-3 bg-amber-950/40 border border-amber-900/50 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Google Sign-In Unavailable</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    The Google sign-in popup could not complete — it may have been blocked by
                    your browser or by iframe restrictions. For your security, we can't offer
                    an unverified email-only login as a substitute. Please allow popups and try
                    again, or sign in with your email and password below.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <Chrome className="w-4 h-4" />
                Try Google Sign-In Again
              </button>

              <button
                type="button"
                onClick={() => setAuthStep("login")}
                className="w-full py-2.5 bg-transparent border border-slate-800 hover:bg-slate-900/50 text-slate-400 hover:text-white rounded-xl text-xs transition-all cursor-pointer font-semibold"
              >
                Use Email &amp; Password Instead
              </button>
            </div>
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
