"use client";

import * as React from "react";

/**
 * The last resort: the root layout itself threw, so there is no shell, no
 * providers, and no theme — this component replaces `<html>`.
 *
 * Which is why it carries its own inline styles and imports nothing. A
 * global error handler that depends on the stylesheet it is reporting the
 * failure of is not a handler.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[root]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f5f7",
          color: "#111318",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            background: "#fff",
            border: "1px solid #d8dbe1",
            borderTop: "3px solid #c0392b",
            borderRadius: "5px",
            padding: "28px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "10px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#6b7280",
            }}
          >
            {error.digest ? `Error · ${error.digest}` : "Error"}
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "6px" }}>
            The application could not start
          </div>
          <p
            style={{
              fontSize: "12.5px",
              lineHeight: 1.6,
              color: "#6b7280",
              marginTop: "8px",
            }}
          >
            Something failed before the interface could load. Your data is
            untouched — nothing here holds unsaved work.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "18px",
              cursor: "pointer",
              background: "#4169e1",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              padding: "9px 16px",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            Reload the application
          </button>
        </div>
      </body>
    </html>
  );
}
