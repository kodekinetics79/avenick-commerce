import type { ReactNode } from "react";
import { BrandMark } from "./brand-mark";
import { Dateline } from "./dateline";
import { Surface } from "./surface";

export interface PortalAccessCapability {
  icon: ReactNode;
  title: string;
  body: string;
}

export interface PortalAccessShellProps {
  brand: string;
  portalName: string;
  title: string;
  description: string;
  capabilities: PortalAccessCapability[];
  accessTitle: string;
  accessDescription: string;
  children: ReactNode;
  belowCard?: ReactNode;
  provenance?: string;
  utility?: ReactNode;
}

/**
 * The shared front door for operational portals.
 *
 * It deliberately gives supplier and admin access the same composition while
 * leaving their copy, density and controls to the owning app. The single glass
 * slab is chrome rather than decoration: it separates the credential action
 * from the operational context behind it and stays within the seller/admin
 * budget of two blurred surfaces per viewport.
 */
export function PortalAccessShell({
  brand,
  portalName,
  title,
  description,
  capabilities,
  accessTitle,
  accessDescription,
  children,
  belowCard,
  provenance,
  utility,
}: PortalAccessShellProps) {
  return (
    <main className="u-route px-gutter relative flex min-h-dvh items-center pb-8 pt-24 sm:pb-12 sm:pt-24 lg:py-12">
      {utility && <div className="end-gutter absolute top-5 z-10 sm:top-7">{utility}</div>}
      <div className="max-w-shell mx-auto grid w-full items-center gap-9 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.72fr)] lg:gap-16 xl:gap-24">
        <section className="min-w-0">
          <div className="flex items-center gap-3">
            <BrandMark name={brand} size={42} />
            <div className="border-hairline min-w-0 border-s ps-3">
              <p className="u-ui text-ink-1 truncate font-semibold">{brand}</p>
              <p className="u-meta text-ink-3 truncate">{portalName}</p>
            </div>
          </div>

          <h1 className="u-h1 text-ink-1 mt-8 max-w-[15ch] text-balance sm:mt-10">{title}</h1>
          <p className="u-body max-w-desc text-ink-2 mt-4 text-pretty">{description}</p>

          <ul className="mt-8 hidden max-w-3xl grid-cols-2 gap-x-8 lg:grid" aria-label={portalName}>
            {capabilities.map((capability) => (
              <li key={capability.title} className="border-hairline flex gap-3 border-t py-4">
                <span
                  className="rounded-nested bg-primary-soft text-primary-ink mt-0.5 grid h-8 w-8 shrink-0 place-items-center"
                  aria-hidden="true"
                >
                  {capability.icon}
                </span>
                <span className="min-w-0">
                  <strong className="u-ui text-ink-1 block font-semibold">
                    {capability.title}
                  </strong>
                  <span className="u-meta text-ink-2 mt-0.5 block text-pretty">
                    {capability.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {provenance && (
            <Dateline className="mt-5 hidden max-w-2xl lg:block">{provenance}</Dateline>
          )}
        </section>

        <section className="flex min-w-0 items-center lg:justify-end" aria-label={accessTitle}>
          <div className="w-full max-w-md lg:max-w-[27rem]">
            <Surface rung={4} glass rim className="overflow-hidden">
              <div data-rule-ground="" className="p-5 sm:p-7 [&>*]:relative">
                <header className="mb-6">
                  <p className="u-meta text-primary-ink font-semibold">{portalName}</p>
                  <h2 className="u-h2 text-ink-1 mt-1 text-balance">{accessTitle}</h2>
                  <p className="u-body text-ink-2 mt-2 text-pretty">{accessDescription}</p>
                </header>
                {children}
              </div>
            </Surface>
            {belowCard}
            {provenance && <Dateline className="mt-5 lg:hidden">{provenance}</Dateline>}
          </div>
        </section>
      </div>
    </main>
  );
}
