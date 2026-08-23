import { useEffect, useState, useCallback } from "react";
import type { BillingInfo, BalanceTransaction, ListTransactionsResponse } from "@mailgi/mailgi";
import { makeClient } from "../lib/client.js";

const s: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20, padding: 24, maxWidth: 560 },
  section: { display: "flex", flexDirection: "column", gap: 8 },
  sectionTitle: { fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1 },
  balance: { fontSize: 32, fontWeight: 600, color: "#e0e0e0", letterSpacing: -0.5 },
  balanceSub: { fontSize: 12, color: "#555", marginTop: 2 },
  row: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 11, color: "#888" },
  addrRow: { display: "flex", alignItems: "center", gap: 8 },
  addr: {
    flex: 1,
    background: "#111",
    border: "1px solid #2a2a2a",
    color: "#ccc",
    padding: "8px 10px",
    borderRadius: 4,
    fontSize: 12,
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  copyBtn: {
    background: "#1a2a1a",
    border: "none",
    color: "#7ecf7e",
    padding: "6px 12px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  refreshBtn: {
    background: "none",
    border: "1px solid #2a2a2a",
    color: "#666",
    padding: "6px 14px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
    alignSelf: "flex-start",
  },
  note: { fontSize: 11, color: "#555", lineHeight: 1.5 },
  error: { color: "#f87171", fontSize: 12 },
  loading: { color: "#555", fontSize: 13 },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
  th: { textAlign: "left" as const, color: "#555", fontWeight: 400, padding: "4px 8px 6px 0", borderBottom: "1px solid #1e1e1e" },
  td: { padding: "6px 8px 6px 0", color: "#aaa", borderBottom: "1px solid #141414", verticalAlign: "top" as const },
  deposit: { color: "#7ecf7e" },
  deduction: { color: "#f87171" },
  pager: { display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#555" },
  pageBtn: {
    background: "none",
    border: "1px solid #2a2a2a",
    color: "#666",
    padding: "3px 10px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
  },
};

interface Props {
  apiKey: string;
  baseUrl?: string;
}

const PAGE = 10;

export function Billing({ apiKey, baseUrl }: Props) {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"evm" | "sol" | null>(null);

  const [txData, setTxData] = useState<ListTransactionsResponse | null>(null);
  const [txPage, setTxPage] = useState(0);
  const [txLoading, setTxLoading] = useState(false);

  const client = makeClient(apiKey, baseUrl);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setInfo(await client.billing.get());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing info");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const loadTx = useCallback(async (page: number) => {
    setTxLoading(true);
    try {
      setTxData(await client.billing.transactions({ limit: PAGE, offset: page * PAGE }));
    } catch {
      // non-critical — balance info still shows
    } finally {
      setTxLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    void loadTx(txPage);
  }, [loadTx, txPage]);

  function copy(text: string, which: "evm" | "sol") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  if (loading && !info) return <div style={{ ...s.container, ...s.loading }}>Loading…</div>;
  if (error && !info) return (
    <div style={s.container}>
      <div style={s.error}>{error}</div>
      <button style={s.refreshBtn} onClick={() => void load()}>Retry</button>
    </div>
  );
  if (!info) return null;

  const { depositAddresses: addrs } = info;
  const totalPages = txData ? Math.ceil(txData.total / PAGE) : 0;

  return (
    <div style={s.container}>

      {/* Balance */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Balance</div>
        <div style={s.balance}>${info.balanceUsd.toFixed(4)}</div>
        <div style={s.balanceSub}>
          ${info.pricePerExternalEmail.toFixed(3)} per external email ·{" "}
          {Math.floor(info.balanceUsd / info.pricePerExternalEmail).toLocaleString()} sends remaining
        </div>
      </div>

      {/* Deposit addresses */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Deposit USDC</div>
        {!addrs ? (
          <div style={s.note}>Billing not configured on server (BILLING_HD_MNEMONIC not set).</div>
        ) : (
          <>
            <div style={s.note}>
              {info.acceptedToken} only · 1 USDC = $1
            </div>
            <div style={s.row}>
              <div style={s.label}>EVM — Ethereum mainnet · Base</div>
              <div style={s.addrRow}>
                <div style={s.addr}>{addrs.evm}</div>
                <button style={s.copyBtn} onClick={() => copy(addrs.evm, "evm")}>
                  {copied === "evm" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div style={s.row}>
              <div style={s.label}>Solana mainnet</div>
              <div style={s.addrRow}>
                <div style={s.addr}>{addrs.solana}</div>
                <button style={s.copyBtn} onClick={() => copy(addrs.solana, "sol")}>
                  {copied === "sol" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Transactions */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Transactions</div>
        {txLoading && !txData ? (
          <div style={s.note}>Loading…</div>
        ) : !txData || txData.transactions.length === 0 ? (
          <div style={s.note}>No transactions yet.</div>
        ) : (
          <>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Type</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Amount</th>
                  <th style={s.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {txData.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={s.td}>{formatDate(tx.createdAt)}</td>
                    <td style={s.td}>{tx.type === "deposit" ? "Deposit" : "Send"}</td>
                    <td style={{ ...s.td, textAlign: "right", fontFamily: "monospace", ...( tx.type === "deposit" ? s.deposit : s.deduction) }}>
                      {tx.type === "deposit" ? "+" : "−"}${Math.abs(tx.amountUsd).toFixed(4)}
                    </td>
                    <td style={{ ...s.td, color: "#555", fontSize: 11 }}>
                      {tx.type === "deposit" && tx.chain ? tx.chain : ""}
                      {tx.type === "deduction" && tx.emailCount != null
                        ? `${tx.emailCount} recipient${tx.emailCount !== 1 ? "s" : ""}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={s.pager}>
                <button
                  style={s.pageBtn}
                  disabled={txPage === 0}
                  onClick={() => setTxPage((p) => p - 1)}
                >
                  ←
                </button>
                <span>{txPage + 1} / {totalPages}</span>
                <button
                  style={s.pageBtn}
                  disabled={txPage >= totalPages - 1}
                  onClick={() => setTxPage((p) => p + 1)}
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Refresh */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button style={s.refreshBtn} onClick={() => { void load(); void loadTx(txPage); }} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <span style={s.note}>Balance auto-refreshes every 10s</span>
      </div>

      {error && <div style={s.error}>{error}</div>}
    </div>
  );
}
