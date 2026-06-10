import * as React from "react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md transition-opacity duration-300">
      <div className="flex flex-col items-center gap-4">
        {/* Glowing and pulsing icon logo */}
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-accent opacity-30 blur-xl animate-pulse" />
          <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white font-black text-2xl shadow-elevated animate-bounce">
            A
          </div>
        </div>
        
        {/* Subtle, modern spinning loading ring */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase animate-pulse">
            Loading...
          </p>
        </div>
      </div>
    </div>
  );
}
