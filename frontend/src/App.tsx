import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardPage } from "@/pages/Dashboard";
import { DocumentsPage } from "@/pages/Documents";
import { ChatPage } from "@/pages/Chat";
import { ExtractPage } from "@/pages/Extract";
import { UsagePage } from "@/pages/Usage";
import { SettingsPage } from "@/pages/Settings";
import { SubscriptionsPage } from "@/pages/Subscriptions";
import { CollectionsPage } from "@/pages/Collections";
import { PlaygroundPage } from "@/pages/Playground";
import { AssistantsPage } from "@/pages/Assistants";
import { AdminPage } from "@/pages/Admin";
import { ComparePage } from "@/pages/Compare";
import { WorkflowsPage } from "@/pages/Workflows";
import { LoginPage } from "@/pages/Login";
import { TwoFactorVerify } from "@/pages/TwoFactorVerify";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";
import {
  OnboardingWizard,
  isOnboardingComplete,
} from "@/components/OnboardingWizard";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
  const [needs2FA, setNeeds2FA] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // On mount: check if we have a valid token
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authGetMe()
      .then((u) => {
        if (u.is_2fa_enabled) {
          const verified = sessionStorage.getItem("2fa_verified") === "true";
          if (!verified) {
            setNeeds2FA(true);
            setUser(u);
            setLoading(false);
            return;
          }
        }
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
        if (u.is_2fa_enabled) {
          setNeeds2FA(true);
          setUser(u);
        } else {
          setUser(u);
          if (!isOnboardingComplete()) setShowOnboarding(true);
        }
      })
      .catch(() => {
        clearTokens();
      })
      .finally(() => setLoading(false));
  }

  function handle2FAVerified() {
    setNeeds2FA(false);
    sessionStorage.setItem("2fa_verified", "true");
    if (!isOnboardingComplete()) setShowOnboarding(true);
  }

  function handleLogout() {
    setUser(null);
    setNeeds2FA(false);
    clearTokens();
    sessionStorage.removeItem("2fa_verified");
  }

  // Loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <LoginPage onLogin={handleLoginSuccess} />;
  }

  // Logged in but 2FA not verified
  if (needs2FA) {
    return (
      <TwoFactorVerify
        email={user.email}
        onVerified={handle2FAVerified}
        onCancel={handleLogout}
      />
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <CommandPalette />
      <KeyboardShortcuts />
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
      <div className="flex h-screen">
        <aside className="w-56 border-r bg-sidebar flex flex-col">
          <div className="p-4 border-b">
            <h1 className="text-base font-semibold tracking-tight">
              Cortex
            </h1>
            <p className="text-xs text-muted-foreground">
              Document Intelligence
            </p>
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
          <nav className="flex-1 p-2 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
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

        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/extract" element={<ExtractPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/playground" element={<PlaygroundPage />} />
            <Route path="/assistants" element={<AssistantsPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route
              path="/settings"
              element={<SettingsPage user={user} onUserUpdate={setUser} />}
            />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </BrowserRouter>
  );
}
