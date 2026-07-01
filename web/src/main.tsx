import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import "./index.css";

const media = window.matchMedia("(prefers-color-scheme: dark)");
const applyTheme = (isDark: boolean) => document.documentElement.classList.toggle("dark", isDark);
applyTheme(media.matches);
media.addEventListener("change", (e) => applyTheme(e.matches));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
