import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import {
  FileText,
  MessageSquare,
  Braces,
  LayoutDashboard,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardPage } from "@/pages/Dashboard";
import { DocumentsPage } from "@/pages/Documents";
import { ChatPage } from "@/pages/Chat";
import { ExtractPage } from "@/pages/Extract";
import { UsagePage } from "@/pages/Usage";
import { SettingsPage } from "@/pages/Settings";
import { SubscriptionsPage } from "@/pages/Subscriptions";
import { LoginPage } from "@/pages/Login";
import { TwoFactorVerify } from "@/pages/TwoFactorVerify";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface Session {
  apiKey: string;
  tenantName: string;
  email?: string;
  twoFactorEnabled?: boolean;
  twoFactorVerified?: boolean;
  accountType?: "personal" | "organization";
  avatarUrl?: string;
}

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/documents", icon: FileText, label: "Documents" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/extract", icon: Braces, label: "Extract" },
  { to: "/usage", icon: BarChart3, label: "Usage" },
  { to: "/subscriptions", icon: CreditCard, label: "Plans" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem("session");
    return saved ? JSON.parse(saved) : null;
  });

  function handleLogin(apiKey: string, tenantName: string, email?: string) {
    const twoFAState = localStorage.getItem("2fa_enabled");
    const twoFactorEnabled = twoFAState === "true";

    const s: Session = {
      apiKey,
      tenantName,
      email,
      twoFactorEnabled,
      twoFactorVerified: !twoFactorEnabled, // skip verify if 2FA not enabled
    };
    setSession(s);
    localStorage.setItem("session", JSON.stringify(s));
  }

  function handle2FAVerified() {
    if (!session) return;
    const s: Session = { ...session, twoFactorVerified: true };
    setSession(s);
    localStorage.setItem("session", JSON.stringify(s));
  }

  function handleLogout() {
    setSession(null);
    localStorage.removeItem("session");
  }

  function handleSessionUpdate(updates: Partial<Session>) {
    if (!session) return;
    const s = { ...session, ...updates };
    setSession(s);
    localStorage.setItem("session", JSON.stringify(s));
  }

  // Not logged in
  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Logged in but 2FA not yet verified
  if (session.twoFactorEnabled && !session.twoFactorVerified) {
    return (
      <TwoFactorVerify
        email={session.email}
        onVerified={handle2FAVerified}
        onCancel={handleLogout}
      />
    );
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen">
        <aside className="w-56 border-r bg-sidebar flex flex-col">
          <div className="p-4 border-b">
            <h1 className="text-base font-semibold tracking-tight">
              Agentic RAG
            </h1>
            <p className="text-xs text-muted-foreground">
              Document Intelligence
            </p>
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
                <p className="text-xs font-medium truncate">{session.tenantName}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {session.email || (session.apiKey ? "Authenticated" : "Guest")}
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
                RAG + OpenRouter
              </span>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/extract" element={<ExtractPage />} />
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  session={session}
                  onSessionUpdate={handleSessionUpdate}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
