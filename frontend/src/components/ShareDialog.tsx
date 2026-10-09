import { useState } from "react";
import { Link2, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedDialog } from "@/components/AnimatedDialog";
import { type ShareLinkOut, createShareLink } from "@/lib/api";
import { formatDateTime } from "@/lib/date";
import { toast } from "sonner";

interface Props {
  documentId: string;
  filename: string;
  open: boolean;
  onClose: () => void;
}

const expiryOptions = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
  { hours: 720, label: "30 days" },
];

export function ShareDialog({ documentId, filename, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<ShareLinkOut | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiryHours, setExpiryHours] = useState(72);

  async function handleCreate() {
    setLoading(true);
    try {
      const result = await createShareLink(documentId, expiryHours);
      setLink(result);
      toast.success("Share link created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create link");
    } finally {
      setLoading(false);
    }
  }

  function getShareUrl() {
    if (!link) return "";
    return `${window.location.origin}/shared/${link.token}`;
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setLink(null);
    setCopied(false);
    onClose();
  }

  return (
    <AnimatedDialog open={open} onClose={handleClose}>
      <Card className="w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Share Document</h3>
              <p className="text-xs text-muted-foreground">{filename}</p>
            </div>
          </div>

          {!link ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium">Link expires in</label>
                <div className="flex flex-wrap gap-1.5">
                  {expiryOptions.map((opt) => (
                    <button
                      key={opt.hours}
                      onClick={() => setExpiryHours(opt.hours)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        expiryHours === opt.hours
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreate} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Link2 className="h-3 w-3 mr-1" /> Create Link
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={getShareUrl()}
                    className="flex-1 bg-transparent text-xs font-mono outline-none"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                {link.expires_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Expires {formatDateTime(link.expires_at)}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px]">
                  Anyone with this link can view the document
                </Badge>
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </AnimatedDialog>
  );
}
