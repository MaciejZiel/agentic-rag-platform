import { useState } from "react";
import {
  LogIn,
  UserPlus,
  Key,
  Sparkles,
  Mail,
  User,
  Building2,
  ArrowRight,
  ArrowLeft,
  Shield,
  FileText,
  MessageSquare,
  Braces,
  Globe,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { createTenant } from "@/lib/api";

interface Props {
  onLogin: (apiKey: string, tenantName: string, email?: string) => void;
}

type AccountType = "personal" | "organization";
type RegisterStep = "type" | "details" | "done";

export function LoginPage({ onLogin }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");

  // Login state
  const [apiKey, setApiKey] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Register state
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("type");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registeredKey, setRegisteredKey] = useState<string | null>(null);

  function resetRegister() {
    setRegisterStep("type");
    setFullName("");
    setOrgName("");
    setRegisterEmail("");
    setRegisteredKey(null);
    setError(null);
  }

  async function handleLogin() {
    if (!apiKey.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/documents", {
        headers: { "X-API-Key": apiKey },
      });
      if (res.ok) {
        const displayName = loginEmail || "Authenticated";
        onLogin(apiKey, displayName, loginEmail || undefined);
      } else {
        setError("Invalid API key. Please check and try again.");
      }
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    const name = accountType === "personal" ? fullName : orgName;
    if (!name.trim() || !registerEmail.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const result = await createTenant(name);
      setRegisteredKey(result.api_key);
      setRegisterStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function handleUseKey() {
    if (registeredKey) {
      const name = accountType === "personal" ? fullName : orgName;
      onLogin(registeredKey, name, registerEmail);
    }
  }

  const features = [
    {
      icon: FileText,
      title: "Smart Document Processing",
      desc: "Upload PDFs, DOCX, and text files with automatic chunking and embedding.",
    },
    {
      icon: MessageSquare,
      title: "AI-Powered Q&A",
      desc: "Ask questions across your documents with cited, accurate answers.",
    },
    {
      icon: Braces,
      title: "Structured Extraction",
      desc: "Extract structured JSON data from documents using custom schemas.",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      desc: "Multi-tenant isolation, API key auth, webhooks with HMAC signatures.",
    },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — Branding panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary/[0.03] border-r flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Agentic RAG</h1>
              <p className="text-xs text-muted-foreground">
                Document Intelligence Platform
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">
              Turn your documents into
              <br />
              <span className="text-primary">actionable intelligence.</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Upload, index, and query your documents with state-of-the-art RAG
              technology. Get precise answers with source citations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border bg-background/60 p-4 space-y-2"
              >
                <div className="rounded-lg bg-primary/10 p-2 w-fit">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <span>256-bit encryption</span>
          <Separator orientation="vertical" className="h-3" />
          <span>SOC 2 compliant</span>
          <Separator orientation="vertical" className="h-3" />
          <span>99.9% uptime</span>
        </div>
      </div>

      {/* Right — Auth form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile brand */}
          <div className="lg:hidden text-center space-y-2">
            <div className="mx-auto rounded-xl bg-primary/10 p-3 w-fit">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Agentic RAG</h1>
            <p className="text-sm text-muted-foreground">
              Document Intelligence Platform
            </p>
          </div>

          <Card className="border-0 shadow-lg lg:border lg:shadow-sm">
            {/* Tab switcher */}
            <CardHeader className="pb-4">
              <div className="flex rounded-lg bg-muted p-1">
                <button
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                    tab === "login"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setTab("login");
                    setError(null);
                    resetRegister();
                  }}
                >
                  <LogIn className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  Sign In
                </button>
                <button
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                    tab === "register"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setTab("register");
                    setError(null);
                    resetRegister();
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  Create Account
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {tab === "login" ? (
                /* ─── SIGN IN ─── */
                <>
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-key">API Key</Label>
                      <button className="text-xs text-primary hover:underline">
                        Forgot your key?
                      </button>
                    </div>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        placeholder="rag_..."
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(v) => setRememberMe(v === true)}
                    />
                    <Label
                      htmlFor="remember"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Remember me on this device
                    </Label>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleLogin}
                    disabled={!apiKey.trim() || loading}
                  >
                    {loading ? (
                      "Signing in..."
                    ) : (
                      <>
                        Sign In <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="relative">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                      or continue with
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="w-full" disabled>
                      <Globe className="h-4 w-4 mr-2" />
                      Google SSO
                    </Button>
                    <Button variant="outline" className="w-full" disabled>
                      <KeyRound className="h-4 w-4 mr-2" />
                      SSO / SAML
                    </Button>
                  </div>
                </>
              ) : registerStep === "type" ? (
                /* ─── REGISTER: Choose type ─── */
                <>
                  <div className="text-center space-y-1 pb-2">
                    <h3 className="text-base font-semibold">
                      Choose account type
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Select the type that best fits your needs.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      className={`rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50 ${
                        accountType === "personal"
                          ? "border-primary bg-primary/5"
                          : "border-muted"
                      }`}
                      onClick={() => setAccountType("personal")}
                    >
                      <div className="rounded-lg bg-primary/10 p-2 w-fit mb-3">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-sm font-medium">Personal</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        For individual use and personal projects.
                      </p>
                    </button>

                    <button
                      className={`rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50 ${
                        accountType === "organization"
                          ? "border-primary bg-primary/5"
                          : "border-muted"
                      }`}
                      onClick={() => setAccountType("organization")}
                    >
                      <div className="rounded-lg bg-primary/10 p-2 w-fit mb-3">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-sm font-medium">Organization</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        For teams and companies with shared access.
                      </p>
                    </button>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => setRegisterStep("details")}
                  >
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </>
              ) : registerStep === "details" ? (
                /* ─── REGISTER: Details ─── */
                <>
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setRegisterStep("type")}
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>

                  <div className="text-center space-y-1 pb-1">
                    <div className="mx-auto rounded-lg bg-primary/10 p-2 w-fit mb-2">
                      {accountType === "personal" ? (
                        <User className="h-5 w-5 text-primary" />
                      ) : (
                        <Building2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <h3 className="text-base font-semibold">
                      {accountType === "personal"
                        ? "Create your account"
                        : "Set up your organization"}
                    </h3>
                  </div>

                  {accountType === "personal" ? (
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="John Doe"
                          className="pl-9"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="reg-org">Organization Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-org"
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          placeholder="Acme Inc."
                          className="pl-9"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-email"
                        type="email"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                        placeholder="you@company.com"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleRegister}
                    disabled={
                      loading ||
                      !registerEmail.trim() ||
                      (accountType === "personal"
                        ? !fullName.trim()
                        : !orgName.trim())
                    }
                  >
                    {loading ? (
                      "Creating account..."
                    ) : (
                      <>
                        Create Account <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                    By creating an account, you agree to our{" "}
                    <span className="underline cursor-pointer">Terms of Service</span> and{" "}
                    <span className="underline cursor-pointer">Privacy Policy</span>.
                  </p>
                </>
              ) : (
                /* ─── REGISTER: Done ─── */
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="mx-auto rounded-full bg-green-500/10 p-3 w-fit">
                      <Shield className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="text-base font-semibold">
                      Account Created Successfully!
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Your API key has been generated. Save it in a secure
                      location — it won't be shown again.
                    </p>
                  </div>

                  <div className="rounded-xl bg-muted/50 border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Your API Key
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          if (registeredKey)
                            navigator.clipboard.writeText(registeredKey);
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <code className="block text-xs bg-background rounded-lg px-3 py-2.5 break-all font-mono border">
                      {registeredKey}
                    </code>
                  </div>

                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>Important:</strong> Store this key securely. You'll
                      need it to sign in and authenticate API requests.
                    </p>
                  </div>

                  <Button className="w-full" onClick={handleUseKey}>
                    Continue to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive text-center">
                  {error}
                </div>
              )}

              {tab === "login" && (
                <>
                  <Separator />
                  <div className="text-center">
                    <Button
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => onLogin("", "Guest")}
                    >
                      Continue as guest — no account needed
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-[10px] text-muted-foreground">
            Powered by OpenRouter + Qdrant + PostgreSQL
          </p>
        </div>
      </div>
    </div>
  );
}
