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
  badge: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, border: "1px solid", borderRadius: 3, padding: "1px 6px" },
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

const TX_LABELS: Record<string, string> = {
  deposit: "Top-up", deduction: "Send", storage: "Storage", refund: "Refund", dispute: "Dispute",
};

const STANDING: Record<string, { label: string; fg: string }> = {
  ok: { label: "OK", fg: "#7ecf7e" },
  low_balance: { label: "Low balance", fg: "#e8c468" },
  in_debt: { label: "In debt", fg: "#f2a0a0" },
  reads_blocked: { label: "Reading paused", fg: "#ff8a8a" },
};

function money(n: number, dp = 2): string {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(dp)}`;
}

interface Props {
  apiKey: string;
  baseUrl?: string;
}

const PAGE = 10;

export function Billing({ apiKey, baseUrl }: Props) {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("10");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupError, setTopupError] = useState("");

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

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  /** What an agent would do: create a Checkout link and hand it to a human. Here, open it. */
  async function createPaymentLink() {
    setTopupError("");
    setTopupBusy(true);
    try {
      const { url } = await client.billing.topup(Number(amount));
      window.open(url, "_blank", "noreferrer");
    } catch (err) {
      setTopupError(err instanceof Error ? err.message : "Could not create a payment link");
    } finally {
      setTopupBusy(false);
    }
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

  const totalPages = txData ? Math.ceil(txData.total / PAGE) : 0;
  const p = info.prices;
  const standing = STANDING[info.standing.status] ?? STANDING.ok;

  return (
    <div style={s.container}>

      {/* Balance and standing */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          {info.wallet.kind === "org" ? "Organisation wallet (shared by its agents)" : "This agent's wallet"}
        </div>
        <div style={{ ...s.balance, ...(info.balanceUsd < 0 ? { color: "#f87171" } : {}) }}>{money(info.balanceUsd, 4)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...s.badge, color: standing.fg, borderColor: standing.fg }}>{standing.label}</span>
          <span style={s.balanceSub}>low-balance level {money(info.standing.lowBalanceUsd)} (about a week of spend)</span>
        </div>
        {info.standing.message && <div style={{ ...s.note, color: standing.fg }}>{info.standing.message}</div>}
        {!info.meteringEnabled && <div style={s.note}>Metering is off on this server: nothing is charged yet.</div>}
      </div>

      {/* Prices */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Prices</div>
        <div style={s.note}>
          ${p.outboundEmailUsd} per external recipient · +${p.introductionUsd} the first time (introduction) ·
          ${p.storageGbMonthUsd} per GB-month above {Math.round(p.storageFreeBytes / 1048576)} MB.
          Receiving and internal mail are free. {info.knownContacts} known contact{info.knownContacts === 1 ? "" : "s"}.
        </div>
      </div>

      {/* Top up */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Top up</div>
        {!info.topup.available ? (
          <div style={s.note}>Card payments are not configured on this server.</div>
        ) : (
          <>
            <div style={s.row}>
              <div style={s.label}>Public page: anyone can pay, no login (what agents forward)</div>
              <div style={s.addrRow}>
                <a style={{ ...s.addr, color: "#7ab8ff" }} href={info.topup.publicPage} target="_blank" rel="noreferrer">{info.topup.publicPage}</a>
                <button style={s.copyBtn} onClick={() => copy(info.topup.publicPage)}>{copied ? "Copied!" : "Copy"}</button>
              </div>
            </div>
            <div style={s.row}>
              <div style={s.label}>Or create a card payment link (POST /v1/billing/topup), min ${info.topup.minAmountUsd}</div>
              <div style={s.addrRow}>
                <input style={{ ...s.addr, flex: "0 0 90px" }} type="number" min={info.topup.minAmountUsd} value={amount}
                  onChange={(e) => setAmount(e.target.value)} aria-label="Amount in US dollars" />
                <button style={s.copyBtn} disabled={topupBusy || Number(amount) < info.topup.minAmountUsd} onClick={() => void createPaymentLink()}>
                  {topupBusy ? "Creating…" : "Open payment link ↗"}
                </button>
              </div>
              {topupError && <div style={s.error}>{topupError}</div>}
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
                    <td style={s.td}>{TX_LABELS[tx.type] ?? tx.type}</td>
                    <td style={{ ...s.td, textAlign: "right", fontFamily: "monospace", ...(tx.amountUsd >= 0 ? s.deposit : s.deduction) }}>
                      {tx.amountUsd >= 0 ? "+" : "−"}${Math.abs(tx.amountUsd).toFixed(4)}
                    </td>
                    <td style={{ ...s.td, color: "#555", fontSize: 11 }}>
                      {tx.emailCount != null
                        ? `${tx.emailCount} recipient${tx.emailCount !== 1 ? "s" : ""}${tx.introductionCount ? `, ${tx.introductionCount} new` : ""}`
                        : tx.type === "storage" && tx.providerRef
                          ? `day ${tx.providerRef.split(":").pop()}`
                          : tx.provider === "stripe" ? "card" : tx.chain ?? ""}
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
