import { AgentMailboxClient } from "@mailgi/mailgi";
import { getActiveEnv } from "./environments.js";

export function makeClient(apiKey: string, baseUrl?: string): AgentMailboxClient {
  return AgentMailboxClient.withApiKey(baseUrl ?? getActiveEnv().url, apiKey);
}

export function makeAnonClient(baseUrl?: string): AgentMailboxClient {
  return new AgentMailboxClient({ baseUrl: baseUrl ?? getActiveEnv().url });
}
