/**
 * The cart drawer's public surface.
 *
 * `CartDrawer` and `CartCompletionsRail` are client components; a server
 * component may RENDER them and pass rows, which is what <MainLayout> does with
 * the drawer. It must not import the values below and call them — see
 * packages/ui/src/button-variants.ts for what Next does to a value exported
 * from a "use client" module when the server graph imports it.
 */
export { CartDrawer, type CartDrawerProps } from "./cart-drawer";
export { CartCompletionsRail, type CartCompletionsRailProps } from "./cart-completions-rail";
export { useCartDrawerStore, cartLineKey, type CartDrawerLastAdded } from "./cart-drawer-store";
export {
  completionsNotInCart,
  completionAction,
  cartLineFromCompletion,
  type CartCompletionRow,
  type CartCompletionsLoader,
} from "./completions";
