import { useState } from "react";
import type { StoredAgent } from "../hooks/useAgents.js";
import type { EnvName } from "../lib/environments.js";
import { makeClient, makeAnonClient } from "../lib/client.js";

const s: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 240,
    minWidth: 240,
    background: "#1a1a1a",
    borderRight: "1px solid #2a2a2a",
    display: "flex",
    flexDirection: "column",
    padding: 12,
    gap: 8,
    overflow: "hidden",
  },
  envRow: {
    display: "flex",
    gap: 4,
    marginBottom: 4,
  },
  envBtn: {
    flex: 1,
    background: "none",
    border: "1px solid #2a2a2a",
    color: "#555",
    padding: "4px 0",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
  },
  envBtnActive: {
    background: "#1e3a1e",
    border: "1px solid #3a6a3a",
    color: "#7ecf7e",
  },
  envLabel: { fontSize: 10, color: "#444", marginBottom: 2, textAlign: "center" as const },
  title: { fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  agentBtn: {
    background: "none",
    border: "none",
    color: "#ccc",
    padding: "8px 10px",
    borderRadius: 6,
    cursor: "pointer",
    textAlign: "left",
    fontSize: 13,
    lineHeight: 1.4,
  },
  agentBtnActive: { background: "#2a2a2a", color: "#fff" },
  tag: { fontSize: 10, color: "#555", display: "block", marginTop: 2 },
  divider: { borderColor: "#2a2a2a", margin: "8px 0" },
  btn: {
    background: "#1e3a5f",
    border: "none",
    color: "#7eb8f7",
    padding: "8px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    textAlign: "left",
  },
  input: {
    background: "#111",
    border: "1px solid #333",
    color: "#e0e0e0",
    padding: "6px 8px",
    borderRadius: 4,
    fontSize: 12,
    width: "100%",
  },
  error: { color: "#f87171", fontSize: 11, marginTop: 4 },
};

interface Props {
  agents: StoredAgent[];
  selected: StoredAgent | null;
  activeEnv: EnvName;
  envUrl: string;
  onSwitchEnv: (name: EnvName) => void;
  onSelect: (a: StoredAgent) => void;
  onAdd: (a: StoredAgent) => void;
  onRemove: (apiKey: string) => void;
}

type Mode = "idle" | "add" | "register";

export function AgentSidebar({ agents, selected, activeEnv, envUrl, onSwitchEnv, onSelect, onAdd, onRemove }: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    setError("");
    setLoading(true);
    try {
      const client = makeClient(apiKeyInput.trim(), envUrl);
      const me = await client.agents.me();
      onAdd({ apiKey: apiKeyInput.trim(), emailAddress: me.emailAddress, aliasAddress: me.aliasAddress ?? "", label: me.label || labelInput || me.emailAddress });
      setApiKeyInput("");
      setLabelInput("");
      setMode("idle");
    } catch {
      setError("Invalid API key or API unreachable.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError("");
    setLoading(true);
    try {
      const res = await makeAnonClient(envUrl).agents.register({ label: labelInput || undefined });
      onAdd({ apiKey: res.apiKey, emailAddress: res.emailAddress, aliasAddress: res.aliasAddress ?? "", label: labelInput || res.emailAddress });
      setLabelInput("");
      setMode("idle");
    } catch {
      setError("Registration failed. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.sidebar}>
      {/* Environment switcher */}
      <div>
        <div style={s.envLabel}>Environment</div>
        <div style={s.envRow}>
          <button
            style={{ ...s.envBtn, ...(activeEnv === "local" ? s.envBtnActive : {}) }}
            onClick={() => onSwitchEnv("local")}
          >
            Local
          </button>
          <button
            style={{ ...s.envBtn, ...(activeEnv === "prod" ? s.envBtnActive : {}) }}
            onClick={() => onSwitchEnv("prod")}
          >
            Prod
          </button>
        </div>
      </div>

      <hr style={s.divider} />
      <div style={s.title}>Agents</div>

      {agents.map((a) => (
        <button
          key={a.apiKey}
          style={{ ...s.agentBtn, ...(selected?.apiKey === a.apiKey ? s.agentBtnActive : {}) }}
          onClick={() => onSelect(a)}
        >
          {a.label}
          <span style={s.tag}>{a.emailAddress}</span>
        </button>
      ))}

      {agents.length > 0 && <hr style={s.divider} />}

      {mode === "idle" && (
        <>
          <button style={s.btn} onClick={() => setMode("register")}>+ Register new agent</button>
          <button style={{ ...s.btn, background: "#1a2a1a", color: "#7ecf7e" }} onClick={() => setMode("add")}>
            + Add existing key
          </button>
        </>
      )}

      {mode === "register" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input style={s.input} placeholder="Label (optional)" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} />
          <button style={s.btn} disabled={loading} onClick={handleRegister}>
            {loading ? "Registering…" : "Register"}
          </button>
          <button style={{ ...s.btn, background: "none", color: "#666" }} onClick={() => setMode("idle")}>Cancel</button>
          {error && <div style={s.error}>{error}</div>}
        </div>
      )}

      {mode === "add" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input style={s.input} placeholder="amb_..." value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} />
          <input style={s.input} placeholder="Label (optional)" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} />
          <button style={s.btn} disabled={loading || !apiKeyInput.trim()} onClick={handleAdd}>
            {loading ? "Verifying…" : "Add"}
          </button>
          <button style={{ ...s.btn, background: "none", color: "#666" }} onClick={() => setMode("idle")}>Cancel</button>
          {error && <div style={s.error}>{error}</div>}
        </div>
      )}

      {selected && (
        <>
          <div style={{ flex: 1 }} />
          <button
            style={{ ...s.btn, background: "none", color: "#555", fontSize: 11 }}
            onClick={() => onRemove(selected.apiKey)}
          >
            Remove "{selected.label}"
          </button>
        </>
      )}
    </div>
  );
}
