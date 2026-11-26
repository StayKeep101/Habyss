/**
 * A link Habyss was opened with (a widget, a Shortcut, a notification's URL),
 * held while the launch animation plays and opened as it ends: tapping the Add
 * widget used to slide the Add sheet up over the launch screen before it had
 * finished. Only a cold launch is held; once Habyss is running, links open at once.
 * Wired in app/+native-intent.tsx (holds it) and app/_layout.tsx (opens it).
 */
let pending: string | null = null;

/** The app's own links ("habyss://add?kind=task"), as a route ("/add?kind=task"); null for anything else. */
export function routeOf(link: string): string | null {
    const match = /^habyss:\/\/(.*)$/i.exec(link.trim());
    if (!match) return null;
    const route = `/${match[1].replace(/^\/+/, '')}`;
    // The home screen is where a launch lands anyway; the dev client's own links are not ours.
    if (route === '/' || /^\/(?:home|expo-development-client)\b/i.test(route)) return null;
    return route;
}

/** At launch: keep the link for later. True when it was kept (the launch then lands on Home). */
export function holdLaunchLink(link: string): boolean {
    const route = routeOf(link);
    if (!route) return false;
    pending = route;
    return true;
}

/** The held link, once: null when there was none. */
export function takeLaunchLink(): string | null {
    const route = pending;
    pending = null;
    return route;
}
