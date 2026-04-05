import { Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-[80vh] p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-8xl font-bold text-muted-foreground/20">404</div>
        <div>
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="h-3 w-3 mr-1" /> Go Back
          </Button>
          <Button size="sm" asChild>
            <Link to="/"><Home className="h-3 w-3 mr-1" /> Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
