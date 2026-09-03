import type { Metadata } from "next";
import Link from "next/link";
import { platformName, portalUrl } from "@avenick/utils/portal-config";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Apply to sell" };

/**
 * Public entry point for a new seller. Listed in the seller portal's public
 * paths, so the middleware lets an anonymous visitor through; the customer
 * site's "Become a seller" calls to action land here.
 *
 * The terms live on the customer site. Their URL is resolved here, on the
 * server, and handed to the form so the client bundle never reads portal env
 * itself; when the origin is unknown the form shows the checkbox without a
 * link rather than guessing a host.
 */
export default function RegisterPage() {
  const brand = platformName();
  const termsUrl = portalUrl("customer", "/terms");

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 bg-grid mask-fade-b opacity-40" />
      <div className="absolute -top-20 start-1/3 h-96 w-96 rounded-full bg-primary/25 blur-[120px]" />
      <div className="absolute bottom-0 end-1/3 h-80 w-80 rounded-full bg-accent/20 blur-[120px]" />

      <div className="relative mx-auto w-full max-w-2xl animate-fade-up">
        <div className="text-center mb-8">
          <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 text-white font-black text-lg shadow-glow mb-4">
            {brand.charAt(0).toUpperCase()}
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Apply to sell on {brand}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tell us about your business and who runs it. Applications are reviewed by the platform team before a
            store can trade.
          </p>
        </div>

        <div className="glass-strong rounded-2xl p-6 shadow-elevated">
          <RegisterForm termsUrl={termsUrl} />
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have a seller account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
