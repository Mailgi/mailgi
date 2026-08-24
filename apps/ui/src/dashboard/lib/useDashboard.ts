import { useCallback, useEffect, useState } from "react";
import { DashboardClient } from "./dashboardClient.js";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}
export interface UserOrg {
  id: string;
  name: string;
  slug: string;
  role: string;
}

/**
 * Session bootstrap: calls GET /v1/auth/me once on mount to determine whether
 * the browser already holds a valid session cookie. Covers both a fresh
 * visit and the moment right after an OAuth redirect lands back here -- the
 * cookie is set by the API's redirect response before the browser ever runs
 * this code, so a plain mount-time check is all that's needed; there is no
 * separate "callback" page to build in this app.
 */
export function useDashboardSession(client: DashboardClient) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [orgs, setOrgs] = useState<UserOrg[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const me = await client.me();
      setUser(me.user);
      setOrgs(me.orgs);
      setError(null);
    } catch {
      setUser(null);
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await client.logout();
    setUser(null);
    setOrgs([]);
  }, [client]);

  return { loading, user, orgs, error, setError, refresh, logout };
}
