import { type Command } from 'commander';
import { loadConfig, saveConfig } from '../config.js';
import { redactKey } from '../utils/format.js';
import { fail, ok, printJson } from '../utils/output.js';

export function registerConfigCommands(program: Command): void {
  const cfg = program
    .command('config')
    .description('Manage CLI configuration');

  cfg.command('set-url <url>')
    .description('Set a custom API base URL (for self-hosted instances)')
    .action((url: string) => {
      try {
        new URL(url); // validate
      } catch {
        fail(`Invalid URL: ${url}`);
      }
      const config = loadConfig();
      config.baseUrl = url;
      saveConfig(config);
      ok(`Base URL set to: ${url}`);
    });

  cfg.command('show')
    .description('Show current configuration (API keys are redacted)')
    .action(function (this: Command) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();
      const config = loadConfig();
      const redacted = {
        baseUrl: config.baseUrl,
        agents: Object.fromEntries(
          Object.entries(config.agents).map(([email, e]) => [
            email,
            { ...e, apiKey: redactKey(e.apiKey) },
          ]),
        ),
      };
      if (json) { printJson(redacted); return; }
      ok(`Base URL: ${redacted.baseUrl}`);
      ok('');
      const entries = Object.entries(redacted.agents);
      if (entries.length === 0) {
        ok('No agents registered.');
      } else {
        ok('Agents:');
        for (const [email, e] of entries) {
          ok(`  ${email}`);
          ok(`    label:  ${e.label ?? '—'}`);
          ok(`    apiKey: ${e.apiKey}`);
        }
      }
    });
}
