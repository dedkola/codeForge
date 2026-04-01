"use client";

import { useState, useEffect } from "react";

interface CodeServerPanelProps {
  url: string;
}

export default function CodeServerPanel({ url }: CodeServerPanelProps) {
  const codeServerUrl = url;

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Reset on url change
  useEffect(() => {
    setLoaded(false);
    setError(false);
    setTimedOut(false);
  }, [codeServerUrl]);

  // Iframe failures (TLS/CSP/frame policies) can be silent, so surface a timeout fallback.
  useEffect(() => {
    if (loaded || error) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setTimedOut(true);
    }, 12000);

    return () => window.clearTimeout(timeout);
  }, [loaded, error, codeServerUrl]);

  return (
    <>
      {/* Browser-chrome bar */}
      <div className="code-server-header">
        <span
          className={`status-dot ${!loaded ? "offline" : ""}`}
          title={loaded ? "Connected" : "Connecting…"}
        />
        <span className="code-server-url">{codeServerUrl}</span>

        <button
          id="reload-code-server-btn"
          title="Reload"
          onClick={() => {
            setLoaded(false);
            setError(false);
            const iframe = document.getElementById(
              "code-server-iframe",
            ) as HTMLIFrameElement | null;
            if (iframe) {
              // eslint-disable-next-line no-self-assign
              iframe.src = iframe.src;
            }
          }}
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
            // only cover the right panel area
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
            Connecting to code-server…
          </p>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 11,
              maxWidth: 280,
              textAlign: "center",
            }}
          >
            Make sure code-server is running at{" "}
            <code style={{ fontSize: 11 }}>{codeServerUrl}</code>
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
                Open code-server in a new tab first, verify HTTPS cert is
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
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setTimedOut(false);
                    setLoaded(false);
                    setError(false);
                    const iframe = document.getElementById(
                      "code-server-iframe",
                    ) as HTMLIFrameElement | null;
                    if (iframe) {
                      // eslint-disable-next-line no-self-assign
                      iframe.src = iframe.src;
                    }
                  }}
                >
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
            Could not reach code-server
          </h3>
          <p
            style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 340 }}
          >
            Make sure the code-server pod is running and the URL is correct.
            <br />
            <code style={{ fontSize: 11 }}>{codeServerUrl}</code>
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
        allow="clipboard-read; clipboard-write"
        title="code-server VS Code environment"
      />
    </>
  );
}
