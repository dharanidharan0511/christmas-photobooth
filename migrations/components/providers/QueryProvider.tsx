"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * React Query provider — Client Component.
 *
 * Creates a new QueryClient per browser session (not shared across requests
 * in the server — each Client Component tree gets its own instance via
 * useState, which guarantees isolation in concurrent rendering).
 *
 * Default query options mirror the source Vite app's behaviour:
 *  - staleTime: 0 (always refetch on mount unless overridden per-query)
 *  - retry: 1 (one retry on failure before surfacing an error)
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            retry: 1,
            refetchOnWindowFocus: true,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
