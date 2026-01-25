"use client";

import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";

function ToolName({ children }: { children: string }) {
  return (
    <h3 style={{ fontFamily: "'SF Mono', monospace", fontSize: "0.75rem", letterSpacing: "-0.01em" }}>
      {children}
    </h3>
  );
}

export default function McpPage() {
  return (
    <>
      <article className="article">
        <header>
          <h1>MCP Server</h1>
          <p className="tagline">
            Connect AI agents to web page annotations via the Model Context Protocol
          </p>
        </header>

        <section>
          <h2 id="overview">Overview</h2>
          <p>
            The <code>agentation-mcp</code> package provides an MCP server that allows AI coding agents
            (like Claude Code) to receive and respond to web page annotations created with the Agentation toolbar.
            This bypasses copy-paste entirely &mdash; just annotate and talk to your agent. It already has full context.
          </p>
          <p>
            It runs both an <strong>HTTP server</strong> (for the browser toolbar) and an{" "}
            <strong>MCP server</strong> (for agents via stdio), sharing the same data store.
          </p>
          <p style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            <code>toolbar</code> → <code>server</code> → <code>agent</code>
          </p>
        </section>

        <section>
          <h2 id="installation">Installation</h2>
          <CodeBlock
            language="bash"
            copyable
            code={`npm install agentation-mcp
# or
pnpm add agentation-mcp`}
          />
        </section>

        <section>
          <h2 id="quick-start">Quick Start</h2>

          <h3>1. Set up the MCP server</h3>
          <p>Run the interactive setup wizard:</p>
          <CodeBlock language="bash" copyable code={`npx agentation-mcp init`} />
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)", marginTop: "0.5rem" }}>
            This configures Claude Code to use the Agentation MCP server.
          </p>

          <h3>2. Start the server</h3>
          <CodeBlock language="bash" copyable code={`npx agentation-mcp server`} />
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)", marginTop: "0.5rem" }}>
            This starts both the HTTP server (port 4747) and MCP server (stdio).
          </p>

          <h3>3. Verify your setup</h3>
          <CodeBlock language="bash" copyable code={`npx agentation-mcp doctor`} />
        </section>

        <section>
          <h2 id="cli-commands">CLI Commands</h2>
          <CodeBlock
            language="bash"
            code={`npx agentation-mcp init                    # Interactive setup wizard
npx agentation-mcp server [options]        # Start the annotation server
npx agentation-mcp doctor                  # Check your setup
npx agentation-mcp help                    # Show help`}
          />
        </section>

        <section>
          <h2 id="server-options">Server Options</h2>
          <CodeBlock
            language="bash"
            code={`--port <port>      # HTTP server port (default: 4747)
--mcp-only         # Skip HTTP server, only run MCP on stdio
--http-url <url>   # HTTP server URL for MCP to fetch from
--api-key <key>    # API key for cloud authentication`}
          />
        </section>

        <section>
          <h2 id="cloud-mode">Cloud Mode</h2>
          <p>
            Connect to the Agentation cloud backend instead of running a local HTTP server:
          </p>
          <CodeBlock
            language="bash"
            copyable
            code={`npx agentation-mcp server --mcp-only --http-url https://agentation-mcp-cloud.vercel.app --api-key ag_xxx`}
          />
          <p style={{ marginTop: "0.75rem" }}>Or using an environment variable:</p>
          <CodeBlock
            language="bash"
            copyable
            code={`AGENTATION_API_KEY=ag_xxx npx agentation-mcp server --mcp-only --http-url https://agentation-mcp-cloud.vercel.app`}
          />
        </section>

        <section>
          <h2 id="claude-code">Claude Code</h2>
          <p>
            To connect Claude Code to the Agentation MCP server:
          </p>

          <h3>1. Start the server</h3>
          <CodeBlock language="bash" copyable code={`npx agentation-mcp server`} />

          <h3>2. Add the MCP server to Claude Code</h3>
          <CodeBlock language="bash" copyable code={`claude mcp add http://localhost:4747/mcp`} />
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)", marginTop: "0.5rem" }}>
            This registers the Agentation MCP server with Claude Code. Once connected, Claude can
            use all the Agentation tools to read and respond to your annotations.
          </p>

          <h3>3. Verify the connection</h3>
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            In Claude Code, you can verify the server is connected by asking Claude to list your
            annotation sessions. If the server is running, Claude will be able to use the{" "}
            <code>agentation_list_sessions</code> tool.
          </p>
        </section>

        <section>
          <h2 id="mcp-tools">MCP Tools</h2>
          <p>
            Nine tools are exposed to AI agents via the{" "}
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">
              Model Context Protocol
            </a>:
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", marginTop: "1rem", marginBottom: "1.5rem" }}>
            <thead>
              <tr>
                <th style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.1)", textAlign: "left", fontWeight: 500 }}>Tool</th>
                <th style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.1)", textAlign: "left", fontWeight: 500 }}>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>agentation_list_sessions</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>List all active annotation sessions</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>agentation_get_session</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Get a session with all its annotations</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>agentation_get_pending</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Get pending annotations for a session</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>agentation_get_all_pending</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Get pending annotations across all sessions</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>agentation_acknowledge</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Mark an annotation as acknowledged</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>agentation_resolve</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Mark an annotation as resolved</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>agentation_dismiss</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Dismiss an annotation with a reason</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>agentation_reply</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Add a reply to an annotation thread</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem" }}>agentation_wait_for_action</td>
                <td style={{ padding: "0.375rem 0", color: "rgba(0,0,0,0.6)" }}>Block until user clicks &ldquo;Send to Agent&rdquo;</td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: "1.5rem" }}>Tool Details</h3>

          <ToolName>agentation_list_sessions</ToolName>
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            List all active annotation sessions. Use this to discover which pages have feedback.
          </p>

          <ToolName>agentation_get_session</ToolName>
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            Get a session with all its annotations. Input: <code>sessionId</code>
          </p>

          <ToolName>agentation_get_pending</ToolName>
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            Get all pending (unacknowledged) annotations for a session. Use this to see what feedback
            needs attention. Input: <code>sessionId</code>
          </p>
          <CodeBlock
            language="json"
            code={`// Response
{
  "count": 1,
  "annotations": [{
    "id": "ann_123",
    "comment": "Button is cut off on mobile",
    "element": "button",
    "elementPath": "body > main > .hero > button.cta",
    "reactComponents": "App > LandingPage > HeroSection > Button",
    "intent": "fix",
    "severity": "blocking"
  }]
}`}
          />

          <ToolName>agentation_get_all_pending</ToolName>
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            Get all pending annotations across ALL sessions. Use this to see all unaddressed feedback
            from the human across all pages.
          </p>

          <ToolName>agentation_acknowledge</ToolName>
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            Mark an annotation as acknowledged. Use this to let the human know you&apos;ve seen their
            feedback and will address it. Input: <code>annotationId</code>
          </p>

          <ToolName>agentation_resolve</ToolName>
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            Mark an annotation as resolved. Use this after you&apos;ve addressed the feedback. Optionally
            include a summary of what you did. Input: <code>annotationId</code>, optional <code>summary</code>
          </p>

          <ToolName>agentation_dismiss</ToolName>
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            Dismiss an annotation. Use this when you&apos;ve decided not to address the feedback, with a
            reason why. Input: <code>annotationId</code>, <code>reason</code>
          </p>

          <ToolName>agentation_reply</ToolName>
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            Add a reply to an annotation&apos;s thread. Use this to ask clarifying questions or provide
            updates to the human. Input: <code>annotationId</code>, <code>message</code>
          </p>

          <ToolName>agentation_wait_for_action</ToolName>
          <p style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            Block until the user clicks &ldquo;Send to Agent&rdquo; in the browser. Returns the action request
            with all annotations and formatted output. Use this to receive push-like notifications instead
            of polling. Input: optional <code>sessionId</code>, optional <code>timeoutSeconds</code> (default: 60, max: 300)
          </p>
        </section>

        <section>
          <h2 id="http-api">HTTP API</h2>
          <p>
            The HTTP server provides a REST API for the browser toolbar:
          </p>

          <h3 style={{ marginTop: "1.25rem" }}>Sessions</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
            <tbody>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem", width: "5rem", color: "rgba(0,0,0,0.4)" }}>POST</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>/sessions</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Create a new session</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem", color: "rgba(0,0,0,0.4)" }}>GET</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>/sessions</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>List all sessions</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem", color: "rgba(0,0,0,0.4)" }}>GET</td>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem" }}>/sessions/:id</td>
                <td style={{ padding: "0.375rem 0", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Get session with annotations</td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: "1.25rem" }}>Annotations</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
            <tbody>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem", width: "5rem", color: "rgba(0,0,0,0.4)" }}>POST</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>/sessions/:id/annotations</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Add annotation</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem", color: "rgba(0,0,0,0.4)" }}>GET</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>/annotations/:id</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Get annotation</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem", color: "rgba(0,0,0,0.4)" }}>PATCH</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>/annotations/:id</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Update annotation</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem", color: "rgba(0,0,0,0.4)" }}>DELETE</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>/annotations/:id</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Delete annotation</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem", color: "rgba(0,0,0,0.4)" }}>GET</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>/sessions/:id/pending</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Get pending annotations</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem", color: "rgba(0,0,0,0.4)" }}>GET</td>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem" }}>/pending</td>
                <td style={{ padding: "0.375rem 0", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Get all pending annotations</td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: "1.25rem" }}>Actions</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
            <tbody>
              <tr>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem", width: "5rem", color: "rgba(0,0,0,0.4)" }}>POST</td>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem" }}>/sessions/:id/action</td>
                <td style={{ padding: "0.375rem 0", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Request agent action</td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: "1.25rem" }}>Events (SSE)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
            <tbody>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem", width: "5rem", color: "rgba(0,0,0,0.4)" }}>GET</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>/sessions/:id/events</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Session event stream</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem", color: "rgba(0,0,0,0.4)" }}>GET</td>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem" }}>/events?domain=...</td>
                <td style={{ padding: "0.375rem 0", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Domain-wide event stream</td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: "1.25rem" }}>Health</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
            <tbody>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem", width: "5rem", color: "rgba(0,0,0,0.4)" }}>GET</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>/health</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Health check</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem", color: "rgba(0,0,0,0.4)" }}>GET</td>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem" }}>/status</td>
                <td style={{ padding: "0.375rem 0", color: "rgba(0,0,0,0.5)", textAlign: "right" }}>Server status</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 id="real-time-events">Real-Time Events</h2>
          <p>
            Subscribe to real-time events via Server-Sent Events:
          </p>
          <CodeBlock
            language="bash"
            code={`# Session-level: events for a single page
curl -N http://localhost:4747/sessions/:id/events

# Site-level: events across ALL pages for a domain
curl -N "http://localhost:4747/events?domain=localhost:3001"

# Reconnect after disconnect (replay missed events)
curl -N -H "Last-Event-ID: 42" http://localhost:4747/sessions/:id/events`}
          />
          <p style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "rgba(0,0,0,0.55)" }}>
            <strong>Event types:</strong>
          </p>
          <ul style={{ fontSize: "0.8125rem", color: "rgba(0,0,0,0.65)", marginTop: "0.25rem" }}>
            <li><code>annotation.created</code> &mdash; New annotation added</li>
            <li><code>annotation.updated</code> &mdash; Annotation modified (comment, status, etc.)</li>
            <li><code>annotation.deleted</code> &mdash; Annotation removed</li>
            <li><code>session.created</code> &mdash; New session started</li>
            <li><code>session.updated</code> &mdash; Session updated</li>
            <li><code>session.closed</code> &mdash; Session closed</li>
            <li><code>action.requested</code> &mdash; &ldquo;Send to Agent&rdquo; clicked</li>
            <li><code>thread.message</code> &mdash; New message in annotation thread</li>
          </ul>
        </section>

        <section>
          <h2 id="webhooks">Webhooks</h2>
          <p>
            Configure webhooks to receive notifications when users request agent action:
          </p>
          <CodeBlock
            language="bash"
            code={`# Single webhook
export AGENTATION_WEBHOOK_URL=https://your-server.com/webhook

# Multiple webhooks (comma-separated)
export AGENTATION_WEBHOOKS=https://server1.com/hook,https://server2.com/hook`}
          />
        </section>

        <section>
          <h2 id="environment-variables">Environment Variables</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", marginTop: "1rem" }}>
            <thead>
              <tr>
                <th style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.1)", textAlign: "left", fontWeight: 500 }}>Variable</th>
                <th style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.1)", textAlign: "left", fontWeight: 500 }}>Description</th>
                <th style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.1)", textAlign: "left", fontWeight: 500 }}>Default</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>AGENTATION_STORE</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Storage backend (<code>memory</code> or <code>sqlite</code>)</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>sqlite</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>AGENTATION_WEBHOOK_URL</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Single webhook URL</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.4)" }}>-</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>AGENTATION_WEBHOOKS</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Comma-separated webhook URLs</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.4)" }}>-</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>AGENTATION_EVENT_RETENTION_DAYS</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}>Days to keep events</td>
                <td style={{ padding: "0.375rem 0", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "monospace", fontSize: "0.6875rem" }}>7</td>
              </tr>
              <tr>
                <td style={{ padding: "0.375rem 0", fontFamily: "monospace", fontSize: "0.6875rem" }}>AGENTATION_API_KEY</td>
                <td style={{ padding: "0.375rem 0", color: "rgba(0,0,0,0.6)" }}>API key for cloud authentication</td>
                <td style={{ padding: "0.375rem 0", color: "rgba(0,0,0,0.4)" }}>-</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 id="programmatic-usage">Programmatic Usage</h2>
          <CodeBlock
            language="typescript"
            code={`import { startHttpServer, startMcpServer } from 'agentation-mcp';

// Start HTTP server on port 4747
startHttpServer(4747);

// Start MCP server (connects via stdio)
await startMcpServer('http://localhost:4747');`}
          />
        </section>

        <section>
          <h2 id="storage">Storage</h2>
          <p>
            By default, data is persisted to SQLite at <code>~/.agentation/store.db</code>. To use
            in-memory storage:
          </p>
          <CodeBlock
            language="bash"
            copyable
            code={`AGENTATION_STORE=memory npx agentation-mcp server`}
          />
        </section>

        <section>
          <h2 id="types">TypeScript Types</h2>
          <p>
            The package exports all types for use in your own integrations:
          </p>
          <CodeBlock
            language="typescript"
            code={`import type {
  Annotation,
  AnnotationIntent,    // "fix" | "change" | "question" | "approve"
  AnnotationSeverity,  // "blocking" | "important" | "suggestion"
  AnnotationStatus,    // "pending" | "acknowledged" | "resolved" | "dismissed"
  Session,
  SessionStatus,       // "active" | "approved" | "closed"
  SessionWithAnnotations,
  ThreadMessage,
  SAFEvent,
  SAFEventType,
  ActionRequest,
} from 'agentation-mcp';`}
          />
        </section>
      </article>

      <Footer />
    </>
  );
}
