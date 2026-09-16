import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronDown } from "lucide-react";
import { listAudit } from "../lib/engineClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/Table";
import { Spinner } from "../components/ui/Spinner";
import { ApiErrorState } from "../components/ui/ApiErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { AdminPageHeader, AdminSectionLayout } from "../components/layout/AdminSectionLayout";

export function AuditLogPage() {
  const auditQuery = useQuery({ queryKey: ["audit"], queryFn: ({ signal }) => listAudit(100, signal) });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const entries = auditQuery.data ?? [];

  return (
    <AdminSectionLayout>
      <AdminPageHeader
        title="Audit log"
        description="Every administrative and run event on this engine — immutable, edge-local. Most recent 100 entries, newest first."
      />

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>Click a row to expand its detail payload.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {auditQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-mid">
              <Spinner /> Loading audit log…
            </div>
          )}

          {auditQuery.isError && <ApiErrorState error={auditQuery.error} onRetry={() => auditQuery.refetch()} />}

          {auditQuery.isSuccess && entries.length === 0 && (
            <EmptyState title="No audit entries" description="Nothing has been recorded yet." />
          )}

          {auditQuery.isSuccess && entries.length > 0 && (
            <Table>
              <THead>
                <tr>
                  <TH className="w-8" />
                  <TH>Time</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                </tr>
              </THead>
              <TBody>
                {entries.map((entry) => {
                  const isOpen = expanded.has(entry.id);
                  return (
                    <Fragment key={entry.id}>
                      <TR clickable onClick={() => toggle(entry.id)}>
                        <TD className="text-mid">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </TD>
                        <TD className="font-mono text-xs text-mid">
                          {new Date(entry.createdAt).toLocaleString()}
                        </TD>
                        <TD className="font-medium">{entry.actor}</TD>
                        <TD>
                          <code className="rounded bg-surface-active px-1.5 py-0.5 text-xs">{entry.action}</code>
                        </TD>
                      </TR>
                      {isOpen && (
                        <tr className="border-b border-line last:border-0">
                          <td colSpan={4} className="bg-bg-subtle px-4 py-3">
                            <pre className="overflow-x-auto rounded-md border border-line bg-surface p-3 text-xs text-mid">
                              {JSON.stringify(entry.detail, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminSectionLayout>
  );
}
