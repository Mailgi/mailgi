import { useEffect, useMemo, useState } from "react";
import { DashboardClient } from "./lib/dashboardClient.js";
import { useDashboardSession } from "./lib/useDashboard.js";
import { Login } from "./components/Login.js";
import { OrgPicker } from "./components/OrgPicker.js";
import { MembersPanel } from "./components/MembersPanel.js";
import { DomainsPanel } from "./components/DomainsPanel.js";

const s: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", height: "100%", color: "#e0e0e0" },
  topbar: {
    display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #2a2a2a",
    background: "#141414", height: 44, padding: "0 16px", fontSize: 13,
  },
  orgName: { fontWeight: 600 },
  switchLink: { color: "#8ab4f8", cursor: "pointer", fontSize: 12 },
  spacer: { flex: 1 },
  userEmail: { color: "#666", fontSize: 12 },
  logout: { background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 12 },
  tabs: { display: "flex", borderBottom: "1px solid #2a2a2a", background: "#141414" },
  tab: {
    background: "none", border: "none", color: "#666", padding: "10px 16px",
    cursor: "pointer", fontSize: 13, borderBottom: "2px solid transparent",
  },
  tabActive: { color: "#e0e0e0", borderBottomColor: "#4a9eff" },
  content: { flex: 1, overflow: "auto", padding: 20 },
  centered: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#666", fontSize: 13 },
  banner: { background: "#1a2e1a", color: "#8bc98b", padding: "8px 16px", fontSize: 13 },
};

type Tab = "members" | "domains";

export function Dashboard({ apiBaseUrl }: { apiBaseUrl: string }) {
  const client = useMemo(() => new DashboardClient({ baseUrl: apiBaseUrl }), [apiBaseUrl]);
  const { loading, user, orgs, refresh, logout } = useDashboardSession(client);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("domains");
  const [inviteBanner, setInviteBanner] = useState<string | null>(null);

  // Invite acceptance: an admin shares a link of the form
  // "<dashboard>/?invite=<token>". If a signed-in user lands here with that
  // param, accept it automatically rather than making them find a button.
  useEffect(() => {
    if (loading || !user) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (!token) return;
    client.acceptInvite(token)
      .then((result) => {
        setInviteBanner(`Joined ${result.org.name} as ${result.role}.`);
        window.history.replaceState({}, "", window.location.pathname);
        void refresh();
        setActiveOrgId(result.org.id);
      })
      .catch((err) => {
        setInviteBanner(err instanceof Error ? `Invite error: ${err.message}` : "Invite could not be accepted");
        window.history.replaceState({}, "", window.location.pathname);
      });
  }, [loading, user, client, refresh]);

  if (loading) return <div style={s.centered}>Loading…</div>;
  if (!user) return <Login client={client} />;

  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  if (!activeOrg) {
    return (
      <div style={s.wrap}>
        {inviteBanner && <div style={s.banner}>{inviteBanner}</div>}
        <div style={s.topbar}>
          <span style={s.userEmail}>{user.email}</span>
          <span style={s.spacer} />
          <button style={s.logout} onClick={logout}>Sign out</button>
        </div>
        <div style={s.content}>
          <OrgPicker client={client} orgs={orgs} onSelect={setActiveOrgId} onCreated={refresh} />
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {inviteBanner && <div style={s.banner}>{inviteBanner}</div>}
      <div style={s.topbar}>
        <span style={s.orgName}>{activeOrg.name}</span>
        <span style={s.switchLink} onClick={() => setActiveOrgId(null)}>switch org</span>
        <span style={s.spacer} />
        <span style={s.userEmail}>{user.email}</span>
        <button style={s.logout} onClick={logout}>Sign out</button>
      </div>
      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(tab === "domains" ? s.tabActive : {}) }} onClick={() => setTab("domains")}>
          Domains
        </button>
        <button style={{ ...s.tab, ...(tab === "members" ? s.tabActive : {}) }} onClick={() => setTab("members")}>
          Members
        </button>
      </div>
      <div style={s.content}>
        {tab === "domains" ? (
          <DomainsPanel client={client} orgId={activeOrg.id} myRole={activeOrg.role} />
        ) : (
          <MembersPanel client={client} orgId={activeOrg.id} myRole={activeOrg.role} dashboardUrl={window.location.origin} />
        )}
      </div>
    </div>
  );
}
