"use client";

import { useState, useEffect, useCallback } from "react";

interface CodeServerPanelProps {
  url: string | undefined;
  instanceStatus: "ready" | "starting" | "error";
}

export default function CodeServerPanel({
  url,
  instanceStatus,
}: CodeServerPanelProps) {
  const [codeServerUrl, setCodeServerUrl] = useState(url);
  const [status, setStatus] = useState(instanceStatus);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [prevUrl, setPrevUrl] = useState(url);

  // Reset iframe state on url change (derived state pattern)
  if (codeServerUrl !== prevUrl) {
    setPrevUrl(codeServerUrl);
    setLoaded(false);
    setError(false);
    setTimedOut(false);
  }

  // Poll for readiness when workspace is starting
  useEffect(() => {
    if (status !== "starting") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/code-server/status");
        const data = await res.json();
        if (data.status === "ready" && data.url) {
          setCodeServerUrl(data.url);
          setStatus("ready");
        } else if (data.status === "error") {
          setStatus("error");
        }
      } catch {
        // retry on next interval
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status]);

  // Iframe timeout fallback
  useEffect(() => {
    if (status !== "ready" || loaded || error) return;

    const timeout = window.setTimeout(() => {
      setTimedOut(true);
    }, 12000);

    return () => window.clearTimeout(timeout);
  }, [status, loaded, error, codeServerUrl]);

  const reloadIframe = useCallback(() => {
    setLoaded(false);
    setError(false);
    setTimedOut(false);
    const iframe = document.getElementById(
      "code-server-iframe",
    ) as HTMLIFrameElement | null;
    if (iframe) {
      iframe.src = codeServerUrl ?? iframe.src;
    }
  }, [codeServerUrl]);

  // "Setting up workspace" state
  if (status === "starting") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 16,
          background: "var(--bg-base)",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            border: "3px solid var(--border-default)",
            borderTopColor: "var(--accent-primary)",
            borderRadius: "50%",
          }}
          className="animate-spin"
        />
        <p
          style={{
            color: "var(--text-primary)",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Setting up your workspace…
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          This may take a moment on first visit
        </p>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 16,
          background: "var(--bg-base)",
        }}
      >
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Could not start your workspace
        </h3>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            maxWidth: 340,
            textAlign: "center",
          }}
        >
          There was a problem creating your code environment. Please try
          reloading the page.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          ↺ Reload page
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Browser-chrome bar */}
      <div className="code-server-header">
        <span
          className={`status-dot ${!loaded ? "offline" : ""}`}
          title={loaded ? "Connected" : "Connecting…"}
        />
        <span className="code-server-url">Your workspace</span>

        <button
          id="reload-code-server-btn"
          title="Reload"
          onClick={reloadIframe}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontSize: 14,
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
            transition: "color var(--transition-fast)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--text-primary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
        >
          ↺
        </button>

        <a
          href={codeServerUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in a new tab"
          style={{
            color: "var(--text-muted)",
            fontSize: 12,
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
            transition: "color var(--transition-fast)",
            textDecoration: "none",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--text-primary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
        >
          ↗
        </a>
      </div>

      {/* Loading overlay */}
      {!loaded && !error && (
        <div
          style={{
            position: "absolute",
            inset: "88px 0 0 0",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            background: "var(--bg-base)",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              border: "3px solid var(--border-default)",
              borderTopColor: "var(--accent-primary)",
              borderRadius: "50%",
            }}
            className="animate-spin"
          />
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Connecting to your workspace…
          </p>

          {timedOut && (
            <div
              style={{
                marginTop: 8,
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                maxWidth: 420,
                background: "var(--bg-surface)",
              }}
            >
              <p
                style={{
                  color: "var(--text-primary)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Still waiting. This is usually TLS, auth, or iframe policy.
              </p>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                Open the workspace in a new tab first, verify HTTPS cert is
                trusted, then reload.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <a
                  href={codeServerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <button className="btn btn-ghost">Open in new tab ↗</button>
                </a>
                <button className="btn btn-primary" onClick={reloadIframe}>
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="code-server-placeholder">
          <div className="placeholder-icon">🔌</div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>
            Could not reach your workspace
          </h3>
          <p
            style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 340 }}
          >
            Make sure the workspace pod is running and try again.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setError(false);
                setLoaded(false);
              }}
            >
              ↺ Retry
            </button>
            <a href={codeServerUrl} target="_blank" rel="noopener noreferrer">
              <button className="btn btn-ghost">Open in new tab ↗</button>
            </a>
          </div>
        </div>
      )}

      <iframe
        id="code-server-iframe"
        src={codeServerUrl}
        className="code-server-iframe"
        style={{ display: error ? "none" : "block" }}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setError(true);
          setTimedOut(false);
        }}
        allow="fullscreen"
        title="code-server VS Code environment"
      />
    </>
  );
}
