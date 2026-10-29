/**
 * Product switches.
 *
 * PAYWALL_ENABLED: the free week, then one payment of $10 (half for everyone in an invite),
 * lib/access.ts. It only ever locks when the store is reachable: with no
 * RevenueCat key on the build, everyone has everything, as when this is false.
 */
export const PAYWALL_ENABLED = true;

/**
 * MARKET_ENABLED: betting Marks on friends' goals (lib/market.ts). Marks are
 * never bought or cashed out, but Apple's age rating counts this as simulated
 * gambling; false hides every way in, and nothing else changes.
 */
export const MARKET_ENABLED = true;
