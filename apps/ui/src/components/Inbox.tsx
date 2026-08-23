import { useState, useEffect, useCallback } from "react";
import { makeClient } from "../lib/client.js";
import type { Email, EmailWithBody, Mailbox } from "@mailgi/mailgi";

const s: Record<string, React.CSSProperties> = {
  container: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: { width: 160, minWidth: 160, borderRight: "1px solid #2a2a2a", overflowY: "auto", padding: "8px 0" },
  sidebarItem: {
    padding: "7px 16px",
    cursor: "pointer",
    fontSize: 12,
    color: "#666",
    borderLeft: "2px solid transparent",
  },
  sidebarItemActive: { color: "#e0e0e0", borderLeft: "2px solid #4a9eff", background: "#161f2a" },
  list: { width: 280, minWidth: 280, borderRight: "1px solid #2a2a2a", overflowY: "auto" },
  listItem: {
    padding: "12px 16px",
    borderBottom: "1px solid #1e1e1e",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  listItemActive: { background: "#1e2a3a" },
  subject: { fontSize: 13, fontWeight: 500, color: "#e0e0e0", marginBottom: 3 },
  subjectUnseen: { color: "#fff", fontWeight: 700 },
  meta: { fontSize: 11, color: "#555" },
  reader: { flex: 1, overflowY: "auto", padding: 24 },
  readerHeader: { borderBottom: "1px solid #2a2a2a", paddingBottom: 16, marginBottom: 16 },
  readerSubject: { fontSize: 18, fontWeight: 600, marginBottom: 8 },
  readerMeta: { fontSize: 12, color: "#666" },
  body: { fontSize: 13, lineHeight: 1.7, color: "#ccc", whiteSpace: "pre-wrap" },
  empty: { padding: 24, color: "#444", fontSize: 13 },
  toolbar: { padding: "8px 16px", borderBottom: "1px solid #1e1e1e", display: "flex", gap: 8 },
  btn: {
    background: "none",
    border: "1px solid #333",
    color: "#888",
    padding: "4px 10px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
  },
};

// Stalwart role → display order
const ROLE_ORDER: Record<string, number> = { inbox: 0, sent: 1, drafts: 2, trash: 3, junk: 4 };

interface Props {
  apiKey: string;
  baseUrl?: string;
}

export function Inbox({ apiKey, baseUrl }: Props) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailboxId, setActiveMailboxId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [fullMessage, setFullMessage] = useState<EmailWithBody | null>(null);
  const [loading, setLoading] = useState(false);

  // Load mailboxes once per agent key, auto-select Inbox
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = makeClient(apiKey, baseUrl);
        const boxes = await client.mailboxes.list() as Mailbox[];
        const sorted = [...boxes].sort(
          (a, b) => (ROLE_ORDER[a.role ?? ""] ?? 99) - (ROLE_ORDER[b.role ?? ""] ?? 99),
        );
        if (cancelled) return;
        setMailboxes(sorted);
        const inbox = sorted.find((m) => m.role === "inbox");
        setActiveMailboxId(inbox?.id ?? sorted[0]?.id ?? null);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [apiKey]);

  const loadMessages = useCallback(async (mailboxId: string | null) => {
    if (!mailboxId) return;
    setLoading(true);
    setSelected(null);
    setFullMessage(null);
    try {
      const client = makeClient(apiKey, baseUrl);
      const result = await client.mail.list({ mailboxId, limit: 50 });
      setMessages(result.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    loadMessages(activeMailboxId);
  }, [activeMailboxId, loadMessages]);

  function switchMailbox(id: string) {
    setActiveMailboxId(id);
  }

  async function openMessage(msg: Email) {
    setSelected(msg);
    setFullMessage(null);
    try {
      const client = makeClient(apiKey, baseUrl);
      const full = await client.mail.get(msg.id);
      setFullMessage(full);
      if (!msg.seen) {
        await client.mail.setFlags(msg.id, { seen: true }).catch(() => {});
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, seen: true } : m)),
        );
      }
    } catch {
      setFullMessage(msg);
    }
  }

  async function deleteMessage(id: string) {
    try {
      const client = makeClient(apiKey, baseUrl);
      await client.mail.delete(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selected?.id === id) {
        setSelected(null);
        setFullMessage(null);
      }
    } catch {
      // ignore
    }
  }

  function getBodyText(msg: EmailWithBody): string | null {
    if (typeof msg.textBody === "string") return msg.textBody;
    const part = Array.isArray(msg.textBody) ? msg.textBody[0] : undefined;
    const partId = typeof part === "object" ? part?.partId : undefined;
    if (partId && msg.bodyValues?.[partId]) {
      return msg.bodyValues[partId].value;
    }
    return null;
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  }

  const activeBox = mailboxes.find((m) => m.id === activeMailboxId);

  return (
    <div style={s.container}>
      {/* Mailbox sidebar */}
      <div style={s.sidebar}>
        {mailboxes.map((box) => (
          <div
            key={box.id}
            style={{
              ...s.sidebarItem,
              ...(box.id === activeMailboxId ? s.sidebarItemActive : {}),
            }}
            onClick={() => switchMailbox(box.id)}
          >
            {box.name}
            {(box.unreadEmails ?? 0) > 0 && (
              <span style={{ marginLeft: 4, color: "#4a9eff", fontSize: 10 }}>
                {box.unreadEmails}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Message list */}
      <div style={s.list}>
        <div style={s.toolbar}>
          <span style={{ fontSize: 11, color: "#555", flex: 1, alignSelf: "center" }}>
            {activeBox?.name ?? ""}
          </span>
          <button style={s.btn} onClick={() => loadMessages(activeMailboxId)} disabled={loading}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
        {messages.length === 0 && !loading && (
          <div style={s.empty}>No messages</div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...s.listItem,
              ...(selected?.id === msg.id ? s.listItemActive : {}),
            }}
            onClick={() => openMessage(msg)}
          >
            <div style={{ ...s.subject, ...(msg.seen ? {} : s.subjectUnseen) }}>
              {msg.subject || "(no subject)"}
            </div>
            <div style={s.meta}>
              {msg.from?.[0]?.email ?? "unknown"} · {formatDate(msg.receivedAt)}
            </div>
          </div>
        ))}
      </div>

      {/* Message reader */}
      <div style={s.reader}>
        {!selected && <div style={{ color: "#444", fontSize: 13 }}>Select a message</div>}
        {selected && (
          <>
            <div style={s.readerHeader}>
              <div style={s.readerSubject}>{selected.subject || "(no subject)"}</div>
              <div style={s.readerMeta}>
                From: {selected.from?.[0]?.email ?? "unknown"} · {formatDate(selected.receivedAt)}
              </div>
              <button
                style={{ ...s.btn, marginTop: 10, color: "#f87171", borderColor: "#5a2a2a" }}
                onClick={() => deleteMessage(selected.id)}
              >
                Move to Trash
              </button>
            </div>
            {fullMessage ? (
              <div style={s.body}>
                {getBodyText(fullMessage) ?? fullMessage.preview ?? "(no body)"}
              </div>
            ) : (
              <div style={s.empty}>Loading…</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
