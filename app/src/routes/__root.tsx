import {
  Outlet,
  createRootRoute,
  Link,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { BarChart3, FileUser, History, Search, Briefcase, LogIn, LogOut, Shield } from "lucide-react";
import { getCurrentUser, type CurrentUser } from "@/server/functions/get-current-user";
import { logoutUser } from "@/server/functions/login";

import "../styles.css";

export const Route = createRootRoute({
  component: RootComponent,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    return { user };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Job Analyzer — AI-Powered Resume Strategy" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
});

function RootComponent() {
  const { user } = Route.useRouteContext() as { user: CurrentUser | null };

  return (
    <RootDocument>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] backdrop-blur-lg">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="flex items-center gap-2.5 text-[var(--sea-ink)] no-underline">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--lagoon)] to-[var(--palm)]">
                <Briefcase className="h-4 w-4 text-[var(--sand)]" />
              </div>
              <span className="text-base font-bold tracking-tight">Job Analyzer</span>
              <span className="ml-1 rounded-full bg-[var(--lagoon)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--lagoon)]">
                AI
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              {user ? (
                <>
                  <NavLink to="/analyze" icon={<Search className="h-4 w-4" />}>
                    Analyze
                  </NavLink>
                  <NavLink to="/history" icon={<History className="h-4 w-4" />}>
                    History
                  </NavLink>
                  <NavLink to="/dashboard" icon={<BarChart3 className="h-4 w-4" />}>
                    Dashboard
                  </NavLink>
                  <NavLink to="/resume" icon={<FileUser className="h-4 w-4" />}>
                    My Profile
                  </NavLink>
                  {user.role === "admin" && (
                    <NavLink to="/admin" icon={<Shield className="h-4 w-4" />}>
                      Admin
                    </NavLink>
                  )}
                  <div className="ml-2 hidden items-center gap-2 sm:flex">
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <button
                    onClick={async () => {
                      await logoutUser();
                      window.location.href = "/";
                    }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--sea-ink-soft)] transition-colors hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              ) : (
                <NavLink to="/login" icon={<LogIn className="h-4 w-4" />}>
                  Login
                </NavLink>
              )}
            </nav>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[var(--line)] bg-[var(--header-bg)]/50 px-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between py-5 text-xs text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} Job Analyzer</span>
            <span className="text-[var(--lagoon)]/60">Powered by Cloudflare Workers AI</span>
          </div>
        </footer>
      </div>
      <TanStackRouterDevtools position="bottom-right" />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--sea-ink-soft)] transition-colors hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
      activeProps={{
        className:
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--lagoon)] bg-[var(--lagoon)]/10",
      }}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </Link>
  );
}
