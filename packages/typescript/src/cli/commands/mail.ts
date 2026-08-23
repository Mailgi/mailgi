import fs from 'node:fs';
import { type Command } from 'commander';
import type { JmapBodyPart } from '../../types.js';
import { getClient } from '../config.js';
import { table, truncate, formatDate, stripHtml } from '../utils/format.js';
import { fail, ok, printJson } from '../utils/output.js';

export function registerMailCommands(program: Command): void {
  // inbox
  program
    .command('inbox')
    .description('List messages in the inbox')
    .requiredOption('--agent <id>', 'agent email or username')
    .option('--limit <n>', 'max messages to show', '20')
    .action(async function (this: Command, opts: { agent: string; limit: string }) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();
      const { client } = getClient(opts.agent);
      let result;
      try {
        result = await client.mail.list({ limit: Number(opts.limit), sort: 'desc' });
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
      if (json) { printJson(result); return; }
      if (result.messages.length === 0) { ok('Inbox is empty.'); return; }
      table(
        ['ID', 'From', 'Subject', 'Date', ''],
        result.messages.map((m) => [
          m.id,
          m.from[0]?.email ?? '',
          truncate(m.subject, 45),
          formatDate(m.receivedAt),
          m.seen ? '' : '●',
        ]),
      );
      ok(`\n${result.total} total message(s)`);
    });

  // read
  program
    .command('read <id>')
    .description('Read the full body of a message')
    .requiredOption('--agent <id>', 'agent email or username')
    .action(async function (this: Command, msgId: string, opts: { agent: string }) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();
      const { client } = getClient(opts.agent);
      let msg;
      try {
        msg = await client.mail.get(msgId);
        // Mark as read
        await client.mail.setFlags(msgId, { seen: true }).catch(() => {});
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
      if (json) { printJson(msg); return; }

      ok(`From:    ${msg.from.map((a) => a.email).join(', ')}`);
      ok(`To:      ${msg.to.map((a) => a.email).join(', ')}`);
      if (msg.cc?.length) ok(`CC:      ${msg.cc.map((a) => a.email).join(', ')}`);
      ok(`Subject: ${msg.subject}`);
      ok(`Date:    ${formatDate(msg.receivedAt)}`);
      ok('');

      const body = resolveBody(msg.textBody, msg.bodyValues) ??
        (msg.htmlBody ? stripHtml(resolveBody(msg.htmlBody, msg.bodyValues) ?? '') : null) ??
        msg.preview;
      ok(body ?? '(no body)');
    });

  // send
  program
    .command('send')
    .description('Send an email')
    .requiredOption('--agent <id>', 'agent email or username')
    .requiredOption('--to <addr>', 'recipient address (comma-separated for multiple)')
    .requiredOption('--subject <subject>', 'email subject')
    .option('--body <text>', 'plain-text body')
    .option('--body-file <path>', 'read body from file')
    .option('--cc <addr>', 'CC address(es), comma-separated')
    .option('--bcc <addr>', 'BCC address(es), comma-separated')
    .action(async function (
      this: Command,
      opts: {
        agent: string;
        to: string;
        subject: string;
        body?: string;
        bodyFile?: string;
        cc?: string;
        bcc?: string;
      },
    ) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();

      let textBody: string | undefined;
      if (opts.bodyFile) {
        try {
          textBody = fs.readFileSync(opts.bodyFile, 'utf8');
        } catch {
          fail(`Could not read file: ${opts.bodyFile}`);
        }
      } else if (opts.body) {
        textBody = opts.body;
      } else {
        fail('Provide --body <text> or --body-file <path>');
      }

      const { client } = getClient(opts.agent);
      const split = (s?: string) => s ? s.split(',').map((x) => x.trim()) : undefined;

      let result;
      try {
        result = await client.mail.send({
          to: split(opts.to)!,
          subject: opts.subject,
          textBody,
          cc: split(opts.cc),
          bcc: split(opts.bcc),
        });
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }

      if (json) { printJson(result); return; }
      ok(`Sent. Message ID: ${result.messageId}`);
    });

  // delete
  program
    .command('delete <id>')
    .description('Move a message to Trash')
    .requiredOption('--agent <id>', 'agent email or username')
    .action(async function (this: Command, msgId: string, opts: { agent: string }) {
      const { json } = this.optsWithGlobals<{ json?: boolean }>();
      const { client } = getClient(opts.agent);
      try {
        await client.mail.delete(msgId);
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
      if (json) { printJson({ deleted: msgId }); return; }
      ok(`Moved to Trash: ${msgId}`);
    });
}

function resolveBody(
  body: string | JmapBodyPart[] | undefined,
  bodyValues?: Record<string, { value: string }>,
): string | null {
  if (!body) return null;
  if (typeof body === 'string') return body;
  // JMAP parts array — look up each part in bodyValues
  const parts = body as JmapBodyPart[];
  return parts
    .map((p) => (p.partId && bodyValues?.[p.partId]?.value) ?? '')
    .join('\n') || null;
}
