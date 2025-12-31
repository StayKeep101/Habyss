
---

# 🔔 Habyss Notifications System — Gemini Implementation Guide

**Gemini must implement the complete notifications system for the Expo React Native app named Habyss.**
Gemini must treat this document as a **build specification** and execute it strictly.

---

## 🎯 Objective

Gemini must build a full notification system that supports:

* Local notifications
* Scheduled habit reminders
* Motivational nudges
* Push notifications (optional)
* Full permission handling
* Cancellation + rescheduling
* Platform compatibility (iOS + Android)

Notifications must:

* Be reliable
* Respect timezone
* Not spam users
* Support per-habit control

---

# 1️⃣ Install + Configure Dependencies

Gemini must install Expo Notifications:

```
npx expo install expo-notifications
```

Gemini must also install device library if push notifications are used:

```
npx expo install expo-device
```

---

## iOS Configuration

Gemini must add to `app.json`:

```
{
 "expo": {
   "ios": {
     "bundleIdentifier": "com.habyss.app",
     "infoPlist": {
       "NSUserNotificationUsageDescription": "Habyss uses notifications to remind you about your habits and help you stay consistent."
     }
   }
 }
}
```

---

## Android Configuration

Gemini must create a notification channel:

```
Notifications.setNotificationChannelAsync("habit-reminders", {
  name: "Habit Reminders",
  importance: Notifications.AndroidImportance.HIGH,
});
```

Channel name must be **Habit Reminders**
Channel ID must be **habit-reminders**

---

# 2️⃣ Global Notification Handler

Gemini must configure this exactly:

```
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});
```

---

# 3️⃣ Permission Logic (Mandatory)

Gemini **must** implement a full permission onboarding flow.

Gemini must:

1️⃣ Ask permission
2️⃣ Handle denial gracefully
3️⃣ Store result

```
const registerForPushNotifications = async () => {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== "granted") {
    alert("Notifications are disabled. Enable them to get reminders.");
    return false;
  }

  return true;
};
```

On app start Gemini must:

* Check permission
* If denied → show UI prompt in settings

---

# 4️⃣ Push Notifications (Optional Tier)

If Habyss will support push notifications:

Gemini must:

```
const token = await Notifications.getExpoPushTokenAsync();
```

Gemini must store:

```
user.expoPushToken
```

Push endpoint Gemini must use:

```
https://exp.host/--/api/v2/push/send
```

Gemini must build helper:

```
sendPush(token, title, message)
```

---

# 5️⃣ Scheduled Notifications Requirement

Gemini must implement the ability for users to schedule reminders.

Gemini must use:

```
await Notifications.scheduleNotificationAsync({
  content: {
    title: "Habyss Reminder",
    body: "Don't forget your habit today!"
  },
  trigger: {
    hour: 8,
    minute: 0,
    repeats: true
  }
});
```

Gemini must support:

* Daily reminders
* Multi-reminders/day
* Weekly schedules

---

# 6️⃣ Habit Notification Binding

Gemini must store notification metadata per habit:

```
habitId
notificationId
reminderTime
repeatDays
enabled
```

Gemini must follow this logic strictly:

1️⃣ When a habit with notifications enabled is created
👉 Gemini must schedule notification

2️⃣ When a habit reminder time changes
👉 Gemini must cancel old notification
👉 Gemini must schedule new notification

3️⃣ When habit deleted
👉 Gemini must cancel its notifications

Gemini must **not** cancel other notifications.

---

# 7️⃣ Cancel Rules

Cancel one:

```
Notifications.cancelScheduledNotificationAsync(notificationId)
```

Cancel all:

```
Notifications.cancelAllScheduledNotificationsAsync()
```

Gemini must maintain:

```
habitId → notificationId mapping
```

This is required.

---

# 8️⃣ Smart Motivation Notifications

Gemini must implement:

* Evening motivational reminders
* Only if habit not completed

Rule Gemini must follow:

```
If (habit not completed by 7PM && reminders enabled)
 → send motivation notification
```

Example notifications Gemini may use:

* “You’re one habit away from progress 🌱”
* “Let’s protect your streak 🔥”
* “Future you will be proud 😌”

Gemini must randomize slightly to avoid repetition.

---

# 9️⃣ Quiet Hours Requirement

Gemini must enforce Quiet Hours:

Default:

```
10PM — 7AM
```

Gemini must:

* Prevent notifications during quiet hours
* Delay instead of canceling when possible
* Allow user configurable quiet hours later

---

# 🔧 Gemini Must Build Utility File

Gemini must create:

```
/src/utils/notifications.ts
```

Containing:

### `requestNotificationPermission()`

Handles permission logic

### `scheduleHabitReminder(habit)`

Schedules notifications

### `cancelHabitReminder(habitId)`

Cancels habit notification

### `cancelAllReminders()`

Safety reset

### `sendMotivationIfNeeded()`

Smart logic system

---

# 🎨 UX Requirements

Gemini must ensure:

* Notifications do NOT spam
* Show toggles:

  * Enable notifications
  * Manage per-habit reminders
  * Quiet hours toggle

If notifications disabled:
Gemini must show a soft UX explanation.

---

# 🧪 Testing Gemini Must Perform

Gemini must test:

* iOS notification works
* Android notification works
* Scheduled reminders fire consistently
* Timezone adjustments correct
* Permissions required
* Editing reminders works
* Deleting habit removes reminder

---

# 🏁 Completion Definition

Implementation is considered **SUCCESSFUL ONLY IF**:

✔ Users can toggle notifications
✔ Each habit can have reminders
✔ Notifications are delivered reliably
✔ Smart motivation works
✔ Quiet hours respected
✔ UX is smooth and non-annoying

---

## ✅ Gemini — Final Instruction

Gemini must:

1️⃣ Detect the current app folder structure
2️⃣ Implement everything above
3️⃣ Create utility + UI if required
4️⃣ Write clean, documented code
5️⃣ Ensure production-ready stability

Gemini must treat this file as strict execution instructions.

---
