import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import {
  FileText,
  MessageSquare,
  Braces,
  LayoutDashboard,
  CreditCard,
  BarChart3,
  FolderOpen,
  Terminal,
  Bot,
  ShieldCheck,
  GitCompare,
  Workflow,
  Search,
  Settings,
  LogOut,
  User,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Lazy-loaded pages for code splitting
const DashboardPage = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.DashboardPage })));
const DocumentsPage = lazy(() => import("@/pages/Documents").then(m => ({ default: m.DocumentsPage })));
const ChatPage = lazy(() => import("@/pages/Chat").then(m => ({ default: m.ChatPage })));
const ExtractPage = lazy(() => import("@/pages/Extract").then(m => ({ default: m.ExtractPage })));
const UsagePage = lazy(() => import("@/pages/Usage").then(m => ({ default: m.UsagePage })));
const SettingsPage = lazy(() => import("@/pages/Settings").then(m => ({ default: m.SettingsPage })));
const SubscriptionsPage = lazy(() => import("@/pages/Subscriptions").then(m => ({ default: m.SubscriptionsPage })));
const CollectionsPage = lazy(() => import("@/pages/Collections").then(m => ({ default: m.CollectionsPage })));
const PlaygroundPage = lazy(() => import("@/pages/Playground").then(m => ({ default: m.PlaygroundPage })));
const AssistantsPage = lazy(() => import("@/pages/Assistants").then(m => ({ default: m.AssistantsPage })));
const AdminPage = lazy(() => import("@/pages/Admin").then(m => ({ default: m.AdminPage })));
const ComparePage = lazy(() => import("@/pages/Compare").then(m => ({ default: m.ComparePage })));
const WorkflowsPage = lazy(() => import("@/pages/Workflows").then(m => ({ default: m.WorkflowsPage })));
import { LoginPage } from "@/pages/Login";
import { TwoFactorVerify } from "@/pages/TwoFactorVerify";
import { NotFoundPage } from "@/pages/NotFound";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";
import {
  OnboardingWizard,
  isOnboardingComplete,
} from "@/components/OnboardingWizard";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnimatedPage } from "@/components/AnimatedPage";
import { SkipLink } from "@/components/SkipLink";
import { Toaster } from "sonner";
import {
  type AuthUser,
  authGetMe,
  clearTokens,
  getAccessToken,
} from "@/lib/api";

export type { AuthUser };

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/documents", icon: FileText, label: "Documents" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/extract", icon: Braces, label: "Extract" },
  { to: "/collections", icon: FolderOpen, label: "Collections" },
  { to: "/usage", icon: BarChart3, label: "Usage" },
  { to: "/playground", icon: Terminal, label: "Playground" },
  { to: "/assistants", icon: Bot, label: "Assistants" },
  { to: "/subscriptions", icon: CreditCard, label: "Plans" },
  { to: "/compare", icon: GitCompare, label: "Compare" },
  { to: "/workflows", icon: Workflow, label: "Workflows" },
  { to: "/admin", icon: ShieldCheck, label: "Admin" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Set after a password sign-in on a 2FA account; no tokens exist yet.
  const [challenge, setChallenge] = useState<{ token: string; email: string } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // On mount: check if we have a valid token
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authGetMe()
      .then((u) => {
        setUser(u);
        if (!isOnboardingComplete()) setShowOnboarding(true);
        setLoading(false);
      })
      .catch(() => {
        clearTokens();
        setLoading(false);
      });
  }, []);

  function handleLoginSuccess() {
    setLoading(true);
    authGetMe()
      .then((u) => {
        setUser(u);
        if (!isOnboardingComplete()) setShowOnboarding(true);
      })
      .catch(() => {
        clearTokens();
      })
      .finally(() => setLoading(false));
  }

  function handle2FAVerified() {
    setChallenge(null);
    handleLoginSuccess();
  }

  function handleLogout() {
    setUser(null);
    setChallenge(null);
    clearTokens();
  }

  // Loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Password accepted, second factor still required
  if (!user && challenge) {
    return (
      <TwoFactorVerify
        challengeToken={challenge.token}
        email={challenge.email}
        onVerified={handle2FAVerified}
        onCancel={handleLogout}
      />
    );
  }

  // Not logged in
  if (!user) {
    return (
      <LoginPage
        onLogin={handleLoginSuccess}
        onTwoFactorRequired={(token, email) => setChallenge({ token, email })}
      />
    );
  }

  return (
    <BrowserRouter>
      <SkipLink />
      <Toaster position="top-right" richColors closeButton />
      <CommandPalette />
      <KeyboardShortcuts />
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
      <div className="flex h-screen">
        {/* Mobile header */}
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold">Cortex</h1>
        </div>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside aria-label="Main navigation" className={`
          fixed inset-y-0 left-0 z-50 w-56 border-r bg-sidebar flex flex-col
          transform transition-transform md:relative md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold tracking-tight">
                Cortex
              </h1>
              <p className="text-xs text-muted-foreground">
                Document Intelligence
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation menu"
              className="md:hidden text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-3 pt-2 pb-1">
              <button
                onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
                className="w-full flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Search className="h-3 w-3" />
                <span className="flex-1 text-left">Search...</span>
                <kbd className="text-[10px] border rounded px-1 bg-background">⌘K</kbd>
              </button>
            </div>
          <nav className="flex-1 p-2 space-y-1" role="navigation" aria-label="Primary">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="p-3 border-t space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="rounded-full bg-primary/10 p-1.5">
                <User className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user.full_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleLogout}
                aria-label="Sign out"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-muted-foreground">
                Cortex AI
              </span>
              <div className="flex items-center gap-1">
                <NotificationBell />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </aside>

        <main id="main-content" role="main" className="flex-1 overflow-auto pt-14 md:pt-0">
          <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <Routes>
            <Route path="/" element={<AnimatedPage><DashboardPage /></AnimatedPage>} />
            <Route path="/documents" element={<AnimatedPage><DocumentsPage /></AnimatedPage>} />
            <Route path="/chat" element={<AnimatedPage><ChatPage /></AnimatedPage>} />
            <Route path="/extract" element={<AnimatedPage><ExtractPage /></AnimatedPage>} />
            <Route path="/collections" element={<AnimatedPage><CollectionsPage /></AnimatedPage>} />
            <Route path="/usage" element={<AnimatedPage><UsagePage /></AnimatedPage>} />
            <Route path="/playground" element={<AnimatedPage><PlaygroundPage /></AnimatedPage>} />
            <Route path="/assistants" element={<AnimatedPage><AssistantsPage /></AnimatedPage>} />
            <Route path="/subscriptions" element={<AnimatedPage><SubscriptionsPage /></AnimatedPage>} />
            <Route path="/compare" element={<AnimatedPage><ComparePage /></AnimatedPage>} />
            <Route path="/workflows" element={<AnimatedPage><WorkflowsPage /></AnimatedPage>} />
            <Route path="/admin" element={<AnimatedPage><AdminPage /></AnimatedPage>} />
            <Route
              path="/settings"
              element={<AnimatedPage><SettingsPage user={user} onUserUpdate={setUser} /></AnimatedPage>}
            />
            <Route path="*" element={<AnimatedPage><NotFoundPage /></AnimatedPage>} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </BrowserRouter>
  );
}
