import { useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Mail,
  Copy,
  Check,
  ArrowRight,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

interface Props {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

type SetupStep = "choose" | "totp-scan" | "totp-verify" | "email-verify" | "backup-codes" | "done";

// Fake TOTP secret for demo
const DEMO_SECRET = "JBSWY3DPEHPK3PXP";
const DEMO_BACKUP_CODES = [
  "a4f2-8k9x-m3p1",
  "b7c3-2n5v-q8r6",
  "d9e1-4j7w-s2t5",
  "f3g6-1h8y-u5v9",
  "k2l5-9m3z-w7x4",
  "n8p1-6q4a-y2b3",
  "r4s7-3t6c-z9d1",
  "v1w4-8x2e-b5f8",
];

export function TwoFactorSetup({ enabled, onToggle }: Props) {
  const [step, setStep] = useState<SetupStep>("choose");
  const [method, setMethod] = useState<"totp" | "email">("totp");
  const [otpValue, setOtpValue] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleVerifyTOTP() {
    setVerifyError(null);
    if (otpValue.length === 6) {
      setStep("backup-codes");
    } else {
      setVerifyError("Please enter a valid 6-digit code.");
    }
  }

  function handleVerifyEmail() {
    setVerifyError(null);
    if (emailCode.length >= 4) {
      setStep("backup-codes");
    } else {
      setVerifyError("Please enter the verification code.");
    }
  }

  function handleFinish() {
    onToggle(true);
    setStep("done");
  }

  function handleDisable() {
    onToggle(false);
    setShowDisableConfirm(false);
    setStep("choose");
    setOtpValue("");
    setEmailCode("");
  }

  // Already enabled — show status card
  if (enabled && step === "done") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600" /> Two-Factor
            Authentication
            <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/30 ml-auto">
              Enabled
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Your account is protected
                </p>
                <p className="text-xs text-green-600/80 dark:text-green-500/80 mt-0.5">
                  Two-factor authentication is active using{" "}
                  {method === "totp" ? "authenticator app" : "email verification"}.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setStep("backup-codes");
              }}
            >
              <KeyRound className="h-3 w-3 mr-1" />
              View Backup Codes
            </Button>

            {showDisableConfirm ? (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-destructive">Are you sure?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={handleDisable}
                >
                  Disable
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowDisableConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive ml-auto"
                onClick={() => setShowDisableConfirm(true)}
              >
                <ShieldOff className="h-3 w-3 mr-1" />
                Disable 2FA
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Backup codes view (accessible from enabled state too)
  if (step === "backup-codes") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Backup Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Save these codes</strong> in a secure location. Each code
                can only be used once. If you lose your authenticator, these are
                your only way to access your account.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEMO_BACKUP_CODES.map((code) => (
              <div
                key={code}
                className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-center"
              >
                {code}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleCopy(DEMO_BACKUP_CODES.join("\n"))}
            >
              {copied ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              Copy All
            </Button>
          </div>

          <Separator />

          {enabled ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setStep("done")}
            >
              Back to Security
            </Button>
          ) : (
            <Button className="w-full" onClick={handleFinish}>
              I've saved my codes — Enable 2FA{" "}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Setup flow
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" /> Two-Factor Authentication
          {enabled && (
            <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/30 ml-auto">
              Enabled
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "choose" && (
          <>
            <p className="text-xs text-muted-foreground">
              Add an extra layer of security to your account. You'll need to
              enter a verification code when signing in.
            </p>

            <div className="space-y-3">
              <button
                className={`w-full rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50 ${
                  method === "totp"
                    ? "border-primary bg-primary/5"
                    : "border-muted"
                }`}
                onClick={() => setMethod("totp")}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Authenticator App</p>
                    <p className="text-xs text-muted-foreground">
                      Use Google Authenticator, Authy, or 1Password.
                    </p>
                  </div>
                </div>
              </button>

              <button
                className={`w-full rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50 ${
                  method === "email"
                    ? "border-primary bg-primary/5"
                    : "border-muted"
                }`}
                onClick={() => setMethod("email")}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Email Verification</p>
                    <p className="text-xs text-muted-foreground">
                      Receive a code via email each time you sign in.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <Button
              className="w-full"
              onClick={() =>
                setStep(method === "totp" ? "totp-scan" : "email-verify")
              }
            >
              Set Up {method === "totp" ? "Authenticator" : "Email"}{" "}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}

        {step === "totp-scan" && (
          <>
            <div className="text-center space-y-3">
              <p className="text-sm font-medium">
                Scan this QR code with your authenticator app
              </p>

              {/* Simulated QR code */}
              <div className="mx-auto w-48 h-48 rounded-xl border-2 bg-white p-3 flex items-center justify-center">
                <div className="w-full h-full rounded-lg bg-[repeating-conic-gradient(#000_0%_25%,#fff_0%_50%)] bg-[length:12px_12px] opacity-80" />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Can't scan? Enter this key manually:
                </p>
                <div className="flex items-center justify-center gap-2">
                  <code className="rounded-md bg-muted px-3 py-1.5 text-xs font-mono tracking-widest">
                    {DEMO_SECRET}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleCopy(DEMO_SECRET)}
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium text-center">
                Enter the 6-digit code from your app
              </p>

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpValue}
                  onChange={setOtpValue}
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

              {verifyError && (
                <p className="text-xs text-destructive text-center">
                  {verifyError}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep("choose");
                  setOtpValue("");
                  setVerifyError(null);
                }}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleVerifyTOTP}
                disabled={otpValue.length < 6}
              >
                Verify <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {step === "email-verify" && (
          <>
            <div className="text-center space-y-2">
              <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">Check your email</p>
              <p className="text-xs text-muted-foreground">
                We've sent a verification code to your email address. Enter it
                below to confirm.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-code">Verification Code</Label>
              <Input
                id="email-code"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyEmail()}
                placeholder="Enter 6-digit code"
                className="text-center font-mono tracking-widest"
              />
            </div>

            {verifyError && (
              <p className="text-xs text-destructive text-center">
                {verifyError}
              </p>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
              >
                Resend code
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep("choose");
                  setEmailCode("");
                  setVerifyError(null);
                }}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleVerifyEmail}
                disabled={!emailCode.trim()}
              >
                Verify <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
