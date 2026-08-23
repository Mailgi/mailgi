import { useState, useEffect, useCallback } from "react";
import type { EnvName } from "../lib/environments.js";

export interface StoredAgent {
  apiKey: string;
  emailAddress: string;
  aliasAddress: string;
  label: string;
}

function storageKey(env: EnvName) {
  return `agentmailbox_agents_${env}`;
}

function load(env: EnvName): StoredAgent[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(env)) ?? "[]");
  } catch {
    return [];
  }
}

function save(env: EnvName, agents: StoredAgent[]): void {
  localStorage.setItem(storageKey(env), JSON.stringify(agents));
}

export function useAgents(env: EnvName) {
  const [agents, setAgents] = useState<StoredAgent[]>(() => load(env));
  const [selected, setSelected] = useState<StoredAgent | null>(() => load(env)[0] ?? null);

  // Reload when environment switches
  useEffect(() => {
    const loaded = load(env);
    setAgents(loaded);
    setSelected(loaded[0] ?? null);
  }, [env]);

  const addAgent = useCallback((agent: StoredAgent) => {
    setAgents((prev) => {
      const next = [...prev.filter((a) => a.apiKey !== agent.apiKey), agent];
      save(env, next);
      return next;
    });
    setSelected(agent);
  }, [env]);

  const removeAgent = useCallback((apiKey: string) => {
    setAgents((prev) => {
      const next = prev.filter((a) => a.apiKey !== apiKey);
      save(env, next);
      return next;
    });
    setSelected((prev) =>
      prev?.apiKey === apiKey
        ? load(env).find((a) => a.apiKey !== apiKey) ?? null
        : prev,
    );
  }, [env]);

  const selectAgent = useCallback((agent: StoredAgent) => {
    setSelected(agent);
  }, []);

  return { agents, selected, addAgent, removeAgent, selectAgent };
}
