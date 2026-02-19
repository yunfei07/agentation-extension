import { createRoot } from "react-dom/client";

import { RUNTIME_CONFIG } from "../shared/runtime-config";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Popup root element was not found");
}

function Popup(): JSX.Element {
  return (
    <main
      style={{
        width: "360px",
        padding: "14px",
        fontFamily:
          "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: "16px" }}>FlowMarker Extension</h2>
      <p style={{ marginTop: "8px", marginBottom: "12px", fontSize: "12px" }}>
        Runtime configuration is loaded from <code>backend/.env</code> at build
        time.
      </p>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "10px",
          fontSize: "12px",
          lineHeight: 1.5,
        }}
      >
        <div>
          <strong>FastAPI Backend URL:</strong> {RUNTIME_CONFIG.backendUrl}
        </div>
        <div>
          <strong>Model:</strong> {RUNTIME_CONFIG.model}
        </div>
        <div>
          <strong>Temperature:</strong> {RUNTIME_CONFIG.temperature}
        </div>
        <div>
          <strong>MCP Endpoint:</strong> {RUNTIME_CONFIG.mcpEndpoint}
        </div>
      </div>

      <ol style={{ marginTop: "12px", marginBottom: 0, paddingLeft: "18px", fontSize: "12px" }}>
        <li>Edit values in <code>backend/.env</code>.</li>
        <li>Run <code>pnpm extension:build</code>.</li>
        <li>Reload the unpacked extension in Chrome.</li>
      </ol>
    </main>
  );
}

createRoot(rootEl).render(<Popup />);
