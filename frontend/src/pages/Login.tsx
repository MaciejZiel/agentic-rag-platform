import { useState } from "react";
import {
  LogIn,
  UserPlus,
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
  Lock,
  Eye,
  EyeOff,
  MailCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import {
  authRegister,
  authVerifyEmail,
  authLogin,
  authResendCode,
  setTokens,
} from "@/lib/api";

interface Props {
  onLogin: () => void;
}

type AccountType = "personal" | "organization";
type RegisterStep = "type" | "details" | "verify-email" | "done";

export function LoginPage({ onLogin }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Register state
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("type");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Email verification
  const [verifyCode, setVerifyCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  function resetRegister() {
    setRegisterStep("type");
    setFullName("");
    setOrgName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setConfirmPassword("");
    setVerifyCode("");
    setError(null);
  }

  // ─── Login ───
  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const result = await authLogin(loginEmail, loginPassword);
      setTokens(result.access_token, result.refresh_token);
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  // ─── Register ───
  async function handleRegister() {
    const name = accountType === "personal" ? fullName : orgName;
    if (!name.trim() || !registerEmail.trim() || !registerPassword.trim()) return;

    if (registerPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (registerPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await authRegister(registerEmail, registerPassword, name, accountType);
      setRegisterStep("verify-email");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  // ─── Email verification ───
  async function handleVerifyEmail() {
    setError(null);
    setLoading(true);
    try {
      const result = await authVerifyEmail(registerEmail, verifyCode);
      setTokens(result.access_token, result.refresh_token);
      setRegisterStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  function handleResendCode() {
    if (resendCooldown > 0) return;
    authResendCode(registerEmail);
    setResendCooldown(30);
    const interval = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  // Password strength indicator
  function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
    if (pw.length === 0) return { label: "", color: "", width: "0%" };
    if (pw.length < 8) return { label: "Too short", color: "bg-destructive", width: "20%" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { label: "Weak", color: "bg-orange-500", width: "40%" };
    if (score <= 3) return { label: "Fair", color: "bg-yellow-500", width: "60%" };
    if (score <= 4) return { label: "Strong", color: "bg-green-500", width: "80%" };
    return { label: "Very strong", color: "bg-green-600", width: "100%" };
  }

  const pwStrength = getPasswordStrength(registerPassword);

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
              <h1 className="text-xl font-bold tracking-tight">Cortex</h1>
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
                /* ═══════════ SIGN IN ═══════════ */
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
                      <Label htmlFor="login-password">Password</Label>
                      <button className="text-xs text-primary hover:underline">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        placeholder="Enter your password"
                        className="pl-9 pr-9"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
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
                    disabled={!loginEmail.trim() || !loginPassword.trim() || loading}
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
                /* ═══════════ REGISTER: Choose type ═══════════ */
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
                /* ═══════════ REGISTER: Details ═══════════ */
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
                        placeholder="you@company.com"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-password"
                        type={showRegPassword ? "text" : "password"}
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="pl-9 pr-9"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                      >
                        {showRegPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {registerPassword.length > 0 && (
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pwStrength.color}`}
                            style={{ width: pwStrength.width }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {pwStrength.label}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-confirm"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                        placeholder="Repeat your password"
                        className="pl-9"
                      />
                    </div>
                    {confirmPassword.length > 0 && confirmPassword !== registerPassword && (
                      <p className="text-[10px] text-destructive">
                        Passwords don't match
                      </p>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleRegister}
                    disabled={
                      loading ||
                      !registerEmail.trim() ||
                      !registerPassword.trim() ||
                      !confirmPassword.trim() ||
                      registerPassword !== confirmPassword ||
                      registerPassword.length < 8 ||
                      (accountType === "personal"
                        ? !fullName.trim()
                        : !orgName.trim())
                    }
                  >
                    {loading ? (
                      "Creating account..."
                    ) : (
                      <>
                        Continue <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                    By creating an account, you agree to our{" "}
                    <span className="underline cursor-pointer">Terms of Service</span> and{" "}
                    <span className="underline cursor-pointer">Privacy Policy</span>.
                  </p>
                </>
              ) : registerStep === "verify-email" ? (
                /* ═══════════ REGISTER: Verify email ═══════════ */
                <>
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      setRegisterStep("details");
                      setVerifyCode("");
                      setError(null);
                    }}
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>

                  <div className="text-center space-y-3">
                    <div className="mx-auto rounded-full bg-primary/10 p-4 w-fit">
                      <MailCheck className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">
                        Verify your email
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        We've sent a 6-digit verification code to
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {registerEmail}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center py-2">
                    <InputOTP
                      maxLength={6}
                      value={verifyCode}
                      onChange={setVerifyCode}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleVerifyEmail}
                    disabled={verifyCode.length < 6 || loading}
                  >
                    {loading ? (
                      "Verifying..."
                    ) : (
                      <>
                        Verify Email <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Didn't receive the code?{" "}
                      {resendCooldown > 0 ? (
                        <span className="text-muted-foreground/60">
                          Resend in {resendCooldown}s
                        </span>
                      ) : (
                        <button
                          className="text-primary hover:underline font-medium"
                          onClick={handleResendCode}
                        >
                          Resend code
                        </button>
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/50 border px-3 py-2">
                    <p className="text-[10px] text-muted-foreground text-center">
                      Check your inbox and spam folder. The code expires in 15 minutes.
                    </p>
                  </div>
                </>
              ) : (
                /* ═══════════ REGISTER: Done ═══════════ */
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="mx-auto rounded-full bg-green-500/10 p-3 w-fit">
                      <Shield className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="text-base font-semibold">
                      Welcome aboard!
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Your account has been created and verified. You're all set
                      to start using the platform.
                    </p>
                  </div>

                  <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MailCheck className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{registerEmail}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Email verified successfully
                    </p>
                  </div>

                  <Button className="w-full" onClick={onLogin}>
                    Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive text-center">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-[10px] text-muted-foreground">
            Powered by Cortex AI
          </p>
        </div>
      </div>
    </div>
  );
}
