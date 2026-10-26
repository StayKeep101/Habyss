/**
 * Invites that change the price (supabase/migrations/…_referrals.sql): who
 * invited you, and how many you have invited who joined. Written when a new
 * account adds the friend who invited them.
 */
import { getSupabase } from '@/lib/supabase';
import type { Referral } from '@/lib/access';

export async function claimReferral(username: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    try { await sb.rpc('claim_referral', { p_username: username }); } catch { /* an invite that does not count is not an error */ }
}

export async function referralStatus(): Promise<Referral | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('referral_status');
    if (error) return null;
    const row = (Array.isArray(data) ? data[0] : data) as { invited_by: string | null; joined: number } | undefined;
    return row ? { invitedBy: row.invited_by ?? null, joined: row.joined ?? 0 } : { invitedBy: null, joined: 0 };
}

/** What you send: a friend who joins with it pays half, and three of them make yours half too. */
export function priceInviteMessage(username: string): string {
    const { inviteLink } = require('@/lib/friendsService') as typeof import('@/lib/friendsService');
    return `Join me on Habyss — you get it half price. Download it, then add me as @${username}: ${inviteLink(username)}`;
}
