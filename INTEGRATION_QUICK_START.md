# Quick Start: Integration System

## Basic Usage

### 1. Link a Habit to an Integration

```typescript
import { linkHabitToIntegration } from '@/lib/habits';

// Example: Link "Run 5k" habit to Strava
await linkHabitToIntegration(
  'habit-123',           // Habit ID
  'strava',              // Integration service name
  'workout',             // Data type to track
  {                      // Optional configuration
    workout_type: 'Run', // Only count running workouts
    min_distance: 5000   // Minimum 5km
  },
  true                   // Auto-complete when goal is met
);
```

### 2. Sync Integrations Manually

```typescript
import { SyncCoordinator } from '@/lib/syncCoordinator';

// Sync all connected integrations
await SyncCoordinator.syncAllIntegrations();

// Sync specific integration
await SyncCoordinator.syncIntegration('apple-health');
```

### 3. Get Habit Integrations

```typescript
import { getHabitIntegrations } from '@/lib/habits';

const integrations = await getHabitIntegrations('habit-123');
console.log(integrations);
// [
//   {
//     id: 'mapping-456',
//     habit_id: 'habit-123',
//     integration_id: 'int-789',
//     data_type: 'workout',
//     config: { workout_type: 'Run', min_distance: 5000 },
//     auto_complete: true,
//     integrations: {
//       service_name: 'strava',
//       is_connected: true,
//       last_sync: '2026-01-01T15:00:00Z'
//     }
//   }
// ]
```

## Integration Data Types Reference

### Apple Health
```typescript
// Steps
await linkHabitToIntegration(habitId, 'apple-health', 'steps', {}, true);

// Sleep (hours)
await linkHabitToIntegration(habitId, 'apple-health', 'sleep', {}, true);

// Active energy (kcal)
await linkHabitToIntegration(habitId, 'apple-health', 'active_energy', {}, true);

// Distance (meters)
await linkHabitToIntegration(habitId, 'apple-health', 'distance', {}, true);
```

### Strava
```typescript
// Any workout
await linkHabitToIntegration(habitId, 'strava', 'workout', {}, true);

// Only runs
await linkHabitToIntegration(habitId, 'strava', 'workout', {
  workout_type: 'Run'
}, true);

// Runs with minimum distance
await linkHabitToIntegration(habitId, 'strava', 'workout', {
  workout_type: 'Run',
  min_distance: 5000  // meters
}, true);
```

### Spotify
```typescript
// Listening time (minutes)
await linkHabitToIntegration(habitId, 'spotify', 'listening', {}, true);

// Track count
await linkHabitToIntegration(habitId, 'spotify', 'listening', {
  unit: 'count'
}, true);
```

### Duolingo
```typescript
// XP earned
await linkHabitToIntegration(habitId, 'duolingo', 'learning', {}, true);

// Specific language
await linkHabitToIntegration(habitId, 'duolingo', 'learning', {
  language: 'Spanish'
}, true);
```

### Kindle
```typescript
// Reading time (minutes)
await linkHabitToIntegration(habitId, 'kindle', 'reading', {
  unit: 'minutes'
}, true);

// Pages read
await linkHabitToIntegration(habitId, 'kindle', 'reading', {
  unit: 'pages'
}, true);
```

### Plaid
```typescript
// Total spending
await linkHabitToIntegration(habitId, 'plaid', 'spending', {}, true);

// Spending in specific category
await linkHabitToIntegration(habitId, 'plaid', 'spending', {
  category: 'Food and Drink'
}, true);
```

### Garmin
```typescript
// Workouts (similar to Strava)
await linkHabitToIntegration(habitId, 'garmin', 'workout', {
  workout_type: 'Cycling',
  min_distance: 10000  // meters
}, true);
```

## Using in UI Components

### IntegrationSelector in Habit Creation

```typescript
import { IntegrationSelector, IntegrationOption } from '@/components/IntegrationSelector';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function HabitCreationForm() {
  const [selectedIntegrations, setSelectedIntegrations] = useState<
    { serviceName: string; dataType: string }[]
  >([]);
  const [availableIntegrations, setAvailableIntegrations] = useState<IntegrationOption[]>([]);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    const { data } = await supabase
      .from('integrations')
      .select('*')
      .eq('is_connected', true);

    const integrationOptions: IntegrationOption[] = [
      {
        serviceName: 'apple-health',
        displayName: 'Apple Health',
        icon: 'fitness',
        isConnected: !!data?.find(i => i.service_name === 'apple-health'),
        dataTypes: [
          { value: 'steps', label: 'Steps', unit: 'steps', description: 'Daily step count' },
          { value: 'sleep', label: 'Sleep', unit: 'hours', description: 'Hours of sleep' },
          { value: 'active_energy', label: 'Active Energy', unit: 'kcal', description: 'Calories burned' },
          { value: 'distance', label: 'Distance', unit: 'meters', description: 'Walking/running distance' },
        ]
      },
      {
        serviceName: 'strava',
        displayName: 'Strava',
        icon: 'bicycle',
        isConnected: !!data?.find(i => i.service_name === 'strava'),
        dataTypes: [
          { value: 'workout', label: 'Workouts', unit: 'count', description: 'Track your activities' },
        ]
      },
      // ... more integrations
    ];

    setAvailableIntegrations(integrationOptions);
  };

  const handleToggleIntegration = (serviceName: string, dataType: string) => {
    setSelectedIntegrations(prev => {
      const exists = prev.some(
        i => i.serviceName === serviceName && i.dataType === dataType
      );
      
      if (exists) {
        return prev.filter(
          i => !(i.serviceName === serviceName && i.dataType === dataType)
        );
      } else {
        return [...prev, { serviceName, dataType }];
      }
    });
  };

  const handleSave = async () => {
    // Create habit first
    const habit = await addHabit({ name: 'My Habit', ... });
    
    // Link integrations
    for (const integration of selectedIntegrations) {
      await linkHabitToIntegration(
        habit.id,
        integration.serviceName,
        integration.dataType
      );
    }
  };

  return (
    <View>
      {/* Other form fields */}
      
      <IntegrationSelector
        selectedIntegrations={selectedIntegrations}
        onToggleIntegration={handleToggleIntegration}
        availableIntegrations={availableIntegrations}
      />
      
      <Button onPress={handleSave}>Create Habit</Button>
    </View>
  );
}
```

### SyncStatusBadge in Habit Detail

```typescript
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { useEffect, useState } from 'react';
import { getHabitIntegrations } from '@/lib/habits';

function HabitDetailScreen({ habitId }: { habitId: string }) {
  const [integrations, setIntegrations] = useState([]);

  useEffect(() => {
    loadIntegrations();
  }, [habitId]);

  const loadIntegrations = async () => {
    const data = await getHabitIntegrations(habitId);
    setIntegrations(data);
  };

  return (
    <View>
      <Text>Linked Integrations:</Text>
      
      {integrations.map(integration => (
        <View key={integration.id} className="flex-row items-center justify-between p-3">
          <View>
            <Text>{integration.integrations.service_name}</Text>
            <Text className="text-sm text-gray-500">{integration.data_type}</Text>
          </View>
          
          <SyncStatusBadge
            status={integration.integrations.sync_status}
            lastSync={integration.integrations.last_sync}
            serviceName={integration.integrations.service_name}
          />
        </View>
      ))}
    </View>
  );
}
```

## Troubleshooting

### Habit Not Auto-Completing

1. Check if integration is linked:
   ```typescript
   const mappings = await getHabitIntegrations(habitId);
   console.log('Mappings:', mappings);
   ```

2. Verify `auto_complete` is enabled:
   ```sql
   SELECT * FROM habit_integration_mappings WHERE habit_id = 'your-habit-id';
   ```

3. Check synced data:
   ```sql
   SELECT * FROM synced_activities 
   WHERE integration_id = 'your-integration-id'
   ORDER BY synced_at DESC;
   ```

4. Manual sync and check logs:
   ```typescript
   await SyncCoordinator.processHabitMappings();
   // Check console for any errors
   ```

### Integration Not Syncing

1. Check connection status:
   ```sql
   SELECT * FROM integrations WHERE user_id = 'your-user-id';
   ```

2. Try manual sync:
   ```typescript
   await SyncCoordinator.syncIntegration('service-name');
   ```

3. Check for expired tokens:
   ```sql
   SELECT service_name, token_expiry 
   FROM integrations 
   WHERE token_expiry < NOW();
   ```

### Notifications Not Appearing

1. Check permissions:
   ```typescript
   import { NotificationService } from '@/lib/notificationService';
   const hasPermission = await NotificationService.areNotificationsEnabled();
   console.log('Notifications enabled:', hasPermission);
   ```

2. Request permissions if needed:
   ```typescript
   await NotificationService.requestNotificationPermission();
   ```

3. Test immediate notification:
   ```typescript
   await NotificationService.sendIntegrationSyncNotification('strava', 'Run 5k');
   ```

## Best Practices

1. **Always check integration connection status** before linking
2. **Use specific configurations** for better data filtering (e.g., workout types)
3. **Enable auto-complete** for seamless habit tracking
4. **Sync periodically** in the background for best UX
5. **Handle errors gracefully** - integrations may fail occasionally
6. **Show sync status in UI** so users know their data is up-to-date
