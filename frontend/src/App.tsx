import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { FileText, MessageSquare, Braces } from "lucide-react";
import { DocumentsPage } from "@/pages/Documents";
import { ChatPage } from "@/pages/Chat";
import { ExtractPage } from "@/pages/Extract";

const navItems = [
  { to: "/", icon: FileText, label: "Documents" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/extract", icon: Braces, label: "Extract" },
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
          <div className="p-4 border-t text-xs text-muted-foreground">
            Powered by RAG + OpenRouter
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<DocumentsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/extract" element={<ExtractPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
