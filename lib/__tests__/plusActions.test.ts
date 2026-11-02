jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

import { DeviceEventEmitter } from 'react-native';
import { DEFAULT_PLUS, MAX_PLUS, cleanPlus, plusTabOf, runPlus, togglePlus } from '../plusActions';
import { matchesSearch, searchDeep } from '../settingsSearch';

describe('the + on each tab', () => {
    it('checks in on Home, makes things on Roadmap, bets on Community, searches on Settings', () => {
        expect(DEFAULT_PLUS).toEqual({ home: ['mood', 'energy'], roadmap: ['goal', 'habit', 'task', 'thought'], community: ['bet'] });
        expect(plusTabOf('home')).toBe('home');
        expect(plusTabOf('settings')).toBe('settings');
        expect(plusTabOf(undefined)).toBe('home');
    });

    it('keeps a saved choice clean: known actions, catalogue order, never empty, at most five', () => {
        expect(cleanPlus({ home: ['task', 'mood', 'nonsense'] }).home).toEqual(['mood', 'task']);
        expect(cleanPlus({ home: [] }).home).toEqual(DEFAULT_PLUS.home);
        expect(cleanPlus(null)).toEqual(DEFAULT_PLUS);
        expect(cleanPlus({ roadmap: ['mood', 'energy', 'goal', 'habit', 'task', 'thought', 'focus'] }).roadmap).toHaveLength(MAX_PLUS);
    });

    it('switches actions on and off, but never the last one off, nor a sixth on', () => {
        const added = togglePlus(DEFAULT_PLUS, 'home', 'task');
        expect(added.home).toEqual(['mood', 'energy', 'task']);
        const one = { ...DEFAULT_PLUS, community: ['bet' as const] };
        expect(togglePlus(one, 'community', 'bet')).toBe(one);
        const full = cleanPlus({ roadmap: ['goal', 'habit', 'task', 'thought', 'focus'] });
        expect(togglePlus(full, 'roadmap', 'mood')).toBe(full);
    });

    it('asks Echo’s question, or opens the sheet, for what was chosen', () => {
        const asked = jest.fn(), bet = jest.fn();
        const subs = [DeviceEventEmitter.addListener('show_check_in', asked), DeviceEventEmitter.addListener('show_open_bet', bet)];
        runPlus('energy');
        runPlus('bet');
        expect(asked).toHaveBeenCalledWith({ kind: 'energy' });
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
