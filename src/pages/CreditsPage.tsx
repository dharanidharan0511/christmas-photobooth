import { MySpendCard } from "../components/credits/MySpendCard";
import { EmployeeCapsTable } from "../components/credits/EmployeeCapsTable";
import { AdminPageHeader, AdminSectionLayout } from "../components/layout/AdminSectionLayout";
import { useAuth } from "../hooks/useAuth";

/**
 * S131 credit management for the licensed edge appliance.
 *
 * Employees have no wallet. They draw on the workspace owner's pool, with an
 * optional personal spend cap. This page is the TP-Web surface for that:
 * see your own used/left numbers, ask for a cap raise, and (admins) review
 * and edit everyone's caps.
 */
export function CreditsPage() {
  const auth = useAuth();
  const isAdmin = auth.mode === "key" || Boolean(auth.whoami?.isAdmin);

  return (
    <AdminSectionLayout>
      <AdminPageHeader
        title="Credits"
        description="Spend is billed to the workspace owner. Your personal cap — if you have one — is a ceiling, not a balance. Raising it does not add credits."
      />

      <MySpendCard />

      {isAdmin && <EmployeeCapsTable />}
    </AdminSectionLayout>
  );
}
