import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  clearAdminKey,
  fetchWhoAmI,
  getAdminKey,
  setAdminKey as persistAdminKey,
} from "../lib/engineClient";
import type { AuthMode, WhoAmI } from "../types/engine";

const LOCAL_SIGNOUT_KEY = "tp-web:local-signout";

interface AuthContextValue {
  mode: AuthMode;
  /** Populated only in 'cookie' mode. */
  whoami: WhoAmI | null;
  isLoading: boolean;
  isSignedIn: boolean;
  error: unknown;
  useAdminKey: (key: string) => void;
  signOut: () => void;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasAdminKey, setHasAdminKey] = useState(() => Boolean(getAdminKey()));
  const [locallySignedOut, setLocallySignedOut] = useState(
    () => sessionStorage.getItem(LOCAL_SIGNOUT_KEY) === "1",
  );

  const whoamiQuery = useQuery({
    queryKey: ["whoami"],
    queryFn: ({ signal }) => fetchWhoAmI(signal),
    enabled: !hasAdminKey && !locallySignedOut,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 15_000,
  });

  const useAdminKey = useCallback((key: string) => {
    persistAdminKey(key);
    sessionStorage.removeItem(LOCAL_SIGNOUT_KEY);
    setLocallySignedOut(false);
    setHasAdminKey(true);
  }, []);

  const refetch = useCallback(() => {
    sessionStorage.removeItem(LOCAL_SIGNOUT_KEY);
    setLocallySignedOut(false);
    void queryClient.invalidateQueries({ queryKey: ["whoami"] });
  }, [queryClient]);

  const signOut = useCallback(() => {
    if (hasAdminKey) {
      clearAdminKey();
      setHasAdminKey(false);
      queryClient.removeQueries({ queryKey: ["whoami"] });
      return;
    }
    // Cookie/SSO mode: the engine does not expose a logout endpoint to this
    // app, so we cannot invalidate the httpOnly session cookie from here.
    // This only signs TP-Web itself out locally (stops polling whoami and
    // treats the app as signed-out) — the underlying engine session stays
    // alive on the engine's own origin until it naturally expires.
    sessionStorage.setItem(LOCAL_SIGNOUT_KEY, "1");
    setLocallySignedOut(true);
    queryClient.removeQueries({ queryKey: ["whoami"] });
  }, [hasAdminKey, queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    if (hasAdminKey) {
      return {
        mode: "key",
        whoami: null,
        isLoading: false,
        isSignedIn: true,
        error: null,
        useAdminKey,
        signOut,
        refetch,
      };
    }
    if (locallySignedOut) {
      return {
        mode: "none",
        whoami: null,
        isLoading: false,
        isSignedIn: false,
        error: null,
        useAdminKey,
        signOut,
        refetch,
      };
    }
    return {
      mode: whoamiQuery.data ? "cookie" : "none",
      whoami: whoamiQuery.data ?? null,
      isLoading: whoamiQuery.isLoading,
      isSignedIn: Boolean(whoamiQuery.data),
      error: whoamiQuery.error,
      useAdminKey,
      signOut,
      refetch,
    };
  }, [hasAdminKey, locallySignedOut, whoamiQuery.data, whoamiQuery.isLoading, whoamiQuery.error, useAdminKey, signOut, refetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
