import { useEffect, useState } from "react";
import { DashboardClient, type DomainDetail as DomainDetailData } from "../lib/dashboardClient.js";
import { InboxesPanel } from "./InboxesPanel.js";
import { RegistrationTokensPanel } from "./RegistrationTokensPanel.js";

const s: Record<string, React.CSSProperties> = {
  heading: { fontSize: 16, color: "#e0e0e0", marginBottom: 4 },
  status: { fontSize: 13, marginBottom: 16 },
  ok: { color: "#4caf50" },
  pending: { color: "#e6a23c" },
  recordsWrap: { marginBottom: 20 },
  record: { background: "#1a1a1a", borderRadius: 6, padding: "10px 12px", marginBottom: 8, fontSize: 12 },
  recordHeader: { display: "flex", justifyContent: "space-between", color: "#888", marginBottom: 4 },
  recordCheck: { fontSize: 11 },
  mono: {
    fontFamily: "ui-monospace, monospace", color: "#e0e0e0", background: "#111",
    padding: "6px 8px", borderRadius: 4, wordBreak: "break-all", cursor: "pointer",
  },
  button: {
    background: "#2a6ecf", border: "none", color: "#fff", padding: "8px 16px",
    borderRadius: 6, cursor: "pointer", fontSize: 13, marginBottom: 16,
  },
  danger: { background: "#7a2020", border: "none", color: "#fff", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 },
  detail: { color: "#666", fontSize: 11, marginTop: 8 },
  section: { marginTop: 24, paddingTop: 16, borderTop: "1px solid #262626" },
  sectionHeading: { fontSize: 13, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
};

export function DomainDetail({
  client, orgId, domainId, myRole,
}: { client: DashboardClient; orgId: string; domainId: string; myRole: string }) {
  const [domain, setDomain] = useState<DomainDetailData | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ txtDetail: string; mxDetail: string } | null>(null);
  const canManage = myRole === "owner" || myRole === "admin";

  async function load() {
    setDomain(await client.getDomain(orgId, domainId));
  }

  useEffect(() => { void load(); }, [domainId]);

  async function recheck() {
    setChecking(true);
    try {
      const result = await client.verifyDomain(orgId, domainId);
      setDomain(result);
      setCheckResult(result.checks);
    } finally {
      setChecking(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${domain?.domain}? This only works if no inboxes use it.`)) return;
    try {
      await client.removeDomain(orgId, domainId);
      history.back();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove domain");
    }
  }

  if (!domain) return <div style={{ color: "#666", fontSize: 13 }}>Loading…</div>;

  return (
    <div>
      <div style={s.heading}>{domain.domain}</div>
      <div style={{ ...s.status, ...(domain.verified ? s.ok : s.pending) }}>
        {domain.verified ? "✓ Verified — receiving mail" : "Pending verification"}
      </div>

      {!domain.verified && (
        <div style={s.recordsWrap}>
          <div style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>
            Publish these DNS records at your domain registrar, then recheck:
          </div>
          {domain.records.map((r) => (
            <div key={r.name + r.type} style={s.record}>
              <div style={s.recordHeader}>
                <span>{r.type} — {r.purpose}</span>
                <span style={s.recordCheck}>
                  {r.type === "TXT" && (domain.txtOk ? <span style={s.ok}>✓ found</span> : <span style={s.pending}>not found</span>)}
                  {r.type === "MX" && (domain.mxOk ? <span style={s.ok}>✓ found</span> : <span style={s.pending}>not found</span>)}
                </span>
              </div>
              <div style={{ marginBottom: 4 }}>
                Name: <span style={s.mono} onClick={() => navigator.clipboard.writeText(r.name)}>{r.name}</span>
              </div>
              <div>
                Value: <span style={s.mono} onClick={() => navigator.clipboard.writeText(r.value)}>
                  {r.value}{r.priority !== undefined ? ` (priority ${r.priority})` : ""}
                </span>
              </div>
            </div>
          ))}
          {canManage && (
            <button style={s.button} onClick={recheck} disabled={checking}>
              {checking ? "Checking…" : "Recheck DNS"}
            </button>
          )}
          {checkResult && (
            <div style={s.detail}>
              TXT: {checkResult.txtDetail}<br />MX: {checkResult.mxDetail}
            </div>
          )}
        </div>
      )}

      {domain.verified && (
        <>
          <div style={s.section}>
            <div style={s.sectionHeading}>Inboxes</div>
            <InboxesPanel client={client} orgId={orgId} domainId={domainId} domain={domain.domain} myRole={myRole} />
          </div>
          <div style={s.section}>
            <div style={s.sectionHeading}>Registration tokens</div>
            <RegistrationTokensPanel client={client} orgId={orgId} domainId={domainId} myRole={myRole} />
          </div>
        </>
      )}

      {canManage && (
        <div style={s.section}>
          <button style={s.danger} onClick={remove}>Remove domain</button>
        </div>
      )}
    </div>
  );
}
