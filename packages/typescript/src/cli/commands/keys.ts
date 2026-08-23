import { type Command } from 'commander';
import { getClient } from '../config.js';
import { table, formatDate, redactKey } from '../utils/format.js';
import { fail, ok, printJson } from '../utils/output.js';

export function registerKeyCommands(program: Command): void {
  const keys = program
    .command('keys')
    .description('Manage API keys')
    .requiredOption('--agent <id>', 'agent email or username')
    .action(async function (this: Command, opts: { agent: string }) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();
      const { client } = getClient(opts.agent);
      let list;
      try {
        list = await client.apiKeys.list();
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
      if (json) { printJson(list); return; }
      if (list.length === 0) { ok('No API keys.'); return; }
      table(
        ['ID', 'Prefix', 'Label', 'Created', 'Expires', 'Last used'],
        list.map((k) => [
          k.id,
          k.keyPrefix,
          k.label,
          formatDate(k.createdAt),
          k.expiresAt ? formatDate(k.expiresAt) : '—',
          k.lastUsedAt ? formatDate(k.lastUsedAt) : '—',
        ]),
      );
    });

  keys.command('create')
    .description('Create a new API key (shown once — save it)')
    .requiredOption('--agent <id>', 'agent email or username')
    .option('--label <label>', 'label for this key')
    .option('--expires <date>', 'expiry date (ISO format, e.g. 2027-01-01)')
    .action(async function (
      this: Command,
      opts: { agent: string; label?: string; expires?: string },
    ) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();
      const { client } = getClient(opts.agent);
      let result;
      try {
        result = await client.apiKeys.create({
          label: opts.label,
          expiresAt: opts.expires,
        });
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
      if (json) { printJson(result); return; }
      ok(`API key created (shown once — store it now):`);
      ok(`  Key: ${result.apiKey}`);
      ok(`  ID:  ${result.id}`);
    });

  keys.command('revoke <keyId>')
    .description('Revoke an API key')
    .requiredOption('--agent <id>', 'agent email or username')
    .action(async function (this: Command, keyId: string, opts: { agent: string }) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();
      const { client } = getClient(opts.agent);
      try {
        await client.apiKeys.revoke(keyId);
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
      if (json) { printJson({ revoked: keyId }); return; }
      ok(`Revoked key: ${keyId}`);
    });
}
