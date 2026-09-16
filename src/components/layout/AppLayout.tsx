import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Spinner } from "../ui/Spinner";

function LayoutChrome() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {/* Pages manage their own scroll/padding via PageScroll or inline wrappers */}
        <main className="min-h-0 flex-1 overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Wraps all protected routes — redirects to login if no active session. */
export function AppLayout() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg text-mid">
        <Spinner />
      </div>
    );
  }

  if (!auth.isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return <LayoutChrome />;
}
