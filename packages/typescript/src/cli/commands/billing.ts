import { type Command } from 'commander';
import { getClient } from '../config.js';
import { table, formatDate } from '../utils/format.js';
import { fail, ok, printJson } from '../utils/output.js';

const TX_LABELS: Record<string, string> = { deposit: 'Top-up', deduction: 'Send', storage: 'Storage', refund: 'Refund', dispute: 'Dispute' };

export function registerBillingCommands(program: Command): void {
  const billing = program
    .command('billing')
    .description('Show wallet, balance, standing, prices and how to top up')
    .requiredOption('--agent <id>', 'agent email or username')
    .action(async function (this: Command, opts: { agent: string }) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();
      const { client } = getClient(opts.agent);
      let info;
      try {
        info = await client.billing.get();
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
      if (json) { printJson(info); return; }

      const p = info.prices;
      ok(`Wallet:   ${info.wallet.kind === 'org' ? "organisation's (shared)" : "this agent's own"}`);
      ok(`Balance:  ${info.balanceUsd < 0 ? '-' : ''}$${Math.abs(info.balanceUsd).toFixed(4)}`);
      ok(`Standing: ${info.standing.status}${info.standing.message ? `\n          ${info.standing.message}` : ''}`);
      ok('');
      ok(`Prices:   $${p.outboundEmailUsd} per external recipient, +$${p.introductionUsd} the first time,`);
      ok(`          $${p.storageGbMonthUsd} per GB-month above ${Math.round(p.storageFreeBytes / 1048576)} MB${info.meteringEnabled ? '' : '  (not charged yet)'}`);
      ok(`Contacts: ${info.knownContacts} known`);
      ok('');
      if (!info.topup.available) {
        ok('Top-ups are not available on this server.');
        return;
      }
      ok(`Top up (anyone, no login): ${info.topup.publicPage}`);
      ok(`Or: mailgi billing topup --agent ${opts.agent} --amount ${info.topup.minAmountUsd}`);
    });

  billing.command('topup')
    .description('Create a card payment link for this wallet; give it to whoever pays')
    .requiredOption('--agent <id>', 'agent email or username')
    .requiredOption('--amount <usd>', 'amount in US dollars')
    .action(async function (this: Command, opts: { agent: string; amount: string }) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();
      const { client } = getClient(opts.agent);
      let result;
      try {
        result = await client.billing.topup(Number(opts.amount));
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
      if (json) { printJson(result); return; }
      ok(`Pay $${result.amountUsd.toFixed(2)} (plus any tax) here: ${result.url}`);
    });

  billing.command('tx')
    .description('List balance transactions')
    .requiredOption('--agent <id>', 'agent email or username')
    .option('--limit <n>', 'number of transactions to show', '20')
    .action(async function (this: Command, opts: { agent: string; limit: string }) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();
      const { client } = getClient(opts.agent);
      let result;
      try {
        result = await client.billing.transactions({ limit: Number(opts.limit) });
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
      if (json) { printJson(result); return; }
      if (result.transactions.length === 0) { ok('No transactions yet.'); return; }
      table(
        ['Date', 'Type', 'Amount', 'Details'],
        result.transactions.map((tx) => [
          formatDate(tx.createdAt),
          TX_LABELS[tx.type] ?? tx.type,
          (tx.amountUsd >= 0 ? '+' : '−') + '$' + Math.abs(tx.amountUsd).toFixed(4),
          tx.emailCount != null
            ? `${tx.emailCount} recipient${tx.emailCount !== 1 ? 's' : ''}` +
              (tx.introductionCount ? `, ${tx.introductionCount} new` : '')
            : tx.chain ?? '',
        ]),
      );
      ok(`\n${result.total} total transaction(s)`);
    });
}
