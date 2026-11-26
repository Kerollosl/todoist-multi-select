// Type-only declarations for tsc (npm run typecheck). Not shipped.
// Globals shared between content scripts via `self` (same isolated world).
interface Window {
  TMS_SELECTORS: Readonly<Record<string, any>>;
  TMS_TOAST?: (message: string, ms?: number) => void;
}
