import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const NotificationService = {
    /**
     * Request permissions for notifications
     */
    registerForNotifications: async (): Promise<boolean> => {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('timer-channel', {
                name: 'Timer Notifications',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        return finalStatus === 'granted';
    },

    /**
     * Schedule a notification for when the timer completes
     */
    scheduleTimerCompletion: async (seconds: number, habitName: string) => {
        // Cancel any existing timer notifications first
        await Notifications.cancelAllScheduledNotificationsAsync();

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Timer Complete",
                body: `Focus session for "${habitName}" is complete. Great job!`,
                sound: true,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: seconds,
                repeats: false,
            },
        });
    },

    /**
     * Cancel pending timer notifications
     */
    cancelTimerNotifications: async () => {
        await Notifications.cancelAllScheduledNotificationsAsync();
    },
};
