import { useEffect, useState } from "react";
import { DashboardClient } from "../lib/dashboardClient.js";

const s: Record<string, React.CSSProperties> = {
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 10px", background: "#1a1a1a", borderRadius: 6, marginBottom: 6, fontSize: 13,
  },
  prefix: { color: "#e0e0e0", fontFamily: "ui-monospace, monospace" },
  meta: { color: "#666", fontSize: 11, marginLeft: 8 },
  removeBtn: { background: "none", border: "none", color: "#a44", cursor: "pointer", fontSize: 12 },
  button: { background: "#2a6ecf", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, marginTop: 8 },
  tokenBox: {
    background: "#111", border: "1px solid #2a6ecf", color: "#8ab4f8", borderRadius: 6,
    padding: "8px 10px", fontSize: 12, marginTop: 8, wordBreak: "break-all", cursor: "pointer",
  },
  help: { color: "#666", fontSize: 12, marginTop: 4 },
};

interface Token { id: string; tokenPrefix: string; label: string; createdAt: string; lastUsedAt: string | null }

export function RegistrationTokensPanel({
  client, orgId, domainId, myRole,
}: { client: DashboardClient; orgId: string; domainId: string; myRole: string }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const canManage = myRole === "owner" || myRole === "admin";

  async function load() {
    const r = await client.listRegistrationTokens(orgId, domainId);
    setTokens(r.tokens);
  }

  useEffect(() => { void load(); }, [domainId]);

  async function create() {
    const result = await client.createRegistrationToken(orgId, domainId);
    setNewToken(result.token);
    await load();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this token? Anything using it will stop being able to self-register.")) return;
    await client.revokeRegistrationToken(orgId, domainId, id);
    await load();
  }

  return (
    <div>
      <div style={s.help}>
        Lets agents self-register on this domain with a chosen local part
        (<code>POST /v1/agents/register</code> with <code>domainToken</code> + <code>localPart</code>),
        instead of an admin creating each inbox by hand above.
      </div>
      {tokens.map((t) => (
        <div key={t.id} style={s.row}>
          <span>
            <span style={s.prefix}>{t.tokenPrefix}…</span>
            <span style={s.meta}>
              {t.label || "unlabeled"} · {t.lastUsedAt ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : "never used"}
            </span>
          </span>
          {canManage && <button style={s.removeBtn} onClick={() => revoke(t.id)}>revoke</button>}
        </div>
      ))}
      {canManage && <button style={s.button} onClick={create}>Create registration token</button>}
      {newToken && (
        <div style={s.tokenBox} title="Click to copy" onClick={() => navigator.clipboard.writeText(newToken)}>
          Token created (shown once — click to copy):<br />{newToken}
        </div>
      )}
    </div>
  );
}
