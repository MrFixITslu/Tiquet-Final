/**
 * SocialAuthButtons.tsx
 * Renders Google and Apple sign-in buttons.
 *
 * - Google: uses @react-oauth/google popup flow (no redirect).
 * - Apple: redirects to Apple → backend callback → frontend redirect.
 *
 * Both call onSuccess(token, user) on completion so the parent can call login().
 */
import React, { useEffect, useState } from "react";
import { useGoogleLogin, GoogleLogin } from "@react-oauth/google";
import FacebookLogin from "@greatsumini/react-facebook-login";

interface OAuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  account_id: string;
}

interface Props {
  onSuccess: (token: string, user: OAuthUser) => void;
  onError:   (message: string) => void;
  label?: "signin" | "signup";   // changes button wording only
}

// ── Apple config (fetched once) ───────────────────────────────────────────────
let appleConfigCache: { clientId: string | null; redirectUri: string; configured: boolean } | null = null;

async function getAppleConfig() {
  if (appleConfigCache) return appleConfigCache;
  try {
    const res = await fetch("/api/auth/apple/config");
    if (res.ok) {
      appleConfigCache = await res.json();
      return appleConfigCache!;
    }
  } catch { /* ignore */ }
  return { clientId: null, redirectUri: "", configured: false };
}

let fbConfigCache: { appId: string | null; configured: boolean } | null = null;
async function getFbConfig() {
  if (fbConfigCache) return fbConfigCache;
  try {
    const res = await fetch("/api/auth/facebook/config");
    if (res.ok) {
      fbConfigCache = await res.json();
      return fbConfigCache!;
    }
  } catch { /* ignore */ }
  return { appId: null, configured: false };
}

export function SocialAuthButtons({ onSuccess, onError, label = "signin" }: Props) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleReady,    setAppleReady]    = useState(false);
  const [appleLoading,  setAppleLoading]  = useState(false);
  const [fbReady,       setFbReady]       = useState(false);
  const [fbAppId,       setFbAppId]       = useState<string>("");
  const [fbLoading,     setFbLoading]     = useState(false);

  const verb = label === "signup" ? "up" : "in";

  // ── Show Apple button only if backend has Apple configured ────────────────
  useEffect(() => {
    getAppleConfig().then((cfg) => {
      if (cfg.configured && cfg.clientId) {
        // Inject the meta tag values Apple's SDK reads
        const metaId  = document.getElementById("appleid-signin-client-id")  as HTMLMetaElement | null;
        const metaUri = document.getElementById("appleid-signin-redirect-uri") as HTMLMetaElement | null;
        if (metaId)  metaId.content  = cfg.clientId!;
        if (metaUri) metaUri.content = cfg.redirectUri;
        setAppleReady(true);
      }
    });

    getFbConfig().then((cfg) => {
      if (cfg.configured && cfg.appId) {
        setFbAppId(cfg.appId);
        setFbReady(true);
      }
    });
  }, []);

  // ── Check for ?oauth_error from Apple callback ────────────────────────────
  useEffect(() => {
    const err = sessionStorage.getItem("oauth_error");
    if (err) {
      sessionStorage.removeItem("oauth_error");
      const MESSAGES: Record<string, string> = {
        missing_token:  "Sign in with Apple failed — no identity token received.",
        not_configured: "Apple Sign-In is not yet configured on this server.",
        invalid_token:  "Could not verify your Apple identity token. Please try again.",
        suspended:      "Your account has been suspended. Contact support.",
      };
      onError(MESSAGES[err] ?? "Sign in with Apple failed. Please try again.");
    }
  }, []);

  // ── Google: uses @react-oauth/google credential flow ─────────────────────
  const googleLogin = useGoogleLogin({
    flow:    "implicit",
    onSuccess: async (tokenResponse) => {
      // The implicit flow gives an access_token; exchange it for user info,
      // then send to backend. For the ID-token flow use CredentialResponse instead.
      // We use the auth-code flow via onNonOAuthError/onSuccess above.
      setGoogleLoading(false);
    },
    onError: () => {
      setGoogleLoading(false);
      onError("Google sign-in was cancelled or failed. Please try again.");
    },
  });

  // We use the credential (ID token) response via GoogleOAuthProvider's
  // useGoogleLogin with flow: "auth-code" which gives us code to exchange,
  // OR we can use the simpler GoogleLogin component.
  // Here we post the credential directly to our backend for verification.
  const handleGoogleCredential = async (credential: string) => {
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google sign-in failed");
      onSuccess(data.token, data.user);
    } catch (err: any) {
      onError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Facebook: verify access token on backend ──────────────────────────────
  const handleFacebookSuccess = async (response: any) => {
    if (!response.accessToken) return;
    setFbLoading(true);
    try {
      const res = await fetch("/api/auth/facebook", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ accessToken: response.accessToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Facebook sign-in failed");
      onSuccess(data.token, data.user);
    } catch (err: any) {
      onError(err.message || "Facebook sign-in failed. Please try again.");
    } finally {
      setFbLoading(false);
    }
  };

  // ── Apple: triggers Apple's redirect flow ─────────────────────────────────
  const handleApple = async () => {
    setAppleLoading(true);
    try {
      const cfg = await getAppleConfig();
      if (!cfg.configured || !cfg.clientId) {
        onError("Apple Sign-In is not configured on this server.");
        setAppleLoading(false);
        return;
      }
      // @ts-ignore — AppleID injected by SDK script in index.html
      const response = await window.AppleID.auth.signIn();
      // If popup flow is enabled, response contains authorization directly.
      // Here we use redirect (popup=false), so this won't fire — the redirect
      // goes to /api/auth/apple/callback which then redirects back with ?oauth_token.
    } catch (err: any) {
      if (err?.error !== "popup_closed_by_user") {
        onError("Apple sign-in failed. Please try again.");
      }
      setAppleLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Google Button ─────────────────────────────────────────────────── */}
      <div
        id="google-signin-wrapper"
        className="w-full"
        onClick={(e) => {
          // The GoogleLogin component renders inside this; we listen for its credential
          // via the callback on the rendered component below.
        }}
      >
        <GoogleSignInButton
          onCredential={handleGoogleCredential}
          loading={googleLoading}
          label={`Sign ${verb} with Google`}
        />
      </div>

      {/* ── Apple Button (only shown when configured) ─────────────────────── */}
      {appleReady && (
        <button
          type="button"
          onClick={handleApple}
          disabled={appleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-black hover:bg-zinc-900 text-white font-semibold rounded-xl border border-black transition-all shadow-sm disabled:opacity-60 cursor-pointer"
        >
          <AppleIcon />
          {appleLoading ? "Redirecting…" : `Sign ${verb} with Apple`}
        </button>
      )}

      {/* ── Facebook Button (only shown when configured) ──────────────────── */}
      {fbReady && (
        <FacebookLogin
          appId={fbAppId}
          onSuccess={handleFacebookSuccess}
          onFail={(error) => {
            console.error("Facebook Login Failed!", error);
            onError("Facebook sign-in was cancelled or failed. Please try again.");
          }}
          render={({ onClick }) => (
            <button
              type="button"
              onClick={onClick}
              disabled={fbLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold rounded-xl transition-all shadow-sm disabled:opacity-60 cursor-pointer"
            >
              <FacebookIcon />
              {fbLoading ? "Signing in…" : `Sign ${verb} with Facebook`}
            </button>
          )}
        />
      )}
    </div>
  );
}

// ── Inner GoogleSignInButton ──────────────────────────────────────────────────
// We use the lower-level useGoogleLogin hook so we can stay in control of styling.

function GoogleSignInButton({
  onCredential,
  loading,
  label,
}: {
  onCredential: (credential: string) => void;
  loading: boolean;
  label: string;
}) {
  const [showFallback, setShowFallback] = useState(false);

  // GoogleOAuthProvider renders the real Google button. If clientId is empty
  // (Google not configured), we'll get a script error and show nothing.
  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl z-10">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <GoogleLogin
        onSuccess={(credentialResponse) => {
          if (credentialResponse.credential) {
            onCredential(credentialResponse.credential);
          }
        }}
        onError={() => {
          setShowFallback(true);
        }}
        width="100%"
        text={label.includes("up") ? "signup_with" : "signin_with"}
        shape="rectangular"
        theme="outline"
        size="large"
      />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function AppleIcon() {
  return (
    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.69-1.12 1.84-.98 2.94 1.07.08 2.15-.49 2.81-1.33z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
