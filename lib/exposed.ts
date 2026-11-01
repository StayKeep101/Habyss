import { getSupabase } from './supabase';

export type ExposedStatus = 'proposed' | 'active' | 'claimed' | 'exposed' | 'submitted' | 'verified' | 'lost';
export type ExposedAction = 'accept' | 'claim' | 'expose' | 'submit' | 'verify' | 'reject' | 'concede';
export interface ExposedChallenge {
    id: string; owner_id: string; reviewer_id: string | null; title: string;
    proof_method: string; proof: string | null; status: ExposedStatus; ownerName?: string; reviewerName?: string;
}
async function client() {
    const sb = getSupabase();
    if (!sb) throw new Error('Connect to Habyss to load challenges.');
    const { data } = await sb.auth.getSession();
    if (!data.session) throw new Error('Sign in to make challenges with friends.');
    return { sb, me: data.session.user.id };
}
export async function exposedFeed() {
    const { sb, me } = await client();
    const { data, error } = await sb.from('exposed_challenges').select('id,owner_id,reviewer_id,title,proof_method,proof,status').order('updated_at', { ascending: false }).limit(50);
    if (error) throw new Error('Challenges could not load. Please try again.');
    const challenges = (data ?? []) as ExposedChallenge[];
    const ids = [...new Set(challenges.flatMap(c => [c.owner_id, ...(c.reviewer_id ? [c.reviewer_id] : [])]))];
    if (ids.length) {
        const { data: profiles } = await sb.from('profiles').select('id,display_name,username').in('id', ids);
        const names = new Map((profiles ?? []).map(p => [p.id, p.display_name || p.username || 'Friend']));
        for (const challenge of challenges) {
            challenge.ownerName = names.get(challenge.owner_id) ?? 'Friend';
            challenge.reviewerName = challenge.reviewer_id ? names.get(challenge.reviewer_id) ?? 'Friend' : undefined;
        }
    }
    return { me, challenges };
}
export async function createExposed(title: string, method: string) {
    const { sb } = await client();
    const { error } = await sb.rpc('create_exposed', { p_title: title.trim(), p_method: method.trim() });
    if (error) throw new Error(error.message);
}
export async function actOnExposed(id: string, action: ExposedAction, proof?: string) {
    const { sb } = await client();
    const { error } = await sb.rpc('act_on_exposed', { p_id: id, p_action: action, p_proof: proof ?? null });
    if (error) throw new Error(error.message);
}
/** UI affordances only. The server independently enforces every transition. */
export function exposedActions(challenge: ExposedChallenge, me: string): ExposedAction[] {
    if (me === challenge.owner_id) {
        const actions: ExposedAction[] = challenge.status === 'active' ? ['claim']
            : ['claimed', 'exposed'].includes(challenge.status) ? ['submit'] : [];
        if (['active', 'claimed', 'exposed', 'submitted'].includes(challenge.status)) actions.push('concede');
        return actions;
    }
    if (challenge.status === 'proposed') return ['accept'];
    if (me !== challenge.reviewer_id) return [];
    if (challenge.status === 'claimed') return ['expose'];
    if (challenge.status === 'submitted') return ['verify', 'reject'];
    return [];
}
