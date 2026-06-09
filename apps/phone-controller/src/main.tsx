import { createRoot } from "react-dom/client";
import { PhoneControllerApp } from "./app/PhoneControllerApp.js";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(<PhoneControllerApp />);
