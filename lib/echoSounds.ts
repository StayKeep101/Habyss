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
