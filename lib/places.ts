import type { LocationReminder } from './habitsSQLite';

/**
 * Places a habit or task reminds you at (arriving or leaving), read defensively
 * from storage (JSON text or an array): anything without a name and a real
 * position is dropped, and the direction is only ever arrive or leave.
 */
export function parsePlaces(raw: unknown): LocationReminder[] {
    let value = raw;
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return []; } }
    if (!Array.isArray(value)) return [];
    return value
        .filter(place => place && typeof place.name === 'string' && Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
        .map((place): LocationReminder => ({
            name: place.name, latitude: place.latitude, longitude: place.longitude,
            radius: Number.isFinite(place.radius) ? place.radius : undefined,
            trigger: place.trigger === 'leave' ? 'leave' : 'arrive',
        }));
}

/** As stored: JSON text, null for none. */
export const storePlaces = (places: LocationReminder[] | null | undefined): string | null => {
    const clean = parsePlaces(places ?? []);
    return clean.length ? JSON.stringify(clean) : null;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** A reminder time, "HH:MM", or undefined. */
export const parseReminderTime = (raw: unknown): string | undefined => (typeof raw === 'string' && TIME.test(raw) ? raw : undefined);
