import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Play } from "lucide-react";
import { listMyAccess } from "../../lib/engineClient";
import { Spinner } from "../ui/Spinner";
import { ApiErrorState } from "../ui/ApiErrorState";

/** Lives inside the global `Sidebar`, visible only on `/run` — every Mind
 * Share Key (Role) the signed-in person holds, grouped exactly the way
 * RolesPage already teaches them to think about access ("a Role IS a named
 * Mind Share Key group"), with that Role's Minds nested underneath. One
 * click loads a Mind into RunPage's Run panel via `?mindId=` — the URL, not
 * a prop, is the hand-off: this component and RunPage are siblings under
 * `AppLayout`, and both read the SAME `["myAccess"]` query, so by the time
 * a click navigates, RunPage already has the matching `MindSummary` sitting
 * in the shared TanStack Query cache. */
export function RunMindsNav() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeMindId = searchParams.get("mindId") ?? "";
  const accessQuery = useQuery({ queryKey: ["myAccess"], queryFn: ({ signal }) => listMyAccess(signal) });
  const grants = accessQuery.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-line pt-2">
      <div className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-mid">
        <KeyRound size={12} /> Mind Share Keys
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 pb-2">
        {accessQuery.isLoading && (
          <div className="flex items-center gap-2 px-2.5 py-1 text-xs text-mid">
            <Spinner className="h-3 w-3" /> Loading…
          </div>
        )}
        {accessQuery.isError && (
          <div className="px-1.5">
            <ApiErrorState error={accessQuery.error} onRetry={() => accessQuery.refetch()} />
          </div>
        )}
        {accessQuery.isSuccess && grants.length === 0 && (
          <p className="px-2.5 text-xs leading-snug text-mid">
            No Role assigned yet — ask an admin to map one to a Mind Share Key.
          </p>
        )}

        {grants.map((grant) => {
          const keyLabels = grant.keyNames
            .map((name, i) => name ?? grant.keyPrefixes[i])
            .filter((v): v is string => Boolean(v));

          return (
            <div key={grant.roleId}>
              <div className="rounded-md px-2.5 py-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink" title={grant.roleName}>
                  <KeyRound size={11} className="shrink-0 text-accent" />
                  <span className="truncate">{grant.roleName}</span>
                </div>
                <p
                  className="truncate pl-[17px] text-[10px] text-mid"
                  title={grant.projectName ?? grant.projectId}
                >
                  {grant.projectName ?? `Project ${grant.projectId.slice(0, 8)}…`}
                </p>
                {keyLabels.length > 0 && (
                  <p className="truncate pl-[17px] text-[10px] text-light" title={keyLabels.join(", ")}>
                    Key: {keyLabels.join(", ")}
                  </p>
                )}
              </div>

              <div className="mt-0.5 space-y-0.5">
                {grant.minds.length === 0 ? (
                  <p className="py-1 pl-8 pr-2 text-[11px] text-mid">No published Minds yet.</p>
                ) : (
                  grant.minds.map((mind) => {
                    const active = mind.id === activeMindId;
                    return (
                      <button
                        key={mind.id}
                        type="button"
                        onClick={() => navigate(`/run?mindId=${mind.id}`)}
                        className={`flex w-full items-center gap-2 rounded-md py-1.5 pl-8 pr-2 text-left text-xs transition-colors ${
                          active ? "bg-accent/10 font-medium text-accent" : "text-ink hover:bg-surface-hover"
                        }`}
                      >
                        <Play size={11} className="shrink-0" />
                        <span className="truncate">{mind.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
