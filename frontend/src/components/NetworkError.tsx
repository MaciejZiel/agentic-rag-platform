import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function NetworkError({ message, onRetry }: Props) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <WifiOff className="h-7 w-7 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Connection error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {message || "Unable to reach the server. Check your internet connection or try again later."}
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          )}
          <Button size="sm" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ServerError({ statusCode = 500 }: { statusCode?: number }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-6xl font-bold text-muted-foreground/30">{statusCode}</div>
        <div>
          <h3 className="font-semibold text-lg">Server error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Something went wrong on our end. Our team has been notified. Please try again in a few minutes.
          </p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </div>
    </div>
  );
}
