// import * as Calendar from 'expo-calendar'; // Removed static import to prevent crash

import { Platform } from 'react-native';

export class CalendarService {
    static async hasPermission(): Promise<boolean> {
        try {
            const Calendar = require('expo-calendar');
            const { status } = await Calendar.getCalendarPermissionsAsync();
            return status === 'granted';
        } catch (e) {
            console.warn('Calendar native module not found');
            return false;
        }
    }

    static async requestPermission(): Promise<boolean> {
        try {
            const Calendar = require('expo-calendar');
            const { status } = await Calendar.requestCalendarPermissionsAsync();
            // For Reminders specifically on iOS
            if (Platform.OS === 'ios') {
                await Calendar.requestRemindersPermissionsAsync();
            }
            return status === 'granted';
        } catch (e) {
            console.warn('Calendar native module not found');
            return false;
        }
    }

    static async getDefaultCalendarSource() {
        try {
            const Calendar = require('expo-calendar');
            const defaultCalendar = await Calendar.getDefaultCalendarAsync();
            return defaultCalendar.source;
        } catch (e) {
            return null;
        }
    }

    static async getHabyssCalendarId(): Promise<string | null> {
        try {
            const Calendar = require('expo-calendar');
            // Find or create 'Habyss' calendar
            const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            const habyssCal = calendars.find((c: any) => c.title === 'Habyss');
            if (habyssCal) return habyssCal.id;

            return await this.createCalendar();
        } catch (e) {
            console.warn('Calendar native module not found');
            return null;
        }
    }

    static async createCalendar(): Promise<string | null> {
        try {
            const Calendar = require('expo-calendar');
            const defaultCalendarSource =
                Platform.OS === 'ios'
                    ? await this.getDefaultCalendarSource()
                    : { isLocalAccount: true, name: 'Habyss', type: Calendar.SourceType.LOCAL };

            if (!defaultCalendarSource) {
                console.warn("Could not find default calendar source");
                return null;
            }

            const newCalendarID = await Calendar.createCalendarAsync({
                title: 'Habyss',
                color: '#3B82F6',
                entityType: Calendar.EntityTypes.EVENT,
                sourceId: defaultCalendarSource.id,
                source: defaultCalendarSource,
                name: 'habyss_internal',
                ownerAccount: 'personal',
                accessLevel: Calendar.CalendarAccessLevel.OWNER,
            });
            return newCalendarID;
        } catch (e) {
            console.error("Error creating calendar", e);
            return null;
        }
    }

    static async getSuggestedTimes(date: Date, durationMinutes: number = 30): Promise<{ start: Date, end: Date }[]> {
        const hasPerm = await this.hasPermission();
        if (!hasPerm) {
            const granted = await this.requestPermission();
            if (!granted) return [];
        }

        try {
            const Calendar = require('expo-calendar');
            const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            const calendarIds = calendars.map((c: any) => c.id);

            const startDate = new Date(date);
            startDate.setHours(6, 0, 0, 0); // Start from 6 AM
            const endDate = new Date(date);
            endDate.setHours(22, 0, 0, 0); // Until 10 PM

            const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
            // Sort by start time
            events.sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

            // Merge overlapping events
            const mergedEvents: { start: number, end: number }[] = [];
            for (const event of events) {
                const s = new Date(event.startDate).getTime();
                const e = new Date(event.endDate).getTime();
                if (mergedEvents.length > 0 && s < mergedEvents[mergedEvents.length - 1].end) {
                    // Overlap or adjacent, extend previous
                    mergedEvents[mergedEvents.length - 1].end = Math.max(mergedEvents[mergedEvents.length - 1].end, e);
                } else {
                    mergedEvents.push({ start: s, end: e });
                }
            }

            const slots: { start: Date, end: Date }[] = [];
            let currentTime = startDate.getTime();
            const endLimit = endDate.getTime();
            const durationMs = durationMinutes * 60 * 1000;

            for (const event of mergedEvents) {
                // Check gap before this event
                if (currentTime + durationMs <= event.start) {
                    slots.push({
                        start: new Date(currentTime),
                        end: new Date(currentTime + durationMs)
                    });
                    if (slots.length >= 5) return slots;
                    // Advance current time to end of this slot? No, we might fit multiple.
                    // But for simplicity, let's just find the *next* available after this gap or after this event?
                    // Let's just find one slot per gap to avoid clutter?
                    // Or fill the gap. Let's simplistically take the first fit in the gap, and then move past the event.
                }
                currentTime = Math.max(currentTime, event.end);
            }

            // Check gap after last event
            if (currentTime + durationMs <= endLimit) {
                slots.push({
                    start: new Date(currentTime),
                    end: new Date(currentTime + durationMs)
                });
            }

            return slots;
        } catch (e) {
            console.error('Error getting suggested times', e);
            return [];
        }
    }

    static async syncHabitToCalendar(habit: any) {
        const calendarId = await this.getHabyssCalendarId();
        if (!calendarId) return;

        // Logic to create recurring event based on habit frequency
        // Simplification: create for today/next occurrence
        const eventDetails = {
            title: `Habit: ${habit.name}`,
            startDate: new Date(), // Logic needed to parse habit.startTime if exists
            endDate: new Date(new Date().getTime() + (habit.durationMinutes || 30) * 60 * 1000),
            timeZone: 'GMT',
            location: 'Habyss',
        };

        // await Calendar.createEventAsync(calendarId, eventDetails);
    }
}
