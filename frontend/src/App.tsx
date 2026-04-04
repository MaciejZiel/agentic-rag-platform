import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import {
  FileText,
  MessageSquare,
  Braces,
  LayoutDashboard,
  CreditCard,
  BarChart3,
  Settings,
} from "lucide-react";
import { DashboardPage } from "@/pages/Dashboard";
import { DocumentsPage } from "@/pages/Documents";
import { ChatPage } from "@/pages/Chat";
import { ExtractPage } from "@/pages/Extract";
import { UsagePage } from "@/pages/Usage";
import { SettingsPage } from "@/pages/Settings";
import { SubscriptionsPage } from "@/pages/Subscriptions";
import { ThemeToggle } from "@/components/ThemeToggle";

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
          <div className="p-4 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Powered by RAG + OpenRouter
            </span>
            <ThemeToggle />
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
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
