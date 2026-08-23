import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentMailboxClient } from '../client.js';
import { fail } from './utils/output.js';

export interface AgentEntry {
  apiKey: string;
  agentId: string;
  label?: string;
}

export interface Config {
  baseUrl: string;
  agents: Record<string, AgentEntry>; // keyed by full email address
}

const DEFAULT_BASE_URL = 'https://api.mailgi.xyz';
const CONFIG_DIR = path.join(os.homedir(), '.mailgi');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export function loadConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<Config>;
    return {
      baseUrl: parsed.baseUrl ?? DEFAULT_BASE_URL,
      agents: parsed.agents ?? {},
    };
  } catch {
    return { baseUrl: DEFAULT_BASE_URL, agents: {} };
  }
}

export function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', {
    mode: 0o600,
  });
}

export function saveAgent(email: string, entry: AgentEntry): void {
  const config = loadConfig();
  config.agents[email] = entry;
  saveConfig(config);
}

export function removeAgent(email: string): void {
  const config = loadConfig();
  delete config.agents[email];
  saveConfig(config);
}

/**
 * Resolve an agent identifier (full email OR username before @) to its entry.
 * Exits with a friendly error if not found.
 */
export function resolveAgent(identifier: string): { email: string; entry: AgentEntry } {
  const config = loadConfig();
  const agents = config.agents;

  // Exact match — full email address
  if (agents[identifier]) {
    return { email: identifier, entry: agents[identifier] };
  }

  // Username match — find email whose local part matches
  const match = Object.entries(agents).find(
    ([email]) => email.split('@')[0] === identifier,
  );
  if (match) return { email: match[0], entry: match[1] };

  const known = Object.keys(agents);
  if (known.length === 0) {
    fail(`No agents registered. Run "mailgi register" first.`);
  }
  fail(
    `Agent "${identifier}" not found.\n` +
      `Known agents:\n${known.map((e) => `  ${e}`).join('\n')}\n` +
      `Use --agent <email> or --agent <username>.`,
  );
}

/**
 * Return an authenticated client for the given agent identifier.
 */
export function getClient(agentIdentifier: string): {
  client: AgentMailboxClient;
  email: string;
  entry: AgentEntry;
} {
  const { email, entry } = resolveAgent(agentIdentifier);
  const config = loadConfig();
  const client = AgentMailboxClient.withApiKey(config.baseUrl, entry.apiKey);
  return { client, email, entry };
}

/**
 * Return an unauthenticated client using the configured base URL.
 */
export function getBaseClient(): AgentMailboxClient {
  const config = loadConfig();
  return new AgentMailboxClient({ baseUrl: config.baseUrl });
}
