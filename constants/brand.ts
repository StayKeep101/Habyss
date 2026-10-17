/**
 * Brand copy, in one place.
 *
 * The name is habits and abyss: the deep where Cronos, who keeps time, is
 * bound. The slogan reads down and then up, which is the same shape as the
 * app — go down into the work, come back up with the time you spent.
 *
 * Every screen that shows the name or the slogan reads it from here, so the
 * wording cannot drift between the launch screen and onboarding.
 */

export const APP_NAME = 'HABYSS';

export const APP_SLOGAN = 'Descend into discipline, Rise through Time';
/** The slogan as the welcome screen sets it, one half per line. */
export const APP_SLOGAN_LINES = ['Descend into Discipline', 'Rise Through Time'] as const;

/** Where "Buy me a coffee" goes when in-app purchase is unavailable. Empty: the popup then just says thanks. */
export const BUY_ME_A_COFFEE_URL = '';

/**
 * The coffee itself: a consumable in-app purchase ($5) in App Store Connect,
 * added to RevenueCat. A tip to the developer has to be an in-app purchase on
 * iOS; Apple's sheet pays with the card on the Apple Account (Face ID).
 */
export const COFFEE_PRODUCT_ID = 'habyss_coffee_5';
