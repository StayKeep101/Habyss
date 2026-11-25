/**
 * Finding a place by name for the small map (components/Create/InlinePlaceMap):
 * "gym", "Ottawa Hospital", "123 Bank St".
 *
 * Maps' own search (MKLocalSearch, in modules/habyss-live-activity) when the
 * build has it: places and businesses, nearest first around the map. Until
 * then, Apple's address search (CLGeocoder, through expo-location), which
 * finds streets, cities and well-known places, each named by what is there.
 * Both run on Apple's services, as the map does; nothing else sees the query.
 */
export interface FoundPlace {
    name: string;
    /** The street and city, when it says more than the name. */
    address: string;
    latitude: number;
    longitude: number;
}

type Point = { latitude: number; longitude: number };

const MAX = 6;

/** Drops a repeat (the same name a few metres away) and an address that only repeats the name. */
export function tidyPlaces(found: FoundPlace[]): FoundPlace[] {
    const out: FoundPlace[] = [];
    for (const place of found) {
        if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) continue;
        const name = place.name.trim() || place.address.trim();
        if (!name) continue;
        const address = place.address.trim() === name ? '' : place.address.trim();
        const repeat = out.some(other => other.name === name
            && Math.abs(other.latitude - place.latitude) < 0.0005 && Math.abs(other.longitude - place.longitude) < 0.0005);
        if (!repeat) out.push({ name, address, latitude: place.latitude, longitude: place.longitude });
        if (out.length === MAX) break;
    }
    return out;
}

export async function searchPlaces(query: string, near: Point | null): Promise<FoundPlace[]> {
    const text = query.trim();
    if (text.length < 2) return [];
    try {
        const native = (require('@/modules/habyss-live-activity') as typeof import('@/modules/habyss-live-activity')).default;
        if (native?.searchPlaces) {
            const found = await native.searchPlaces(text, near?.latitude ?? 0, near?.longitude ?? 0);
            return tidyPlaces(found ?? []);
        }
    } catch { /* the address search below */ }
    try {
        const Location = require('expo-location') as typeof import('expo-location');
        const points = (await Location.geocodeAsync(text)).slice(0, MAX);
        const named = await Promise.all(points.map(async point => {
            const at = { latitude: point.latitude, longitude: point.longitude };
            try {
                const [found] = await Location.reverseGeocodeAsync(at);
                const street = [found?.streetNumber, found?.street].filter(Boolean).join(' ');
                const address = [street, found?.city].filter(Boolean).join(', ');
                return { name: found?.name || street || found?.city || text, address, ...at };
            } catch {
                return { name: text, address: '', ...at };
            }
        }));
        return tidyPlaces(named);
    } catch {
        return [];
    }
}
