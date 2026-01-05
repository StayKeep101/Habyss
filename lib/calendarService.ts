// Calendar service with graceful fallback for Expo Go (no native module)

export interface TimeSlot {
    start: Date;
    end: Date;
    durationMinutes: number;
}

let Calendar: any = null;

// Try to import expo-calendar, but gracefully handle if native module is missing
try {
    Calendar = require('expo-calendar');
} catch (e) {
    console.log('expo-calendar not available (Expo Go mode)');
}

export const CalendarService = {
    async requestPermission(): Promise<boolean> {
        if (!Calendar) return false;
        try {
            const { status } = await Calendar.requestCalendarPermissionsAsync();
            return status === 'granted';
        } catch {
            return false;
        }
    },

    async hasPermission(): Promise<boolean> {
        if (!Calendar) return false;
        try {
            const { status } = await Calendar.getCalendarPermissionsAsync();
            return status === 'granted';
        } catch {
            return false;
        }
    },

    async getCalendars(): Promise<any[]> {
        if (!Calendar) return [];
        try {
            if (!(await this.hasPermission())) return [];
            return await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        } catch {
            return [];
        }
    },

    async getEventsForRange(start: Date, end: Date) {
        if (!Calendar) return [];
        try {
            if (!(await this.hasPermission())) return [];
            const calendars = await this.getCalendars();
            if (calendars.length === 0) return [];
            const events = await Calendar.getEventsAsync(calendars.map((c: any) => c.id), start, end);
            return events.map((e: any) => ({
                id: e.id,
                title: e.title,
                startDate: new Date(e.startDate),
                endDate: new Date(e.endDate),
                allDay: e.allDay || false,
            }));
        } catch {
            return [];
        }
    },

    async findFreeSlots(date: Date, minDuration: number = 15, dayStart: number = 7, dayEnd: number = 22): Promise<TimeSlot[]> {
        if (!Calendar) return [];
        try {
            const start = new Date(date);
            start.setHours(dayStart, 0, 0, 0);
            const end = new Date(date);
            end.setHours(dayEnd, 0, 0, 0);

            const events = await this.getEventsForRange(start, end);
            const busySlots = events.filter((e: any) => !e.allDay).sort((a: any, b: any) => a.startDate.getTime() - b.startDate.getTime());

            const freeSlots: TimeSlot[] = [];
            let currentTime = start;

            for (const event of busySlots) {
                if (event.startDate > currentTime) {
                    const gapMinutes = (event.startDate.getTime() - currentTime.getTime()) / (1000 * 60);
                    if (gapMinutes >= minDuration) {
                        freeSlots.push({ start: new Date(currentTime), end: new Date(event.startDate), durationMinutes: gapMinutes });
                    }
                }
                if (event.endDate > currentTime) currentTime = new Date(event.endDate);
            }

            if (currentTime < end) {
                const gapMinutes = (end.getTime() - currentTime.getTime()) / (1000 * 60);
                if (gapMinutes >= minDuration) {
                    freeSlots.push({ start: new Date(currentTime), end: new Date(end), durationMinutes: gapMinutes });
                }
            }

            return freeSlots;
        } catch {
            return [];
        }
    },

    async getSuggestedTimes(date: Date, count: number = 3): Promise<TimeSlot[]> {
        if (!Calendar) return [];
        try {
            const slots = await this.findFreeSlots(date, 15);
            const morning = slots.find(s => s.start.getHours() >= 7 && s.start.getHours() < 12);
            const afternoon = slots.find(s => s.start.getHours() >= 12 && s.start.getHours() < 17);
            const evening = slots.find(s => s.start.getHours() >= 17 && s.start.getHours() < 22);
            const suggestions: TimeSlot[] = [];
            if (morning) suggestions.push(morning);
            if (afternoon) suggestions.push(afternoon);
            if (evening) suggestions.push(evening);
            for (const slot of slots) {
                if (suggestions.length >= count) break;
                if (!suggestions.includes(slot)) suggestions.push(slot);
            }
            return suggestions.slice(0, count);
        } catch {
            return [];
        }
    },

    formatSlot(slot: TimeSlot): string {
        const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${fmt(slot.start)} - ${fmt(slot.end)}`;
    },

    isAvailable(): boolean {
        return Calendar !== null;
    }
};
