import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import "./index.css";

// Fetch Google client ID from backend (avoids hard-coding it in frontend build)
async function bootstrap() {
  let googleClientId = "";
  try {
    const res = await fetch("/api/auth/google/config");
    if (res.ok) {
      const cfg = await res.json();
      googleClientId = cfg.clientId || "";
    }
  } catch {
    // Non-fatal — Google login button will not render if ID is empty
  }

  // @react-oauth/google throws if clientId is an empty string. Provide a fallback.
  if (!googleClientId) googleClientId = "dummy_client_id";

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <GoogleOAuthProvider clientId={googleClientId}>
        <App />
      </GoogleOAuthProvider>
    </StrictMode>,
  );
}

bootstrap();
