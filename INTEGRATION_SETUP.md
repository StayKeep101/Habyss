# Integration Setup Guide

This document provides instructions for setting up all third-party integrations with Habyss.

## Prerequisites

- Supabase project set up
- OAuth credentials for each integration
- Environment variables configured

## Database Migration

Run the migration to create the habit_integration_mappings table:

```bash
# Apply the migration to your Supabase project
npx supabase db push
```

## Integration OAuth Setup

### 1. Strava

**Register OAuth App:**
1. Go to https://www.strava.com/settings/api
2. Create a new application
3. Set Authorization Callback Domain to your Supabase function URL
4. Add these environment variables to Supabase:

```bash
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=https://your-project.supabase.co/functions/v1/strava-oauth
```

**Deploy Edge Function:**
```bash
npx supabase functions deploy strava-oauth
```

### 2. Spotify

**Register OAuth App:**
1. Go to https://developer.spotify.com/dashboard
2. Create a new app
3. Add redirect URI to your Supabase function
4. Add these environment variables:

```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=https://your-project.supabase.co/functions/v1/spotify-oauth
```

**Deploy Edge Function:**
```bash
npx supabase functions deploy spotify-oauth
```

### 3. Garmin

**Register OAuth App:**
1. Go to https://developer.garmin.com/
2. Create a new application
3. Configure OAuth 1.0a settings
4. Add these environment variables:

```bash
GARMIN_CONSUMER_KEY=your_consumer_key
GARMIN_CONSUMER_SECRET=your_consumer_secret
```

**Deploy Edge Function:**
```bash
npx supabase functions deploy garmin-oauth
```

### 4. Plaid

**Register App:**
1. Go to https://dashboard.plaid.com/
2. Create a new application
3. Get your API keys
4. Add these environment variables:

```bash
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox # or 'development', 'production'
```

**Deploy Edge Function:**
```bash
npx supabase functions deploy plaid-oauth
```

### 5. Apple Health

Apple Health requires native iOS permissions. No OAuth setup needed.

**Configure in Info.plist:**
```xml
<key>NSHealthShareUsageDescription</key>
<string>Habyss needs access to your health data to automatically track your fitness habits.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>Habyss would like to update your health data.</string>
```

### 6. Duolingo

Duolingo doesn't have a public OAuth API. The current implementation uses mock data. For production:
- Use unofficial API endpoints (not recommended for production)
- Contact Duolingo for API access
- Or remove this integration

### 7. Kindle

Kindle doesn't have a public API. For production:
- Use Amazon Product Advertising API (limited access)
- Or remove this integration

### 8. Stripe

Stripe is already configured. Ensure these environment variables are set in Supabase:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_PRICE_ID=price_...
APP_URL=your_app_url
```

## Testing Integrations

### Local Development

1. Start Supabase locally:
```bash
npx supabase start
```

2. Deploy functions locally:
```bash
npx supabase functions serve
```

3. Test OAuth flows in your app

### Production

1. Deploy edge functions:
```bash
npx supabase functions deploy strava-oauth
npx supabase functions deploy spotify-oauth
npx supabase functions deploy garmin-oauth
npx supabase functions deploy plaid-oauth
```

2. Update environment variables in Supabase dashboard

3. Test each integration connection flow

## Using Integrations in the App

### Linking a Habit to an Integration

```typescript
import { linkHabitToIntegration } from '@/lib/habits';

// Link a "Run 5k" habit to Strava running activities
await linkHabitToIntegration(
  habitId,
  'strava',
  'workout',
  { workout_type: 'Run', min_distance: 5000 },
  true // auto-complete when goal is met
);
```

### Syncing Integrations

```typescript
import { SyncCoordinator } from '@/lib/syncCoordinator';

// Sync all integrations
await SyncCoordinator.syncAllIntegrations();

// Sync specific integration
await SyncCoordinator.syncIntegration('strava');
```

### Available Data Types

- **apple-health**: `steps`, `active_energy`, `sleep`, `distance`
- **strava**: `workout` (config: `workout_type`, `min_distance`)
- **spotify**: `listening` (tracks songs or listening time)
- **duolingo**: `learning` (XP points)
- **plaid**: `spending` (transaction amounts)
- **garmin**: `workout` (similar to Strava)
- **kindle**: `reading` (pages or time)

## Troubleshooting

### OAuth Redirect Issues

If OAuth redirects aren't working:
1. Check that redirect URIs match exactly in OAuth app settings
2. Verify edge functions are deployed and accessible
3. Check Supabase function logs: `npx supabase functions logs <function-name>`

### Sync Failures

If data isn't syncing:
1. Check integration connection status in database
2. Verify tokens haven't expired
3. Check for API rate limits
4. Review error logs in Supabase

### Auto-completion Not Working

If habits aren't auto-completing:
1. Verify habit is linked to integration (`habit_integration_mappings` table)
2. Check `auto_complete` is set to `true`
3. Ensure synced data meets the habit goal criteria
4. Check `syncCoordinator` logs for errors

## Security Notes

- Never commit OAuth secrets to version control
- Use Supabase Vault for sensitive credentials in production
- Implement token refresh logic for expired access tokens
- Use HTTPS for all OAuth callbacks
- Validate webhook signatures (especially for Stripe)

## Next Steps

1. Set up OAuth apps for each integration you want to use
2. Deploy edge functions to Supabase
3. Configure environment variables
4. Test connection flows in the app
5. Create habits and link them to integrations
6. Verify auto-completion works as expected
