import { acceptLine, speaksAsUser } from '../echoWriter';

describe('Echo talks to you, never as you', () => {
    it('drops a line that introduces itself by your name', () => {
        expect(speaksAsUser("I'm Erwan and I am ready to read", 'Erwan')).toBe(true);
        expect(speaksAsUser('Erwan here, time to train', 'Erwan')).toBe(true);
        expect(acceptLine('I am Erwan, crushing my workout today', 'Erwan')).toBeNull();
    });

    it('drops a line written in your first person about your habits', () => {
        expect(speaksAsUser('I will finish my workout before lunch')).toBe(true);
    });

    it('keeps a line that addresses you by name', () => {
        expect(speaksAsUser('Erwan, your run is waiting. Go.', 'Erwan')).toBe(false);
        expect(acceptLine('Erwan, your run is waiting. Go.', 'Erwan')).toBe('Erwan, your run is waiting. Go.');
    });
});
