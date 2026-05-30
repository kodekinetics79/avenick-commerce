"use client";

import * as React from "react";
import { cn } from "@manzil/utils";

interface PageLoaderProps {
  className?: string;
  text?: string;
}

export function PageLoader({ className, text }: PageLoaderProps) {
  return (
    <div className={cn("flex min-h-[400px] flex-col items-center justify-center gap-4", className)}>
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-4 border-muted" />
        <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
      </div>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

export function FullPageLoader({ text }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <PageLoader text={text} />
    </div>
  );
}
