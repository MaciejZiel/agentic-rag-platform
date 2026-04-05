import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedDialog } from "@/components/AnimatedDialog";

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "destructive" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "destructive",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AnimatedDialog open={open} onClose={onCancel}>
      <Card className="w-full max-w-sm mx-auto" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3">
            {variant === "destructive" && (
              <div className="rounded-full bg-destructive/10 p-2 shrink-0">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
            )}
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={variant}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AnimatedDialog>
  );
}
