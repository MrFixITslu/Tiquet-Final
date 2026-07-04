import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Check if loaded inside an OAuth popup window
if (typeof window !== "undefined" && window.opener) {
  const hash = window.location.hash;
  const search = window.location.search;
  if (hash.includes("access_token=") || hash.includes("code=") || search.includes("code=")) {
    // Target the opener's own origin explicitly rather than "*" - the popup
    // and opener are always same-origin here (redirect_uri is our own
    // origin), so there's no reason to broadcast the access token to any
    // origin that happens to be listening.
    window.opener.postMessage({
      type: "OAUTH_AUTH_SUCCESS",
      hash,
      search
    }, window.location.origin);
    window.close();
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
