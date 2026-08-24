import { useEffect, useState } from "react";
import { DashboardClient } from "../lib/dashboardClient.js";

const s: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  heading: { fontSize: 13, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 10px", background: "#1a1a1a", borderRadius: 6, marginBottom: 6, fontSize: 13,
  },
  email: { color: "#e0e0e0" },
  role: { color: "#666", fontSize: 12, marginLeft: 8 },
  removeBtn: { background: "none", border: "none", color: "#a44", cursor: "pointer", fontSize: 12 },
  form: { display: "flex", gap: 8, marginTop: 8 },
  input: {
    flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#e0e0e0",
    padding: "6px 10px", borderRadius: 6, fontSize: 13,
  },
  select: { background: "#1a1a1a", border: "1px solid #333", color: "#e0e0e0", borderRadius: 6, fontSize: 13 },
  button: { background: "#2a6ecf", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  linkBox: {
    background: "#111", border: "1px solid #2a6ecf", color: "#8ab4f8", borderRadius: 6,
    padding: "8px 10px", fontSize: 12, marginTop: 6, wordBreak: "break-all", cursor: "pointer",
  },
  error: { color: "#e66", fontSize: 12, marginTop: 6 },
};

interface Member { userId: string; email: string; name: string | null; role: string; joinedAt: string }
interface Invite { id: string; email: string; role: string; expiresAt: string; expired: boolean }

export function MembersPanel({
  client, orgId, myRole, dashboardUrl,
}: { client: DashboardClient; orgId: string; myRole: string; dashboardUrl: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = myRole === "owner" || myRole === "admin";

  async function load() {
    const [m, i] = await Promise.all([client.listMembers(orgId), client.listInvites(orgId)]);
    setMembers(m.members);
    setInvites(i.invites);
  }

  useEffect(() => { void load(); }, [orgId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    try {
      const result = await client.inviteMember(orgId, email.trim(), inviteRole);
      // Invite delivery by email is not wired yet -- the admin shares this
      // link manually (Slack, DM, etc.) until that lands.
      setLastInviteLink(`${dashboardUrl}/?invite=${result.token}`);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    }
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this member?")) return;
    await client.removeMember(orgId, userId);
    await load();
  }

  async function changeRole(userId: string, role: "owner" | "admin" | "member") {
    try {
      await client.changeMemberRole(orgId, userId, role);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change role");
    }
  }

  async function revokeInvite(id: string) {
    await client.revokeInvite(orgId, id);
    await load();
  }

  return (
    <div>
      <div style={s.section}>
        <div style={s.heading}>Members</div>
        {members.map((m) => (
          <div key={m.userId} style={s.row}>
            <span>
              <span style={s.email}>{m.name ?? m.email}</span>
              <span style={s.role}>{m.role}</span>
            </span>
            {canManage && (
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  style={s.select}
                  value={m.role}
                  onChange={(e) => changeRole(m.userId, e.target.value as "owner" | "admin" | "member")}
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </select>
                <button style={s.removeBtn} onClick={() => removeMember(m.userId)}>remove</button>
              </span>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <div style={s.section}>
          <div style={s.heading}>Pending invites</div>
          {invites.length === 0 && <div style={{ color: "#555", fontSize: 12 }}>None</div>}
          {invites.map((inv) => (
            <div key={inv.id} style={s.row}>
              <span>
                <span style={s.email}>{inv.email}</span>
                <span style={s.role}>{inv.role}{inv.expired ? " · expired" : ""}</span>
              </span>
              <button style={s.removeBtn} onClick={() => revokeInvite(inv.id)}>revoke</button>
            </div>
          ))}
          <form style={s.form} onSubmit={invite}>
            <input
              style={s.input} placeholder="email@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} type="email"
            />
            <select style={s.select} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}>
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <button style={s.button}>Invite</button>
          </form>
          {lastInviteLink && (
            <div
              style={s.linkBox}
              title="Click to copy"
              onClick={() => navigator.clipboard.writeText(lastInviteLink)}
            >
              Invite created. Share this link (email delivery isn't wired yet) — click to copy:
              <br />{lastInviteLink}
            </div>
          )}
          {error && <div style={s.error}>{error}</div>}
        </div>
      )}
    </div>
  );
}
