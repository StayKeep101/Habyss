/** Must also be allowed in Supabase → Authentication → URL Configuration. */
export const AUTH_REDIRECT = 'habyss://auth-callback';

export function isAuthCallbackURL(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'habyss:' && url.hostname === 'auth-callback'
            && !url.port && !url.username && !url.password
            && (url.pathname === '' || url.pathname === '/');
    } catch { return false; }
}
