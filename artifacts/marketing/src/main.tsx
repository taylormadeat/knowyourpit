import { createRoot } from "react-dom/client";
import App from "./App";
import { redirectToCanonicalIfNeeded } from "@/lib/canonical";
import "./index.css";

if (!redirectToCanonicalIfNeeded()) {
  createRoot(document.getElementById("root")!).render(<App />);
}
