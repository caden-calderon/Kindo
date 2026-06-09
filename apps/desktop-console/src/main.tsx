import { createRoot } from "react-dom/client";
import { DesktopApp } from "./app/DesktopApp.js";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(<DesktopApp />);
