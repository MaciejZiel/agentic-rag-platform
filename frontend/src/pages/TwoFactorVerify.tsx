import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Shield, ArrowRight, KeyRound, LifeBuoy } from "lucide-react";
import { authVerify2FA, setTokens } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

interface Props {
  challengeToken: string;
  email?: string;
  onVerified: () => void;
  onCancel: () => void;
}

export function TwoFactorVerify({ challengeToken, email, onVerified, onCancel }: Props) {
  usePageTitle("Two-Factor Authentication");
  const [method, setMethod] = useState<"totp" | "backup">("totp");
  const [otpValue, setOtpValue] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    setError(null);
    setLoading(true);

    const code = method === "totp" ? otpValue : backupCode.trim();
    if (!code) {
      setError("Please enter a code.");
      setLoading(false);
      return;
    }

    try {
      const tokens = await authVerify2FA(challengeToken, code);
      setTokens(tokens.access_token, tokens.refresh_token);
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto rounded-full bg-primary/10 p-4 w-fit">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Two-Factor Authentication
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {method === "totp"
                ? "Enter the 6-digit code from your authenticator app."
                : "Enter one of your recovery codes."}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex rounded-lg bg-muted p-1">
              <button
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  method === "totp"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setMethod("totp");
                  setError(null);
                }}
              >
                <KeyRound className="h-3 w-3 inline mr-1 -mt-0.5" />
                Authenticator
              </button>
              <button
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  method === "backup"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setMethod("backup");
                  setError(null);
                }}
              >
                <LifeBuoy className="h-3 w-3 inline mr-1 -mt-0.5" />
                Recovery Code
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {method === "totp" ? (
              <div className="flex flex-col items-center space-y-4">
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

                {email && (
                  <p className="text-[10px] text-muted-foreground">
                    Authenticator app linked to {email}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="backup-code">Recovery Code</Label>
                <Input
                  id="backup-code"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  placeholder="xxxx-xxxx-xxxx"
                  className="font-mono text-center tracking-widest"
                />
                <p className="text-[10px] text-muted-foreground">
                  Each recovery code can only be used once.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive text-center">
                {error}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={
                loading ||
                (method === "totp"
                  ? otpValue.length < 6
                  : !backupCode.trim())
              }
            >
              {loading ? (
                "Verifying..."
              ) : (
                <>
                  Verify <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            <Separator />

            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={onCancel}
              >
                Sign in with a different account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
