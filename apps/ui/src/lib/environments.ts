const LOCAL_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3000";

const PROD_URL_KEY = "agentmailbox_prod_url";
const ACTIVE_ENV_KEY = "agentmailbox_active_env";

export type EnvName = "local" | "prod";

export interface Environment {
  name: EnvName;
  url: string;
}

export function getLocalEnv(): Environment {
  return { name: "local", url: LOCAL_URL };
}

export function getProdUrl(): string {
  return localStorage.getItem(PROD_URL_KEY) ?? "";
}

export function setProdUrl(url: string): void {
  localStorage.setItem(PROD_URL_KEY, url.replace(/\/$/, ""));
}

export function getActiveEnvName(): EnvName {
  return (localStorage.getItem(ACTIVE_ENV_KEY) as EnvName | null) ?? "local";
}

export function setActiveEnvName(name: EnvName): void {
  localStorage.setItem(ACTIVE_ENV_KEY, name);
}

export function getActiveEnv(): Environment {
  const name = getActiveEnvName();
  if (name === "prod") {
    const url = getProdUrl();
    if (url) return { name: "prod", url };
  }
  return getLocalEnv();
}
