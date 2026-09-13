"use client";

import * as React from "react";

/**
 * The bridge between the discovery panel and the chrome that can open it.
 *
 * WHY IT EXISTS. Below lg the panel's floating launcher sat mid-screen on every
 * page, lifted 5.5rem above the bottom edge to clear the product page's buy
 * bar. That lift was right for the buy bar and wrong for everything else it
 * then landed on. At 390×844 it covered the product page's wishlist heart,
 * whose lower centre hit-tested to the launcher, so a tap meant for the
 * wishlist opened Discovery. On /cart it covered the end of "Request a quote",
 * and elsewhere a chip row and the help band's copy. So on a phone the panel is
 * opened from the menu sheet instead, and the sheet lives in the header, which
 * cannot reach into the panel's own disclosure state.
 *
 * WHAT IT CARRIES. Two things and no more:
 *  - `available`: whether the panel has anything to say. The panel is the only
 *    thing that knows (localStorage read, not dismissed, a plan with a block in
 *    it), so it REPORTS this rather than the header guessing. The menu never
 *    offers a panel that would render nothing.
 *  - `open`: a request to open it. The panel registers the opener, so its
 *    disclosure keeps Escape, outside-click and close-on-navigation exactly as
 *    they were.
 *
 * Two contexts rather than one, so the panel's registration handles never
 * change identity. Only the launcher side re-renders when availability flips.
 *
 * Without a provider both hooks return null, and the header simply offers no
 * row. That is also the state before the panel has read storage.
 */

interface DiscoveryHost {
  setAvailable: (available: boolean) => void;
  registerOpener: (open: (() => void) | null) => void;
}

interface DiscoveryLauncher {
  available: boolean;
  open: () => void;
}

const HostContext = React.createContext<DiscoveryHost | null>(null);
const LauncherContext = React.createContext<DiscoveryLauncher | null>(null);

export function DiscoveryProvider({ children }: { children: React.ReactNode }) {
  const [available, setAvailable] = React.useState(false);
  const opener = React.useRef<(() => void) | null>(null);

  const host = React.useMemo<DiscoveryHost>(
    () => ({
      setAvailable,
      registerOpener: (open) => {
        opener.current = open;
      },
    }),
    [],
  );

  const open = React.useCallback(() => opener.current?.(), []);
  const launcher = React.useMemo<DiscoveryLauncher>(() => ({ available, open }), [available, open]);

  return (
    <HostContext.Provider value={host}>
      <LauncherContext.Provider value={launcher}>{children}</LauncherContext.Provider>
    </HostContext.Provider>
  );
}

/** For the panel: report availability and register the opener. */
export function useDiscoveryHost(): DiscoveryHost | null {
  return React.useContext(HostContext);
}

/** For the chrome: whether there is a panel to offer, and how to open it. */
export function useDiscoveryLauncher(): DiscoveryLauncher | null {
  return React.useContext(LauncherContext);
}
