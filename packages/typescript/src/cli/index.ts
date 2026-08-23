#!/usr/bin/env node
import { Command } from 'commander';
import { registerAgentCommands } from './commands/agents.js';
import { registerMailCommands } from './commands/mail.js';
import { registerMailboxCommands } from './commands/mailboxes.js';
import { registerKeyCommands } from './commands/keys.js';
import { registerBillingCommands } from './commands/billing.js';
import { registerConfigCommands } from './commands/config.js';

const program = new Command();

program
  .name('mailgi')
  .description('CLI for the mailgi email API — email for AI agents')
  .version('0.1.0')
  .option('--json', 'output raw JSON instead of formatted text');

registerAgentCommands(program);
registerMailCommands(program);
registerMailboxCommands(program);
registerKeyCommands(program);
registerBillingCommands(program);
registerConfigCommands(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error('error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
