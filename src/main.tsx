import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Check if loaded inside an OAuth popup window
if (typeof window !== "undefined" && window.opener) {
  const hash = window.location.hash;
  const search = window.location.search;
  if (hash.includes("access_token=") || hash.includes("code=") || search.includes("code=")) {
    window.opener.postMessage({
      type: "OAUTH_AUTH_SUCCESS",
      hash,
      search
    }, "*");
    window.close();
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
