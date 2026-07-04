import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Check, 
  Building2, 
  Shield, 
  PlusCircle, 
  ArrowRight, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Info,
  Facebook,
  Chrome
} from "lucide-react";
import { AuthenticatedUser, Business } from "../types";
import { googleSignIn } from "../lib/googleDrive";
import { api, ApiError } from "../lib/api";

export function AuthGate({
  onAuthComplete,
}: {
  onAuthComplete: (user: AuthenticatedUser, activeBusiness: Business) => void;
}) {
  const [authStep, setAuthStep] = useState<"login" | "loading" | "business_select" | "create_business">("login");
  const [loginTab, setLoginTab] = useState<"email" | "facebook" | "google">("email");
  const [loadingText, setLoadingText] = useState("");
  const [tempUser, setTempUser] = useState<AuthenticatedUser | null>(null);

  // Email Auth state
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Facebook Auth State retrieved from environment
  const fbAppId = (import.meta as any).env.VITE_FACEBOOK_APP_ID || "";
  const [fbError, setFbError] = useState("");

  // Form states for creating a new business
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessEmail, setNewBusinessEmail] = useState("");
  const [newBusinessPhone, setNewBusinessPhone] = useState("");
  const [newBusinessAddress, setNewBusinessAddress] = useState("");

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(false);

  // Once we have an authenticated session, load that user's businesses
  // from the server (source of truth is now the database, not localStorage).
  const loadBusinesses = async () => {
    setBusinessesLoading(true);
    try {
      const { businesses: loaded } = await api.listBusinesses();
      setBusinesses(loaded);
    } catch (err) {
      console.error("Failed to load businesses:", err);
      setErrorMessage(err instanceof ApiError ? err.message : "Failed to load your business divisions.");
    } finally {
      setBusinessesLoading(false);
    }
  };

  useEffect(() => {
    if (authStep === "business_select") {
      loadBusinesses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStep]);

  const handleSelectBusiness = (biz: Business) => {
    if (!tempUser) return;
    onAuthComplete(tempUser, biz);
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser || !newBusinessName.trim()) return;

    setErrorMessage("");
    try {
      const { business } = await api.createBusiness({
        name: newBusinessName,
        email: newBusinessEmail,
        phone: newBusinessPhone,
        address: newBusinessAddress,
      });
      // Auto login to the newly created business
      onAuthComplete(tempUser, business);
    } catch (err) {
      // The "1 business per subscription" limit is enforced server-side now,
      // so this also covers someone trying to bypass the old client-only check.
      setErrorMessage(err instanceof ApiError ? err.message : "Failed to create business.");
      setAuthStep("business_select");
    }
  };

  // EMAIL REGISTRATION & LOGIN HANDLERS - now backed by the real API,
  // with passwords hashed (bcrypt) and never touching localStorage.
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
      if (password.length < 8) {
        setErrorMessage("Password must be at least 8 characters.");
        return;
      }

      setLoadingText("Creating your secure account...");
      setAuthStep("loading");
      try {
        const { user } = await api.register(name, email, password);
        setSuccessMessage("Account created successfully!");
        setTempUser(user);
        setAuthStep("business_select");
      } catch (err) {
        setAuthStep("login");
        setErrorMessage(err instanceof ApiError ? err.message : "Failed to create account.");
      }
    } else {
      setLoadingText("Verifying credentials and loading workspace partitions...");
      setAuthStep("loading");
      try {
        const { user } = await api.login(email, password);
        setTempUser(user);
        setAuthStep("business_select");
      } catch (err) {
        setAuthStep("login");
        setErrorMessage(err instanceof ApiError ? err.message : "Invalid email or password.");
      }
    }
  };

  // ACTUAL GOOGLE POPUP LOGIN HANDLER
  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setLoadingText("Verifying Google SSO credentials and isolating your session...");
    setAuthStep("loading");
    try {
      const result = await googleSignIn();
      if (result && result.accessToken) {
        // The access token is verified server-side against Google's own
        // userinfo endpoint before we ever trust the profile it returns.
        const { user } = await api.oauthGoogle(result.accessToken);
        setTempUser(user);
        setAuthStep("business_select");
      } else {
        setAuthStep("login");
        setErrorMessage("Google Sign-In was cancelled or failed.");
      }
    } catch (err: any) {
      console.error("Google login failed:", err);
      setAuthStep("login");
      setErrorMessage(err instanceof ApiError ? err.message : err.message || "Failed to log in via Google SSO.");
    }
  };

  // ACTUAL FACEBOOK POPUP LOGIN HANDLER
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

  // Listen for the postMessage event sent from the loaded popup callback page.
  //
  // BUG FIX: this previously only accepted event.origin values ending in
  // ".run.app" or containing "localhost" - a hardcoded leftover from the
  // AI Studio/Cloud Run scaffold. On any other deployment (your own
  // Nginx/Linux server, a custom domain, etc.) the popup's message was
  // silently dropped and Facebook login just did nothing with no error.
  // The popup and this window are always the same origin (the OAuth
  // redirect_uri is window.location.origin), so we compare against that
  // directly instead of guessing at hosting providers.
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const hash = event.data.hash || "";
        const params = new URLSearchParams(hash.replace("#", ""));
        const accessToken = params.get("access_token");

        if (accessToken) {
          setLoadingText("Verifying Facebook credentials...");
          setAuthStep("loading");

          try {
            // Verified server-side against the Graph API - the frontend no
            // longer calls Facebook (and trusts its response) directly.
            const { user } = await api.oauthFacebook(accessToken);
            setTempUser(user);
            setAuthStep("business_select");
          } catch (error: any) {
            console.error("Facebook login failed:", error);
            setFbError(error instanceof ApiError ? error.message : "Failed to verify Facebook login.");
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

        {/* TENANT / BUSINESS SELECTOR */}
        {authStep === "business_select" && tempUser && (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest font-mono">Logged in as {tempUser.email}</p>
              <h2 className="text-lg font-bold text-white">Select Your Business Division</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                To guarantee zero overlap of critical customer information, payroll data, and operations, select or register your distinct workspace.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {businessesLoading && (
                <p className="text-xs text-slate-500 text-center py-4">Loading your business divisions...</p>
              )}
              {!businessesLoading && (() => {
                // These come from the server now, already scoped to this user.
                const filtered = businesses;
                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-6 px-4 border border-dashed border-slate-850 rounded-2xl bg-slate-900/30">
                      <p className="text-xs font-bold text-slate-400">No registered divisions found</p>
                      <p className="text-[10px] text-slate-500 mt-1">Please register a new division below to get started.</p>
                    </div>
                  );
                }
                return filtered.map((biz) => (
                  <button
                    type="button"
                    key={biz.id}
                    onClick={() => handleSelectBusiness(biz)}
                    className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition-all group active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-850 text-slate-300 rounded-lg flex items-center justify-center border border-slate-750 group-hover:bg-indigo-950 group-hover:text-indigo-400 transition-colors">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{biz.name}</p>
                        <p className="text-[10px] text-slate-400 tracking-wider">Business division</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-transform group-hover:translate-x-1" />
                  </button>
                ));
              })()}
            </div>

            <div className="pt-2">
              {(() => {
                const limitReached = businesses.length >= 1;
                
                if (limitReached) {
                  return (
                    <div className="space-y-3">
                      <div className="p-3 bg-indigo-950/40 border border-indigo-900/50 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white text-left">Subscription Limit Reached</p>
                          <p className="text-[10.5px] text-slate-400 text-left mt-0.5 leading-relaxed">
                            Your current subscription package allows registering exactly **1 business division**. To add more workspaces, please contact sales to upgrade.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-500 border border-slate-750/50 rounded-xl font-bold text-sm cursor-not-allowed opacity-60"
                      >
                        <Lock className="w-4 h-4" />
                        Register New Division (Limit Reached)
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    onClick={() => setAuthStep("create_business")}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer text-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Register New Custom Business
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* REGISTER NEW BUSINESS */}
        {authStep === "create_business" && tempUser && (
          <form onSubmit={handleCreateBusiness} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Create Isolated Tenant</h2>
              <p className="text-xs text-slate-500">
                Setup a secure, unique database partition for your business structure.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Business / Corporation Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  placeholder="e.g. Starlight Industries"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Billing Email
                </label>
                <input
                  type="email"
                  value={newBusinessEmail}
                  onChange={(e) => setNewBusinessEmail(e.target.value)}
                  placeholder="e.g. finance@starlight.com"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={newBusinessPhone}
                  onChange={(e) => setNewBusinessPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 000-1111"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Business Address
                </label>
                <textarea
                  value={newBusinessAddress}
                  onChange={(e) => setNewBusinessAddress(e.target.value)}
                  placeholder="e.g. 500 Star Road, Space City"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-white text-sm resize-none"
                />
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setAuthStep("business_select")}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 rounded-xl text-sm font-bold border border-slate-800 transition-all cursor-pointer text-center"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer text-center"
              >
                Create Workspace
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
