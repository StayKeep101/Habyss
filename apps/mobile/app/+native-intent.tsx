import { holdLaunchLink } from '@/lib/launchLink';

/**
 * Links Habyss is opened with. At a cold launch (a widget tapped while Habyss
 * was closed) the link waits for the launch animation to end (lib/launchLink.ts),
 * so a sheet never slides up over the launch screen; after that, links open at once.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
    try {
        if (initial && holdLaunchLink(path)) return '/';
    } catch { /* never block a link */ }
    return path;
}
