import { useState } from "react";
import { useAgents } from "./hooks/useAgents.js";
import { AgentSidebar } from "./components/AgentSidebar.js";
import { Inbox } from "./components/Inbox.js";
import { Compose } from "./components/Compose.js";
import { Billing } from "./components/Billing.js";
import { Dashboard } from "./dashboard/Dashboard.js";
import {
  getActiveEnvName,
  setActiveEnvName,
  getActiveEnv,
  getProdUrl,
  setProdUrl,
  type EnvName,
} from "./lib/environments.js";

type View = "inbox" | "compose" | "billing";
type Mode = "devtools" | "dashboard";

const s: Record<string, React.CSSProperties> = {
  app: { display: "flex", width: "100%", height: "100%" },
  main: { display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" },
  topbar: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    borderBottom: "1px solid #2a2a2a",
    background: "#141414",
    height: 44,
    padding: "0 12px",
  },
  tab: {
    background: "none",
    border: "none",
    color: "#666",
    padding: "0 16px",
    height: "100%",
    cursor: "pointer",
    fontSize: 13,
    borderBottom: "2px solid transparent",
  },
  tabActive: { color: "#e0e0e0", borderBottomColor: "#4a9eff" },
  agentTag: { marginLeft: "auto", fontSize: 11, color: "#444" },
  content: { display: "flex", flex: 1, overflow: "hidden" },
  noAgent: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#444",
    fontSize: 13,
  },
};

export default function App() {
  const [activeEnv, setActiveEnv] = useState<EnvName>(getActiveEnvName);
  const { agents, selected, addAgent, removeAgent, selectAgent } = useAgents(activeEnv);
  const [view, setView] = useState<View>("inbox");
  // Dashboard is a distinct product surface (session/OAuth-authenticated org
  // management) from the dev tool below it (API-key-authenticated, single
  // agent at a time) -- kept as a mode switch on one app rather than a second
  // app, per #3's own note that they can share the client and components.
  const [mode, setMode] = useState<Mode>("devtools");

  const envUrl = getActiveEnv().url;

  function switchEnv(name: EnvName) {
    if (name === "prod" && !getProdUrl()) {
      const url = window.prompt("Enter production API URL:", "https://");
      if (!url?.startsWith("http")) return;
      setProdUrl(url);
    }
    setActiveEnvName(name);
    setActiveEnv(name);
  }

  if (mode === "dashboard") {
    return (
      <div style={s.app}>
        <div style={{ ...s.main }}>
          <div style={s.topbar}>
            <button style={{ ...s.tab, ...s.tabActive }} onClick={() => setMode("devtools")}>
              ← Dev tools
            </button>
          </div>
          <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
            <Dashboard apiBaseUrl={envUrl} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.app}>
      <AgentSidebar
        agents={agents}
        selected={selected}
        activeEnv={activeEnv}
        envUrl={envUrl}
        onSwitchEnv={switchEnv}
        onSelect={selectAgent}
        onAdd={addAgent}
        onRemove={removeAgent}
      />

      <div style={s.main}>
        <div style={s.topbar}>
          <button
            style={{ ...s.tab, ...(view === "inbox" ? s.tabActive : {}) }}
            onClick={() => setView("inbox")}
          >
            Inbox
          </button>
          <button
            style={{ ...s.tab, ...(view === "compose" ? s.tabActive : {}) }}
            onClick={() => setView("compose")}
          >
            Compose
          </button>
          <button
            style={{ ...s.tab, ...(view === "billing" ? s.tabActive : {}) }}
            onClick={() => setView("billing")}
          >
            Billing
          </button>
          {selected && (
            <span style={s.agentTag}>{selected.emailAddress}</span>
          )}
          <button
            style={{ ...s.tab, marginLeft: selected ? 12 : "auto" }}
            onClick={() => setMode("dashboard")}
          >
            Dashboard →
          </button>
        </div>

        <div style={s.content}>
          {!selected ? (
            <div style={s.noAgent}>
              Add or register an agent to get started
            </div>
          ) : view === "inbox" ? (
            <Inbox key={selected.apiKey + envUrl} apiKey={selected.apiKey} baseUrl={envUrl} />
          ) : view === "compose" ? (
            <Compose
              key={selected.apiKey + envUrl}
              apiKey={selected.apiKey}
              baseUrl={envUrl}
              fromAddress={selected.emailAddress}
            />
          ) : (
            <Billing key={selected.apiKey + envUrl} apiKey={selected.apiKey} baseUrl={envUrl} />
          )}
        </div>
      </div>
    </div>
  );
}
