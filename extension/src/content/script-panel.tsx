import React from "react";

type ScriptPanelProps = {
  annotationCount: number;
  generatedScript: string;
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
  onCopy: () => void;
  onDownload: () => void;
};

const panelStyle: React.CSSProperties = {
  position: "fixed",
  right: "16px",
  top: "16px",
  width: "360px",
  maxHeight: "70vh",
  overflow: "auto",
  zIndex: 2147483647,
  background: "#ffffff",
  color: "#111827",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.18)",
  padding: "12px",
  fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: "8px",
  background: "#0f766e",
  color: "#ffffff",
  fontWeight: 600,
  padding: "10px 12px",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  background: "#f9fafb",
  color: "#111827",
  padding: "8px 10px",
  cursor: "pointer",
};

export function ScriptPanel({
  annotationCount,
  generatedScript,
  isGenerating,
  error,
  onGenerate,
  onCopy,
  onDownload,
}: ScriptPanelProps): JSX.Element {
  return (
    <section style={panelStyle} data-testid="agentation-script-panel">
      <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>
        Playwright (Python) Generator
      </h3>
      <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#4b5563" }}>
        Annotations: {annotationCount}
      </p>

      <button type="button" style={buttonStyle} onClick={onGenerate} disabled={isGenerating}>
        {isGenerating ? "Generating..." : "Generate Playwright Script"}
      </button>

      {error ? (
        <p style={{ marginTop: "10px", fontSize: "12px", color: "#b91c1c" }}>{error}</p>
      ) : null}

      {generatedScript ? (
        <>
          <textarea
            readOnly
            value={generatedScript}
            style={{
              marginTop: "12px",
              width: "100%",
              minHeight: "200px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              padding: "10px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "12px",
            }}
          />
          <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
            <button type="button" style={secondaryButtonStyle} onClick={onCopy}>
              Copy
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={onDownload}>
              Download
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
