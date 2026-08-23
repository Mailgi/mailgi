import { type Command } from 'commander';
import { getClient } from '../config.js';
import { table, formatDate } from '../utils/format.js';
import { fail, ok, printJson } from '../utils/output.js';

export function registerBillingCommands(program: Command): void {
  const billing = program
    .command('billing')
    .description('Show balance and deposit addresses')
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

      const sends = Math.floor(info.balanceUsd / info.pricePerExternalEmail);
      ok(`Balance: $${info.balanceUsd.toFixed(4)}  (${sends.toLocaleString()} external sends remaining)`);
      ok(`Price:   $${info.pricePerExternalEmail.toFixed(3)} per external email`);
      ok('');

      if (!info.depositAddresses) {
        ok('Billing not configured on server (free mode).');
        return;
      }
      ok(`Deposit ${info.acceptedToken} to:`);
      ok(`  EVM (Ethereum · Base)  ${info.depositAddresses.evm}`);
      ok(`  Solana                 ${info.depositAddresses.solana}`);
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
          tx.type === 'deposit' ? 'Deposit' : 'Send',
          (tx.type === 'deposit' ? '+' : '−') + '$' + Math.abs(tx.amountUsd).toFixed(4),
          tx.type === 'deposit' && tx.chain
            ? tx.chain
            : tx.emailCount != null
              ? `${tx.emailCount} recipient${tx.emailCount !== 1 ? 's' : ''}`
              : '',
        ]),
      );
      ok(`\n${result.total} total transaction(s)`);
    });
}
