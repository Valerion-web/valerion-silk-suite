import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// The auth provider now signs in with the seeded admin credentials locally.
// This avoids relying on a stale JWT from Vite env during startup.

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
