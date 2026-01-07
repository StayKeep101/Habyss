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
        if (!hasPerm) return [];

        try {
            const Calendar = require('expo-calendar');
            const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            const calendarIds = calendars.map((c: any) => c.id);

            const startDate = new Date(date);
            startDate.setHours(8, 0, 0, 0); // Start looking from 8 AM
            const endDate = new Date(date);
            endDate.setHours(20, 0, 0, 0); // Until 8 PM

            // basic logic: this is complex, Expo Calendar doesn't give "free slots" directly easily without iterating events.
            // Implementing a simple version: retrieve events for the day, find gaps.

            const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
            events.sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

            const slots: { start: Date, end: Date }[] = [];
            let currentTime = startDate.getTime();
            const endLimit = endDate.getTime();
            const durationMs = durationMinutes * 60 * 1000;

            for (const event of events) {
                const evtStart = new Date(event.startDate).getTime();
                const evtEnd = new Date(event.endDate).getTime();

                if (currentTime + durationMs <= evtStart) {
                    slots.push({
                        start: new Date(currentTime),
                        end: new Date(currentTime + durationMs)
                    });
                    if (slots.length >= 3) return slots;
                }
                currentTime = Math.max(currentTime, evtEnd);
            }

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
