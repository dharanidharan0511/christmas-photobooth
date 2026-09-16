import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UsersPage } from "./pages/UsersPage";
import { UserDetailPage } from "./pages/UserDetailPage";
import { RolesPage } from "./pages/RolesPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { RunPage } from "./pages/RunPage";
import { CreditsPage } from "./pages/CreditsPage";
import { CodeReposPage } from "./pages/CodeReposPage";
import { CodeRepoViewerPage } from "./pages/CodeRepoViewerPage";
import { CodeRepoKanbanPage } from "./pages/CodeRepoKanbanPage";
import { CodeRepoReviewPage } from "./pages/CodeRepoReviewPage";
import { DocFloAgentsPage } from "./pages/DocFloAgentsPage";
import { DocFloAgentChatPage } from "./pages/DocFloAgentChatPage";
import { DocFloCorpusPage } from "./pages/DocFloCorpusPage";
import { MyProfilePage } from "./pages/MyProfilePage";
import { ShortcutsProvider } from "./context/ShortcutsContext";
import { ShortcutsModal } from "./components/ui/ShortcutsModal";
import { useAuth } from "./hooks/useAuth";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

/**
 * Gates pages to signed-in admins only.
 * Non-admins are sent back to Workbench rather than a blank /run redirect.
 */
function RequireAdmin({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const isAdmin = auth.mode === "key" || Boolean(auth.whoami?.isAdmin);
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Renderless component — activates global keyboard shortcuts. */
function GlobalShortcutListener() {
  useKeyboardShortcuts();
  return null;
}

export function App() {
  return (
    <ShortcutsProvider>
      <GlobalShortcutListener />
      <ShortcutsModal />
      <Routes>
        {/* Public */}
        <Route path="/" element={<LoginPage />} />

        {/* All authenticated users */}
        <Route element={<AppLayout />}>
          {/* ── Workbench — visible to everyone ── */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/user" element={<MyProfilePage />} />

          {/* ── Run Minds ── */}
          <Route path="/run" element={<RunPage />} />

          {/* ── CodeFlo+ ── */}
          <Route path="/code-repos" element={<CodeReposPage />} />
          {/* Bare repo URL → redirect to the Kanban (project home) tab */}
          <Route path="/code-repos/:repoId" element={<Navigate to="kanban" replace />} />
          <Route path="/code-repos/:repoId/kanban" element={<CodeRepoKanbanPage />} />
          <Route path="/code-repos/:repoId/review" element={<CodeRepoReviewPage />} />
          <Route path="/code-repos/:repoId/code"   element={<CodeRepoViewerPage />} />

          {/* ── DocFlo+ ── */}
          <Route path="/docflo/agents"                      element={<DocFloAgentsPage />} />
          <Route path="/docflo/agents/:agentId"             element={<DocFloAgentChatPage />} />
          <Route path="/docflo/agents/:agentId/corpus"      element={<DocFloCorpusPage />} />

          {/* ── Admin-only ── */}
          <Route path="/users"   element={<RequireAdmin><UsersPage /></RequireAdmin>} />
          <Route path="/users/:id" element={<RequireAdmin><UserDetailPage /></RequireAdmin>} />
          <Route path="/roles"   element={<RequireAdmin><RolesPage /></RequireAdmin>} />
          <Route path="/audit"   element={<RequireAdmin><AuditLogPage /></RequireAdmin>} />
          <Route path="/credits" element={<RequireAdmin><CreditsPage /></RequireAdmin>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShortcutsProvider>
  );
}
