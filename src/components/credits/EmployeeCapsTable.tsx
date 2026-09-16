import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getUserSpendCap, listUsers } from "../../lib/engineClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "../ui/Table";
import { Spinner } from "../ui/Spinner";
import { ApiErrorState } from "../ui/ApiErrorState";
import { EmptyState } from "../ui/EmptyState";
import { Coins } from "lucide-react";

function formatCap(maxBudgetUsd: number | null | undefined, duration: string | null | undefined) {
  if (typeof maxBudgetUsd !== "number") return "Uncapped";
  return duration ? `$${maxBudgetUsd} / ${duration}` : `$${maxBudgetUsd}`;
}

/** Admin view of every employee's optional spend cap. Raising a cap does not
 * add credits — employees have no wallet. Edit a row from the user page. */
export function EmployeeCapsTable() {
  const navigate = useNavigate();
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: ({ signal }) => listUsers(signal),
  });
  const users = usersQuery.data ?? [];

  const capQueries = useQueries({
    queries: users.map((user) => ({
      queryKey: ["spendCap", user.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => getUserSpendCap(user.id, signal),
      enabled: users.length > 0,
    })),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee spend caps</CardTitle>
        <CardDescription>
          Optional personal ceilings on the workspace pool. Uncapped is the default.
          Open a person to set or clear their cap. Approving a request raises this
          number — it never credits a balance.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {usersQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-mid">
            <Spinner /> Loading people…
          </div>
        ) : usersQuery.isError ? (
          <div className="p-5">
            <ApiErrorState error={usersQuery.error} onRetry={() => void usersQuery.refetch()} />
          </div>
        ) : users.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Coins className="mx-auto" size={28} strokeWidth={1.5} />}
              title="No employees yet"
              description="People appear here after they are added or sign in."
            />
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Person</TH>
                <TH>Cap</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {users.map((user, index) => {
                const capQuery = capQueries[index];
                return (
                  <TR
                    key={user.id}
                    clickable
                    onClick={() => navigate(`/users/${user.id}`)}
                  >
                    <TD>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">{user.displayName || user.email}</p>
                        {user.displayName ? (
                          <p className="truncate text-xs text-mid">{user.email}</p>
                        ) : null}
                      </div>
                    </TD>
                    <TD className="text-sm text-ink">
                      {capQuery?.isLoading ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : capQuery?.isError ? (
                        <span className="text-mid">Couldn’t load</span>
                      ) : (
                        formatCap(capQuery?.data?.maxBudgetUsd, capQuery?.data?.budgetDuration)
                      )}
                    </TD>
                    <TD className="text-xs text-mid">{user.status}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
