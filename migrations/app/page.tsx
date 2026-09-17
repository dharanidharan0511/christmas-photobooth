import { redirect } from "next/navigation";

/**
 * Root page — immediately redirects to /dashboard.
 * The redirect is also configured in next.config.js for static/CDN paths;
 * this component handles the server-side case during a client navigation.
 */
export default function RootPage() {
  redirect("/dashboard");
}
