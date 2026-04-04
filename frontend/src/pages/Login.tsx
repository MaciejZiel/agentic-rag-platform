import { useState } from "react";
import { LogIn, UserPlus, Key, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { createTenant } from "@/lib/api";

interface Props {
  onLogin: (apiKey: string, tenantName: string) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [apiKey, setApiKey] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredKey, setRegisteredKey] = useState<string | null>(null);

  async function handleLogin() {
    if (!apiKey.trim()) return;
    setError(null);
    // Validate the key by trying to list documents with it
    try {
      const res = await fetch("/api/v1/documents", {
        headers: { "X-API-Key": apiKey },
      });
      if (res.ok) {
        onLogin(apiKey, "Authenticated");
      } else {
        setError("Invalid API key");
      }
    } catch {
      setError("Connection error");
    }
  }

  async function handleRegister() {
    if (!tenantName.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const result = await createTenant(tenantName);
      setRegisteredKey(result.api_key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function handleUseKey() {
    if (registeredKey) {
      onLogin(registeredKey, tenantName);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="mx-auto rounded-xl bg-primary/10 p-3 w-fit">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Agentic RAG</h1>
          <p className="text-sm text-muted-foreground">
            Document Intelligence Platform
          </p>
        </div>

        <Card>
          {/* Tab switcher */}
          <CardHeader className="pb-3">
            <div className="flex rounded-lg bg-muted p-1">
              <button
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === "login"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => { setTab("login"); setError(null); setRegisteredKey(null); }}
              >
                <LogIn className="h-3.5 w-3.5 inline mr-1.5" />
                Sign In
              </button>
              <button
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === "register"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => { setTab("register"); setError(null); setRegisteredKey(null); }}
              >
                <UserPlus className="h-3.5 w-3.5 inline mr-1.5" />
                Register
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {tab === "login" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      placeholder="rag_..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={handleLogin} disabled={!apiKey.trim()}>
                  <LogIn className="h-4 w-4 mr-2" /> Sign In
                </Button>
              </>
            ) : registeredKey ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center space-y-2">
                  <p className="text-sm font-medium">Account Created!</p>
                  <p className="text-xs text-muted-foreground">
                    Save your API key — it won't be shown again.
                  </p>
                  <code className="block text-xs bg-muted rounded px-3 py-2 break-all font-mono">
                    {registeredKey}
                  </code>
                </div>
                <Button className="w-full" onClick={handleUseKey}>
                  Continue to Dashboard
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Organization Name</label>
                  <Input
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    placeholder="My Company"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleRegister}
                  disabled={!tenantName.trim() || loading}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {loading ? "Creating..." : "Create Account"}
                </Button>
              </>
            )}

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            <Separator />

            <div className="text-center">
              <Button
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={() => onLogin("", "Guest")}
              >
                Continue without account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
