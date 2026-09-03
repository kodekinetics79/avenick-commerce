"use client";

import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Card — kept as the familiar composed API (Card / Header / Title / Description /
 * Content / Footer) because dozens of pages already use it, but it is now a
 * Surface underneath rather than the hand-written
 * `rounded-2xl border border-border bg-card shadow-sm` idiom.
 *
 * The default is rung 2: content that sits ON the page, not an action. Pass
 * `interactive` when the whole card is clickable and it becomes a rung 2→3
 * cross-fade with the 2px lift. Do not pass it on a card that merely contains a
 * button — raised means actionable, and if a raised surface is not clickable the
 * ladder stops meaning anything.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0 flat · 1 recessed · 2 the card (default) · 3 raised. */
  rung?: 0 | 1 | 2 | 3;
  /** The card itself is clickable: adds the elevation cross-fade and the lift. */
  interactive?: boolean;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, rung = 2, interactive = false, tone = "default", ...props }, ref) => (
    <div
      ref={ref}
      data-rung={rung}
      data-interactive={interactive ? "" : undefined}
      data-lift={interactive ? "" : undefined}
      data-tone={tone !== "default" ? tone : undefined}
      className={cn(rung > 0 && "border border-border", "text-ink-1", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    // Was text-lg font-bold. Rank is carried by size, never by weight — 700 and
    // above exist in this product only on a hero-rank numeral.
    <h3 ref={ref} className={cn("u-h3 text-ink-1", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("u-ui text-ink-2 u-measure-desc", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
