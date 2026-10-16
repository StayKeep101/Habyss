import { cleanSpeech } from '../voiceClean';

describe('cleaning what was said', () => {
    it('drops thinking sounds and fillers, keeps the meaning', () => {
        expect(cleanSpeech('um so I need to uh call mum tomorrow at like five')).toBe('I need to call mum tomorrow at like five');
        expect(cleanSpeech('So, like, read twenty pages, you know, every night')).toBe('Read twenty pages, every night');
        expect(cleanSpeech('I mean, I want to run a marathon by October')).toBe('I want to run a marathon by October');
    });

    it('keeps "like" when it means like', () => {
        expect(cleanSpeech('I would like to drink more water')).toBe('I would like to drink more water');
    });

    it('removes words said twice in a row', () => {
        expect(cleanSpeech('buy the the milk and and eggs')).toBe('Buy the milk and eggs');
    });

    it('leaves nothing when nothing was said', () => {
        expect(cleanSpeech('um uh hmm')).toBe('');
    });
});
