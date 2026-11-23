/**
 * Echo, out loud: the notification sound for a moment is Echo saying it, in
 * the voice you chose (Settings → Echo), a short line, sometimes funny
 * ("Leave. Now. Unless being late is your personality."). The clips are in the
 * app (ios/Habyss/Sounds, made by scripts/make-echo-sounds.sh); a build
 * without them plays the default sound instead, which iOS does by itself.
 */
export type EchoMoment = 'leave' | 'start' | 'end' | 'review';

const VOICES = ['normal', 'friendly', 'dad_mode', 'bully_mode', 'goofball'];

export function echoSound(moment: EchoMoment, voice: string | null | undefined): string {
    return `echo_${moment}_${VOICES.includes(voice ?? '') ? voice : 'normal'}.caf`;
}

/**
 * "Start Study now", spoken: a clip made on the phone for this one item
 * (modules/habyss-live-activity speakToSound, from the next build), played as
 * its notification's sound. Null on a build without it, or when it could not
 * be made: the moment then plays Echo's own clip.
 */
export async function spokenStart(title: string): Promise<string | null> {
    try {
        const native = (require('@/modules/habyss-live-activity') as typeof import('@/modules/habyss-live-activity')).default;
        if (!native?.speakToSound) return null;
        let hash = 0;
        for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) | 0;
        const name = `say_start_${(hash >>> 0).toString(36)}.caf`;
        return (await native.speakToSound(`Start ${title} now`, name)) ? name : null;
    } catch {
        return null;
    }
}
