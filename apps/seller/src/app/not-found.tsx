import Link from "next/link";
import { Compass, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="max-w-lg w-full text-center space-y-6 py-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-elevated">
          <Compass className="h-7 w-7" />
        </span>
        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tighter text-gradient">404</h1>
          <h2 className="text-xl font-bold tracking-tight">Page not found</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            That page doesn't exist in Seller Central. It may have moved.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/95 transition-all shadow-glow-sm"
        >
          <LayoutDashboard className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
