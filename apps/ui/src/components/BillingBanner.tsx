import { PaymentRequiredError, type BillingNotice } from "@mailgi/mailgi";

/**
 * The wallet's state, as the API reports it: the `billing` notice on reads and
 * sends (low_balance / in_debt), or a 402 (a refused send, or reads paused
 * past the debt limit). One look, with the top-up link the API provides.
 */

const TONE: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  low_balance: { bg: "#1f1a0e", border: "#4a3b12", fg: "#e8c468", label: "Low balance" },
  in_debt: { bg: "#231313", border: "#4a1d1d", fg: "#f2a0a0", label: "In debt" },
  reads_blocked: { bg: "#2a1010", border: "#6b1d1d", fg: "#ff8a8a", label: "Reading paused" },
  payment_required: { bg: "#231313", border: "#4a1d1d", fg: "#f2a0a0", label: "Payment required" },
};

const s: Record<string, React.CSSProperties> = {
  banner: { display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 16px", fontSize: 12, lineHeight: 1.5, borderBottom: "1px solid" },
  label: { fontWeight: 600, whiteSpace: "nowrap", textTransform: "uppercase", fontSize: 10, letterSpacing: 0.8, paddingTop: 2 },
  text: { flex: 1, color: "#bbb" },
  link: { color: "inherit", whiteSpace: "nowrap", fontWeight: 600 },
};

function money(n: number | undefined, dp = 2): string {
  if (n === undefined) return "—";
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(dp)}`;
}

/** Strips the trailing "Top up: <url>" the API appends; the link is shown as a button instead. */
function withoutLink(message: string): string {
  return message.replace(/\s*Top up:\s*\S+\s*$/, "").replace(/\s*Ask whoever pays for you to top up:\s*\S+\s*$/, "");
}

export function BillingBanner({ notice, error }: { notice?: BillingNotice | null; error?: PaymentRequiredError | null }) {
  let kind: string;
  let message: string;
  let topupPage: string | undefined;
  if (error) {
    kind = error.readsBlocked ? "reads_blocked" : "payment_required";
    message = withoutLink(error.message);
    topupPage = error.details.topupPage;
  } else if (notice) {
    kind = notice.status;
    message = withoutLink(notice.message);
    topupPage = notice.topupPage;
  } else {
    return null;
  }
  const tone = TONE[kind] ?? TONE.payment_required;
  return (
    <div role="status" style={{ ...s.banner, background: tone.bg, borderColor: tone.border }}>
      <span style={{ ...s.label, color: tone.fg }}>{tone.label}</span>
      <span style={s.text}>{message}</span>
      {topupPage && (
        <a href={topupPage} target="_blank" rel="noreferrer" style={{ ...s.link, color: tone.fg }}>
          Top up ↗
        </a>
      )}
    </div>
  );
}

/** Full-pane state for a read-blocked agent: why, what still works, how to fix it. */
export function ReadsBlocked({ error, onRetry }: { error: PaymentRequiredError; onRetry: () => void }) {
  const d = error.details;
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 12, fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
        <div style={{ fontSize: 16, color: "#ff8a8a", fontWeight: 600 }}>Reading is paused</div>
        <div>
          Balance {money(d.balanceUsd)}, limit {money(d.debtLimitUsd)}.
          {d.requiredUsd !== undefined && <> Top up at least {money(d.requiredUsd)} to read again.</>}
        </div>
        <div style={{ color: "#777" }}>New mail is still kept.</div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {d.topupPage && (
            <a href={d.topupPage} target="_blank" rel="noreferrer"
              style={{ background: "#4a9eff", color: "#fff", padding: "7px 14px", borderRadius: 4, textDecoration: "none", fontSize: 12 }}>
              Open top-up page ↗
            </a>
          )}
          <button onClick={onRetry}
            style={{ background: "none", border: "1px solid #333", color: "#888", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
            I've topped up, retry
          </button>
        </div>
      </div>
    </div>
  );
}
