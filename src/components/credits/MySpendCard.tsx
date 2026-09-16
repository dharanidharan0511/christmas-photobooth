import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchMySpendCap, requestSpendCapIncrease } from "../../lib/engineClient";
import { useAuth } from "../../hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Spinner } from "../ui/Spinner";
import { ApiErrorState } from "../ui/ApiErrorState";

/**
 * Signed-in employee's own spend limit (S131 §7.2).
 *
 * This is not a wallet. An edge employee draws on the workspace owner's
 * pool; the only personal control is an optional LiteLLM cap. Asking for
 * more files a request — it does not change the cap until an admin approves.
 *
 * `compact` (Run Mind): hide when uncapped and spend is unknown, so the
 * default empty state does not occupy the one page a non-admin used to see.
 * The Credits page always shows the card.
 */
export function MySpendCard({ compact = false }: { compact?: boolean }) {
  const auth = useAuth();
  const [amount, setAmount] = useState("");
  const enabled = auth.mode === "cookie" && Boolean(auth.whoami);

  const capQuery = useQuery({
    queryKey: ["mySpendCap"],
    queryFn: ({ signal }) => fetchMySpendCap(signal),
    enabled,
  });

  const requestMutation = useMutation({
    mutationFn: (amt: number) => requestSpendCapIncrease(amt),
    onSuccess: () => setAmount(""),
  });

  if (!enabled) return null;
  if (compact && (capQuery.isLoading || capQuery.isError)) return null;
  if (!compact && capQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-mid">
          <Spinner /> Loading your spend limit…
        </CardContent>
      </Card>
    );
  }
  if (!compact && capQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your spend limit</CardTitle>
        </CardHeader>
        <CardContent>
          <ApiErrorState error={capQuery.error} onRetry={() => void capQuery.refetch()} />
        </CardContent>
      </Card>
    );
  }

  const cap = capQuery.data;
  if (!cap) return null;
  const isCapped = typeof cap.maxBudgetUsd === "number";
  const spent = typeof cap.spentUsd === "number" ? cap.spentUsd : null;
  if (compact && !isCapped && spent === null) return null;

  const remaining = isCapped && spent !== null ? Math.max(0, cap.maxBudgetUsd! - spent) : null;
  const parsed = Number(amount);
  const canRequest = amount.trim() !== "" && Number.isFinite(parsed) && parsed > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your spend limit</CardTitle>
        <CardDescription>
          {isCapped
            ? "Your personal ceiling on LLM spend. Reaching it stops your runs until it resets or an admin raises it."
            : "You have no personal limit — your runs draw on the workspace's shared credit pool. You do not have a wallet of your own."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          {isCapped && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-mid">Limit</span>{" "}
              <span className="text-sm text-ink">
                ${cap.maxBudgetUsd}
                {cap.budgetDuration ? <span className="text-mid"> per {cap.budgetDuration}</span> : null}
              </span>
            </div>
          )}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-mid">Used</span>{" "}
            <span className="text-sm text-ink">
              {spent === null ? <span className="text-mid">unknown</span> : `$${spent.toFixed(4)}`}
            </span>
          </div>
          {remaining !== null && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-mid">Left</span>{" "}
              <span className={remaining === 0 ? "text-sm text-error" : "text-sm text-ink"}>
                ${remaining.toFixed(4)}
              </span>
            </div>
          )}
          {!isCapped && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-mid">Limit</span>{" "}
              <span className="text-sm text-mid">Uncapped</span>
            </div>
          )}
        </div>

        {isCapped && (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (canRequest && !requestMutation.isPending) requestMutation.mutate(parsed);
            }}
          >
            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-mid">Ask for more (credits)</label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 500"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={!canRequest || requestMutation.isPending}>
              {requestMutation.isPending ? <Spinner className="mr-1.5" /> : null}
              Request
            </Button>
          </form>
        )}

        {compact && (
          <p className="text-xs text-mid">
            <Link to="/credits" className="text-accent hover:underline">
              Open Credits
            </Link>{" "}
            for the full picture.
          </p>
        )}

        {requestMutation.isSuccess && (
          <p className="text-xs text-success">
            Request sent — an admin has to approve it before your limit changes. Nothing is added
            to a wallet; approval raises this cap.
          </p>
        )}
        {requestMutation.isError && <ApiErrorState error={requestMutation.error} />}
      </CardContent>
    </Card>
  );
}
