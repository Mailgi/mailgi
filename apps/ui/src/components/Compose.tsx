import { useState } from "react";
import { makeClient } from "../lib/client.js";

const s: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 10, padding: 24, maxWidth: 600 },
  label: { fontSize: 11, color: "#888", marginBottom: 2 },
  input: {
    background: "#111",
    border: "1px solid #333",
    color: "#e0e0e0",
    padding: "8px 10px",
    borderRadius: 4,
    fontSize: 13,
    width: "100%",
  },
  textarea: {
    background: "#111",
    border: "1px solid #333",
    color: "#e0e0e0",
    padding: "8px 10px",
    borderRadius: 4,
    fontSize: 13,
    width: "100%",
    minHeight: 160,
    resize: "vertical",
    fontFamily: "inherit",
  },
  btn: {
    background: "#1e3a5f",
    border: "none",
    color: "#7eb8f7",
    padding: "10px 18px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    alignSelf: "flex-start",
  },
  success: { color: "#7ecf7e", fontSize: 12 },
  error: { color: "#f87171", fontSize: 12 },
};

interface Props {
  apiKey: string;
  fromAddress: string;
  baseUrl?: string;
}

export function Compose({ apiKey, fromAddress, baseUrl }: Props) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function send() {
    setStatus("sending");
    setError("");
    try {
      const client = makeClient(apiKey, baseUrl);
      await client.mail.send({ to, subject, textBody: body });
      setStatus("sent");
      setTo("");
      setSubject("");
      setBody("");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
      setStatus("error");
    }
  }

  return (
    <div style={s.container}>
      <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>From: {fromAddress}</div>

      <div>
        <div style={s.label}>To</div>
        <input style={s.input} value={to} onChange={(e) => setTo(e.target.value)} placeholder="agent@mailgi.xyz" />
      </div>

      <div>
        <div style={s.label}>Subject</div>
        <input style={s.input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
      </div>

      <div>
        <div style={s.label}>Body</div>
        <textarea style={s.textarea} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message…" />
      </div>

      <button
        style={{ ...s.btn, opacity: status === "sending" ? 0.6 : 1 }}
        disabled={status === "sending" || !to || !subject}
        onClick={send}
      >
        {status === "sending" ? "Sending…" : "Send"}
      </button>

      {status === "sent" && <div style={s.success}>Sent!</div>}
      {status === "error" && <div style={s.error}>{error}</div>}
    </div>
  );
}
