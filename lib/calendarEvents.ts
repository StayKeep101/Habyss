import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Events from the phone's own calendars (Apple Calendar, and any Google or
 * Outlook account added to it), as fixed blocks in the day's timeline: the
 * scheduler works habits and tasks around them, like meals.
 *
 * Off until switched on in Settings → Timeline, which is when iOS asks for
 * access. All-day events and ones marked "free" do not block time. Read on
 * the phone; nothing is sent anywhere.
 */
export interface CalendarSlot { id: string; title: string; start: number; minutes: number; color?: string }

const KEY = 'habyss_calendar_on';
let on: boolean | null = null;
const cache = new Map<string, CalendarSlot[]>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());

function calendar(): typeof import('expo-calendar') | null {
    if (Platform.OS === 'web') return null;
    try {
        const { requireOptionalNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
        if (!requireOptionalNativeModule('ExpoCalendar')) return null;
        return require('expo-calendar');
    } catch {
        return null;
    }
}

export const calendarAvailable = () => !!calendar();
export const calendarOn = () => on === true;
export function subscribeCalendar(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadCalendarSetting(): Promise<boolean> {
    if (on !== null) return on;
    on = (await AsyncStorage.getItem(KEY).catch(() => null)) === '1';
    changed();
    return on;
}

/** Switching on asks iOS for access (its own prompt); false when it was refused. */
export async function setCalendarOn(next: boolean): Promise<boolean> {
    const api = calendar();
    if (next) {
        if (!api) return false;
        const { status } = await api.requestCalendarPermissionsAsync().catch(() => ({ status: 'denied' as const }));
        if (status !== 'granted') return false;
    }
    on = next;
    cache.clear();
    await AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => undefined);
    changed();
    return true;
}

/** One event as a block on `day`: clipped to the day, in minutes from midnight. */
export function toSlot(event: { id: string; title?: string; startDate: string | Date; endDate: string | Date; allDay?: boolean; availability?: string; status?: string }, day: string, color?: string): CalendarSlot | null {
    if (event.allDay || event.availability === 'free' || event.status === 'canceled' || event.status === 'cancelled') return null;
    const dayStart = new Date(`${day}T00:00:00`).getTime();
    const start = Math.max(0, (new Date(event.startDate).getTime() - dayStart) / 60000);
    const end = Math.min(1440, (new Date(event.endDate).getTime() - dayStart) / 60000);
    if (!(end > start)) return null;
    return { id: event.id, title: event.title?.trim() || 'Busy', start: Math.round(start), minutes: Math.round(end - start), color };
}

/** The day's events, once read; cached until the setting changes or `fresh` is asked for. */
export async function eventsFor(day: string, fresh = false): Promise<CalendarSlot[]> {
    if (!(await loadCalendarSetting())) return [];
    if (!fresh && cache.has(day)) return cache.get(day)!;
    const api = calendar();
    if (!api) return [];
    try {
        const { status } = await api.getCalendarPermissionsAsync();
        if (status !== 'granted') return [];
        const calendars = await api.getCalendarsAsync(api.EntityTypes.EVENT);
        const colors = new Map(calendars.map(item => [item.id, item.color]));
        const from = new Date(`${day}T00:00:00`);
        const to = new Date(`${day}T23:59:59`);
        const events = await api.getEventsAsync(calendars.map(item => item.id), from, to);
        const slots = events
            .map(event => toSlot(event as never, day, colors.get((event as { calendarId?: string }).calendarId ?? '')))
            .filter((slot): slot is CalendarSlot => !!slot)
            .sort((a, b) => a.start - b.start);
        cache.set(day, slots);
        changed();
        return slots;
    } catch {
        return [];
    }
}
