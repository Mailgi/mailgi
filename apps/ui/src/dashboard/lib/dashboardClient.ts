/**
 * Thin fetch wrapper for the session-cookie-authenticated dashboard API
 * (/v1/orgs, /v1/auth, /v1/invites). Deliberately NOT part of @mailgi/mailgi:
 * that SDK is Bearer-API-key-only, published to third parties who register
 * agents programmatically and have no reason to hold a browser cookie. Mixing
 * the two auth models into one published package would be confusing for SDK
 * consumers and is exactly the kind of scope creep the dashboard issue itself
 * warns against ("a different product surface").
 *
 * credentials: "include" is required on every call -- without it the browser
 * will not attach the session cookie cross-origin (dashboard and API are
 * different ports in dev, different subdomains in prod).
 */

export class DashboardApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DashboardApiError";
  }
}

export interface DashboardClientOptions {
  baseUrl: string;
}

async function parseError(res: Response): Promise<never> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new DashboardApiError(res.statusText || "Request failed", res.status);
  }
  const message =
    (body as { message?: string; error?: string })?.message ??
    (body as { error?: string })?.error ??
    "Request failed";
  const code = (body as { code?: string })?.code;
  throw new DashboardApiError(message, res.status, code);
}

export class DashboardClient {
  private readonly baseUrl: string;

  constructor(options: DashboardClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    if (!res.ok) return parseError(res);
    return (await res.json()) as T;
  }

  // --- Auth ------------------------------------------------------------------

  oauthLoginUrl(provider: string): string {
    return `${this.baseUrl}/v1/auth/oauth/${provider}`;
  }

  enabledProviders(): Promise<{ providers: string[] }> {
    return this.request("GET", "/v1/auth/oauth/providers");
  }

  me(): Promise<{
    user: { id: string; email: string; name: string | null; avatarUrl: string | null };
    orgs: { id: string; name: string; slug: string; role: string }[];
  }> {
    return this.request("GET", "/v1/auth/me");
  }

  logout(): Promise<void> {
    return this.request("POST", "/v1/auth/logout");
  }

  acceptInvite(token: string): Promise<{ org: { id: string; name: string; slug: string }; role: string }> {
    return this.request("POST", "/v1/invites/accept", { token });
  }

  // --- Orgs --------------------------------------------------------------------

  listOrgs(): Promise<{
    orgs: { id: string; name: string; slug: string; role: string; createdAt: string }[];
  }> {
    return this.request("GET", "/v1/orgs");
  }

  createOrg(name: string, slug?: string): Promise<{ id: string; name: string; slug: string; role: string }> {
    return this.request("POST", "/v1/orgs", { name, slug });
  }

  getOrg(orgId: string): Promise<{
    id: string; name: string; slug: string; role: string; memberCount: number; createdAt: string;
  }> {
    return this.request("GET", `/v1/orgs/${orgId}`);
  }

  listMembers(orgId: string): Promise<{
    members: { userId: string; email: string; name: string | null; role: string; joinedAt: string }[];
  }> {
    return this.request("GET", `/v1/orgs/${orgId}/members`);
  }

  removeMember(orgId: string, userId: string): Promise<void> {
    return this.request("DELETE", `/v1/orgs/${orgId}/members/${userId}`);
  }

  changeMemberRole(orgId: string, userId: string, role: "owner" | "admin" | "member"): Promise<void> {
    return this.request("PATCH", `/v1/orgs/${orgId}/members/${userId}`, { role });
  }

  inviteMember(
    orgId: string,
    email: string,
    role?: "admin" | "member",
  ): Promise<{ id: string; email: string; role: string; token: string; expiresAt: string }> {
    return this.request("POST", `/v1/orgs/${orgId}/invites`, { email, role });
  }

  listInvites(orgId: string): Promise<{
    invites: { id: string; email: string; role: string; expiresAt: string; expired: boolean }[];
  }> {
    return this.request("GET", `/v1/orgs/${orgId}/invites`);
  }

  revokeInvite(orgId: string, inviteId: string): Promise<void> {
    return this.request("DELETE", `/v1/orgs/${orgId}/invites/${inviteId}`);
  }

  // --- Domains -------------------------------------------------------------

  listDomains(orgId: string): Promise<{
    domains: DomainSummary[];
  }> {
    return this.request("GET", `/v1/orgs/${orgId}/domains`);
  }

  addDomain(orgId: string, domain: string): Promise<DomainSummary> {
    return this.request("POST", `/v1/orgs/${orgId}/domains`, { domain });
  }

  getDomain(orgId: string, domainId: string): Promise<DomainDetail> {
    return this.request("GET", `/v1/orgs/${orgId}/domains/${domainId}`);
  }

  verifyDomain(orgId: string, domainId: string): Promise<DomainDetail & {
    checks: { txtDetail: string; mxDetail: string };
  }> {
    return this.request("POST", `/v1/orgs/${orgId}/domains/${domainId}/verify`);
  }

  removeDomain(orgId: string, domainId: string): Promise<void> {
    return this.request("DELETE", `/v1/orgs/${orgId}/domains/${domainId}`);
  }

  // --- Registration tokens ---------------------------------------------------

  listRegistrationTokens(orgId: string, domainId: string): Promise<{
    tokens: { id: string; tokenPrefix: string; label: string; createdAt: string; lastUsedAt: string | null }[];
  }> {
    return this.request("GET", `/v1/orgs/${orgId}/domains/${domainId}/registration-tokens`);
  }

  createRegistrationToken(
    orgId: string,
    domainId: string,
    label?: string,
  ): Promise<{ id: string; token: string; tokenPrefix: string; label: string; createdAt: string }> {
    return this.request("POST", `/v1/orgs/${orgId}/domains/${domainId}/registration-tokens`, { label });
  }

  revokeRegistrationToken(orgId: string, domainId: string, tokenId: string): Promise<void> {
    return this.request(
      "DELETE",
      `/v1/orgs/${orgId}/domains/${domainId}/registration-tokens/${tokenId}`,
    );
  }

  // --- Inboxes (agents) ------------------------------------------------------

  listInboxes(orgId: string, domainId: string): Promise<{
    agents: { id: string; emailAddress: string; aliasAddress: string; label: string; createdAt: string }[];
  }> {
    return this.request("GET", `/v1/orgs/${orgId}/domains/${domainId}/agents`);
  }

  createInbox(
    orgId: string,
    domainId: string,
    localPart: string,
    label?: string,
  ): Promise<{ id: string; emailAddress: string; aliasAddress: string; apiKey: string }> {
    return this.request("POST", `/v1/orgs/${orgId}/domains/${domainId}/agents`, { localPart, label });
  }

  removeInbox(orgId: string, domainId: string, agentId: string): Promise<void> {
    return this.request("DELETE", `/v1/orgs/${orgId}/domains/${domainId}/agents/${agentId}`);
  }
}

export interface DomainSummary {
  id: string;
  domain: string;
  verified: boolean;
  mxOk: boolean;
  txtOk: boolean;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface DnsRecordInstruction {
  purpose: string;
  type: string;
  name: string;
  value: string;
  priority?: number;
}

export interface DomainDetail extends DomainSummary {
  records: DnsRecordInstruction[];
}
