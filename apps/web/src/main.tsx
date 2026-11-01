import "@fontsource-variable/jetbrains-mono";
import "./styles.css";
import "./theme/accents.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./app/App.tsx";

registerSW({ immediate: true });

const container = document.getElementById("root");

if (!container) {
  throw new Error("Missing #root element");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
