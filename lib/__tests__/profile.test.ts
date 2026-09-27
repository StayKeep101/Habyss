import { ageFrom, displayName, initials, EMPTY_PROFILE, type Profile } from '../profile';

const profile = (over: Partial<Profile> = {}): Profile => ({ ...EMPTY_PROFILE, ...over });

describe('what to show when a profile is bare', () => {
    it('calls you "You" rather than leaving a blank heading', () => {
        expect(displayName(profile())).toBe('You');
        expect(displayName(profile({ name: '   ' }))).toBe('You');
    });

    it('uses the name once there is one', () => {
        expect(displayName(profile({ name: 'Erwan' }))).toBe('Erwan');
    });

    it('has no initials to draw when there is no name', () => {
        expect(initials(profile())).toBe('');
    });

    it('takes two letters from one name, and the ends of a longer one', () => {
        expect(initials(profile({ name: 'Erwan' }))).toBe('ER');
        expect(initials(profile({ name: 'Erwan Peter' }))).toBe('EP');
        expect(initials(profile({ name: 'Ada B. Lovelace' }))).toBe('AL');
    });
});

describe('age from a birthday', () => {
    const today = new Date(2026, 8, 26); // 26 September 2026

    it('counts whole years', () => {
        expect(ageFrom('2000-09-26', today)).toBe(26);
        expect(ageFrom('2000-01-01', today)).toBe(26);
    });

    it('does not count a birthday that has not come round yet', () => {
        expect(ageFrom('2000-12-31', today)).toBe(25);
        expect(ageFrom('2000-09-27', today)).toBe(25);
    });

    it('refuses anything that is not a real date', () => {
        expect(ageFrom('', today)).toBeNull();
        expect(ageFrom('not-a-date', today)).toBeNull();
        expect(ageFrom('2026-13-01', today)).toBeNull();
    });

    it('refuses a birthday in the future rather than showing a negative age', () => {
        expect(ageFrom('2030-01-01', today)).toBeNull();
    });
});
