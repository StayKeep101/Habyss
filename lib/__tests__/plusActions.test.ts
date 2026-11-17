jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

import { DeviceEventEmitter } from 'react-native';
import { DEFAULT_PLUS, MAX_PLUS, cleanPlus, plusTabOf, runPlus, togglePlus } from '../plusActions';
import { matchesSearch, searchDeep } from '../settingsSearch';

describe('the + on each tab', () => {
    it('makes things on Home and Roadmap, bets on Community, searches on Settings', () => {
        expect(DEFAULT_PLUS).toEqual({ home: ['goal', 'habit', 'task', 'thought'], roadmap: ['goal', 'habit', 'task', 'thought'], community: ['bet', 'challenge'] });
        expect(plusTabOf('home')).toBe('home');
        expect(plusTabOf('settings')).toBe('settings');
        expect(plusTabOf(undefined)).toBe('home');
    });

    it('keeps a saved choice clean: known actions, catalogue order, never empty, at most five', () => {
        expect(cleanPlus({ home: ['task', 'goal', 'mood', 'nonsense'] }).home).toEqual(['goal', 'task']);
        expect(cleanPlus({ home: [] }).home).toEqual(DEFAULT_PLUS.home);
        expect(cleanPlus(null)).toEqual(DEFAULT_PLUS);
        expect(cleanPlus({ roadmap: ['goal', 'habit', 'task', 'thought', 'bet', 'challenge'] }).roadmap).toHaveLength(MAX_PLUS);
        // Focus was once a choice; a menu saved with it opens without it (it is the bar over the tab bar now).
        expect(cleanPlus({ home: ['goal', 'focus'] }).home).toEqual(['goal']);
    });

    it('switches actions on and off, but never the last one off, nor a sixth on', () => {
        const added = togglePlus(DEFAULT_PLUS, 'home', 'bet');
        expect(added.home).toEqual(['goal', 'habit', 'task', 'thought', 'bet']);
        const one = { ...DEFAULT_PLUS, community: ['bet' as const] };
        expect(togglePlus(one, 'community', 'bet')).toBe(one);
        const full = cleanPlus({ roadmap: ['goal', 'habit', 'task', 'thought', 'bet'] });
        expect(togglePlus(full, 'roadmap', 'challenge')).toBe(full);
    });

    it('opens the sheet for what was chosen', () => {
        const asked = jest.fn(), bet = jest.fn();
        const subs = [DeviceEventEmitter.addListener('show_quick_add', asked), DeviceEventEmitter.addListener('show_open_bet', bet)];
        runPlus('habit');
        runPlus('bet');
        expect(asked).toHaveBeenCalled();
        expect(bet).toHaveBeenCalled();
        subs.forEach(sub => sub.remove());
    });
});

describe('searching the settings', () => {
    it('matches every word typed, from the start of a word, ignoring case and accents', () => {
        expect(matchesSearch('noti', 'Notifications')).toBe(true);
        expect(matchesSearch('face id', 'Face ID lock')).toBe(true);
        expect(matchesSearch('fications', 'Notifications')).toBe(false);
        expect(matchesSearch('', 'anything')).toBe(true);
    });

    it('finds settings one page deeper, by name or by the words people use', () => {
        expect(searchDeep('dark')[0]).toMatchObject({ label: 'Theme', page: 'Appearance' });
        expect(searchDeep('biometric').map(entry => entry.label)).toContain('Face ID lock');
        expect(searchDeep('')).toEqual([]);
    });
});
