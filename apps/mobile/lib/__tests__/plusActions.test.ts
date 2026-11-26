jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

import { DeviceEventEmitter } from 'react-native';
import { DEFAULT_PLUS, MAX_PLUS, cleanPlus, plusTabOf, runPlus, togglePlus, withAdded } from '../plusActions';
import { matchesSearch, searchDeep } from '../settingsSearch';

describe('the + on each tab', () => {
    it('makes things on Home and Roadmap, races and challenges on Community, searches on Settings', () => {
        expect(DEFAULT_PLUS).toEqual({ home: ['habit', 'task', 'thought'], roadmap: ['habit', 'task', 'thought'], community: ['race', 'challenge'] });
        expect(plusTabOf('home')).toBe('home');
        expect(plusTabOf('settings')).toBe('settings');
        expect(plusTabOf(undefined)).toBe('home');
    });

    it('keeps a saved choice clean: known actions, catalogue order, never empty, at most five', () => {
        expect(cleanPlus({ home: ['task', 'habit', 'goal', 'mood', 'nonsense'] }).home).toEqual(['habit', 'task']);
        expect(cleanPlus({ home: [] }).home).toEqual(DEFAULT_PLUS.home);
        expect(cleanPlus(null)).toEqual(DEFAULT_PLUS);
        expect(cleanPlus({ roadmap: ['habit', 'task', 'thought', 'race', 'challenge'] }).roadmap).toHaveLength(MAX_PLUS);
        // Focus was once a choice; a menu saved with it opens without it (it is the bar over the tab bar now).
        expect(cleanPlus({ home: ['habit', 'focus'] }).home).toEqual(['habit']);
    });

    it('switches actions on and off, but never the last one off, nor a sixth on', () => {
        const added = togglePlus(DEFAULT_PLUS, 'home', 'race');
        expect(added.home).toEqual(['habit', 'task', 'thought', 'race']);
        const one = { ...DEFAULT_PLUS, community: ['race' as const] };
        expect(togglePlus(one, 'community', 'race')).toBe(one);
    });

    it('puts a new action into a saved list once, where its default holds it and there is room', () => {
        const saved = cleanPlus({ community: ['challenge'] });
        expect(withAdded(saved, ['race']).community).toEqual(['race', 'challenge']);
        expect(withAdded(saved, ['race']).home).toEqual(saved.home);
        expect(withAdded(saved, [])).toBe(saved);
    });

    it('opens the sheet for what was chosen', () => {
        const asked = jest.fn(), race = jest.fn();
        const subs = [DeviceEventEmitter.addListener('show_quick_add', asked), DeviceEventEmitter.addListener('show_race', race)];
        runPlus('habit');
        runPlus('race');
        expect(asked).toHaveBeenCalled();
        expect(race).toHaveBeenCalled();
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

describe('duels became challenges', () => {
    it('a saved duel is the challenge now', () => {
        const { cleanPlus } = require('../plusActions') as typeof import('../plusActions');
        expect(cleanPlus({ community: ['race', 'duel'] }).community).toEqual(['race', 'challenge']);
    });
});
