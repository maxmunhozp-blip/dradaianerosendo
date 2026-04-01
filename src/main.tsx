import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Protect against browser extensions (Grammarly, translators) that modify DOM
// and cause "insertBefore" errors by conflicting with React's virtual DOM
const container = document.getElementById("root")!;
container.setAttribute("data-gramm", "false");
container.setAttribute("data-gramm_editor", "false");
container.setAttribute("data-enable-grammarly", "false");

const root = createRoot(container);
root.render(<App />);
