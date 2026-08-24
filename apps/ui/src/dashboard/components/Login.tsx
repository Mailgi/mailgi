import { useEffect, useState } from "react";
import { DashboardClient } from "../lib/dashboardClient.js";

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    height: "100%", gap: 16,
  },
  title: { fontSize: 18, color: "#e0e0e0" },
  sub: { fontSize: 13, color: "#666", maxWidth: 320, textAlign: "center" },
  button: {
    background: "#1e1e1e", border: "1px solid #333", color: "#e0e0e0",
    padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontSize: 14, minWidth: 220,
  },
  empty: { fontSize: 13, color: "#a44" },
};

const PROVIDER_LABEL: Record<string, string> = {
  github: "Continue with GitHub",
  google: "Continue with Google",
};

export function Login({ client }: { client: DashboardClient }) {
  const [providers, setProviders] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    client.enabledProviders().then((r) => {
      if (!cancelled) setProviders(r.providers);
    }).catch(() => {
      if (!cancelled) setProviders([]);
    });
    return () => { cancelled = true; };
  }, [client]);

  return (
    <div style={s.wrap}>
      <div style={s.title}>Sign in to Mailgi</div>
      {providers === null ? (
        <div style={s.sub}>Loading…</div>
      ) : providers.length === 0 ? (
        <div style={s.empty}>
          No OAuth providers are configured on this API yet.
        </div>
      ) : (
        providers.map((p) => (
          // Full-page navigation, not a fetch -- OAuth requires a real
          // browser redirect through the provider and back.
          <a key={p} href={client.oauthLoginUrl(p)} style={{ textDecoration: "none" }}>
            <button style={s.button}>{PROVIDER_LABEL[p] ?? `Continue with ${p}`}</button>
          </a>
        ))
      )}
    </div>
  );
}
