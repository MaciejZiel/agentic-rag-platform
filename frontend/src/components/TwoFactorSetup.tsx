import { useEffect, useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  ArrowRight,
  AlertTriangle,
  KeyRound,
  Loader2,
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
import {
  type TwoFactorSetup as SetupData,
  disable2FA,
  enable2FA,
  get2FAStatus,
  regenerateRecoveryCodes,
  start2FASetup,
} from "@/lib/api";

interface Props {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

type Step = "idle" | "scan" | "codes" | "disable" | "regenerate";

function OtpField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex justify-center">
      <InputOTP maxLength={6} value={value} onChange={onChange}>
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
  );
}

export function TwoFactorSetup({ enabled, onToggle }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [otp, setOtp] = useState("");
  const [code, setCode] = useState(""); // TOTP or recovery code
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    get2FAStatus()
      .then((s) => setRemaining(s.recovery_codes_remaining))
      .catch(() => setRemaining(null));
  }, [enabled, step]);

  function reset(next: Step = "idle") {
    setStep(next);
    setOtp("");
    setCode("");
    setPassword("");
    setError(null);
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const startSetup = () =>
    run(async () => {
      setSetup(await start2FASetup());
      reset("scan");
    });

  const confirmSetup = () =>
    run(async () => {
      const res = await enable2FA(otp);
      setRecoveryCodes(res.recovery_codes);
      setSetup(null);
      onToggle(true);
      reset("codes");
    });

  const confirmDisable = () =>
    run(async () => {
      await disable2FA(password, code.trim());
      onToggle(false);
      reset();
    });

  const confirmRegenerate = () =>
    run(async () => {
      const res = await regenerateRecoveryCodes(code.trim());
      setRecoveryCodes(res.recovery_codes);
      reset("codes");
    });

  const errorBox = error && <p className="text-xs text-destructive text-center">{error}</p>;

  const header = (
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-medium flex items-center gap-2">
        {enabled ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <Shield className="h-4 w-4" />}
        Two-Factor Authentication
        {enabled && (
          <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/30 ml-auto">
            Enabled
          </Badge>
        )}
      </CardTitle>
    </CardHeader>
  );

  // Recovery codes are only ever shown right after they are generated.
  if (step === "codes") {
    return (
      <Card>
        {header}
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Save these recovery codes now.</strong> They will not be shown again.
                Each code works once and lets you sign in without your authenticator.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {recoveryCodes.map((c) => (
              <div key={c} className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-center">
                {c}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => copy(recoveryCodes.join("\n"), "codes")}>
              {copied === "codes" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              Copy all
            </Button>
            <Button size="sm" className="text-xs ml-auto" onClick={() => { setRecoveryCodes([]); reset(); }}>
              I've saved them
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "scan" && setup) {
    return (
      <Card>
        {header}
        <CardContent className="space-y-4">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium">Scan this QR code with your authenticator app</p>
            <img
              src={setup.qr_svg}
              alt="QR code for your authenticator app"
              className="mx-auto w-48 h-48 rounded-xl border-2 bg-white p-2"
            />
            <p className="text-xs text-muted-foreground">Can't scan? Enter this key manually:</p>
            <div className="flex items-center justify-center gap-2">
              <code className="rounded-md bg-muted px-3 py-1.5 text-xs font-mono tracking-widest break-all">
                {setup.secret}
              </code>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(setup.secret, "secret")}>
                {copied === "secret" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          <Separator />
          <p className="text-sm font-medium text-center">Enter the 6-digit code from your app</p>
          <OtpField value={otp} onChange={setOtp} />
          {errorBox}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setSetup(null); reset(); }}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={confirmSetup} disabled={busy || otp.length < 6}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enable <ArrowRight className="h-4 w-4 ml-2" /></>}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "disable" || step === "regenerate") {
    const disabling = step === "disable";
    return (
      <Card>
        {header}
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {disabling
              ? "Confirm with your password and a code from your authenticator (or a recovery code)."
              : "All previous recovery codes stop working. Confirm with a code from your authenticator."}
          </p>
          {disabling && (
            <div className="space-y-1">
              <Label htmlFor="tfa-password">Password</Label>
              <Input id="tfa-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="tfa-code">Code</Label>
            <Input
              id="tfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456 or xxxx-xxxx-xxxx"
              className="font-mono tracking-widest"
              autoComplete="one-time-code"
            />
          </div>
          {errorBox}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => reset()}>
              Cancel
            </Button>
            <Button
              variant={disabling ? "destructive" : "default"}
              className="flex-1"
              disabled={busy || code.trim().length < 6 || (disabling && !password)}
              onClick={disabling ? confirmDisable : confirmRegenerate}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : disabling ? "Disable 2FA" : "Generate new codes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent className="space-y-3">
        {enabled ? (
          <>
            <p className="text-xs text-muted-foreground">
              Signing in requires a code from your authenticator app.
              {remaining !== null && ` ${remaining} recovery code${remaining === 1 ? "" : "s"} left.`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => reset("regenerate")}>
                <KeyRound className="h-3 w-3 mr-1" /> New recovery codes
              </Button>
              <Button variant="ghost" size="sm" className="text-xs text-destructive ml-auto" onClick={() => reset("disable")}>
                <ShieldOff className="h-3 w-3 mr-1" /> Disable 2FA
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Add an extra layer of security: after your password, sign-in will ask for a code
              from an authenticator app such as Google Authenticator, Authy or 1Password.
            </p>
            {errorBox}
            <Button className="w-full" onClick={startSetup} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Set up authenticator <ArrowRight className="h-4 w-4 ml-2" /></>}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
