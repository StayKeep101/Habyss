# Habit Tracker Database Schema Design

This document provides a production-ready database schema for your habit tracking application, designed for Supabase (PostgreSQL).

## 1. Schema Overview

The schema is designed around three core concepts:
1.  **Profiles**: User metadata and preferences.
2.  **Habits**: The definition and configuration of habits.
3.  **Habit Logs**: The daily execution and tracking data.

We use **UUIDs** for all primary keys and strictly enforce **Row Level Security (RLS)** to ensure data isolation between users.

### Key Features Supported
*   **Flexible Scheduling**: JSONB storage for complex day patterns.
*   **Quantifiable Goals**: `goal_value` and `unit` in definitions, with numeric `value` in logs.
*   **Analytics Ready**: Pre-calculated streak fields and efficient indexing for historical queries.
*   **Audit Trail**: Timestamps on all records.

---

## 2. Detailed SQL Schema

```sql
-- 1. PROFILES TABLE
-- Extends the auth.users table with application-specific user data
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text,
  avatar_url text,
  timezone text DEFAULT 'UTC', -- Critical for accurate daily reset times
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. HABITS TABLE
-- Stores the configuration for each habit
CREATE TABLE public.habits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  
  -- Core Details
  name text NOT NULL,
  description text,
  icon text, -- Ionicons name string
  color text DEFAULT '#6B46C1', -- Hex code
  category text NOT NULL CHECK (category IN ('health', 'fitness', 'work', 'personal', 'misc')),
  type text DEFAULT 'build' CHECK (type IN ('build', 'quit')),
  
  -- Goal Configuration
  goal_value integer DEFAULT 1, -- e.g., 8 (glasses of water)
  unit text DEFAULT 'count', -- e.g., 'glasses', 'minutes'
  goal_period text DEFAULT 'daily' CHECK (goal_period IN ('daily', 'weekly', 'monthly')),
  
  -- Scheduling
  task_days jsonb DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb, -- Array of active days
  start_time text, -- 'HH:mm' format (simple text is efficient for this UI)
  end_time text,
  reminders jsonb DEFAULT '[]'::jsonb, -- Array of times
  
  -- Analytics & Term
  chart_type text DEFAULT 'bar' CHECK (chart_type IN ('bar', 'line')),
  start_date date DEFAULT CURRENT_DATE,
  end_date date, -- NULL means "Forever"
  
  -- Stats (Cached for performance)
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  total_completions integer DEFAULT 0,
  last_completed_date date,
  
  -- State
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. HABIT LOGS TABLE (formerly habit_completions)
-- Records daily activity
CREATE TABLE public.habit_completions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  habit_id uuid REFERENCES public.habits(id) ON DELETE CASCADE NOT NULL,
  
  date date NOT NULL, -- The "logical" date of completion
  value numeric DEFAULT 1, -- The actual amount done (e.g., 500ml)
  completed boolean DEFAULT true, -- Explicit status
  
  memo text, -- Optional journal entry
  mood text, -- Optional mood tracking
  
  created_at timestamptz DEFAULT now(),
  
  -- Ensure only one log entry per habit per day (unless you want multiple entries sum up)
  UNIQUE(habit_id, date)
);
```

### Indexes for Performance
```sql
-- Filter habits by user quickly
CREATE INDEX idx_habits_user_id ON public.habits(user_id);

-- Quick lookups for daily dashboard (find logs for specific habit & date)
CREATE INDEX idx_habit_completions_habit_date ON public.habit_completions(habit_id, date);

-- Analytics queries (get all logs for a user in a date range)
CREATE INDEX idx_habit_completions_user_date ON public.habit_completions(user_id, date);
```

---

## 3. Row Level Security (RLS) Policies

Security is paramount. These policies ensure users can strictly access only their own data.

```sql
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

-- HABITS POLICIES
CREATE POLICY "Users can view own habits" ON public.habits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habits" ON public.habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits" ON public.habits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits" ON public.habits
  FOR DELETE USING (auth.uid() = user_id);

-- LOGS POLICIES
CREATE POLICY "Users can view own logs" ON public.habit_completions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON public.habit_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs" ON public.habit_completions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs" ON public.habit_completions
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 4. Common Queries (JS Client)

Here are the most critical queries for your application logic.

### 1. Get Today's Dashboard (Habits + Status)
Retrieves all active habits and checks if they are completed for a specific date.

```javascript
const date = '2024-12-30';
const { data, error } = await supabase
  .from('habits')
  .select(`
    *,
    habit_completions!inner (
      completed,
      value
    )
  `)
  .eq('user_id', userId)
  .eq('is_archived', false)
  .eq('habit_completions.date', date); 
// Note: This does an inner join, simpler approach is often two queries or a left join
```
*Better Approach (Left Join logic via separate queries usually performant enough for app size)*:
1. Fetch active habits.
2. Fetch logs for today.
3. Merge in UI.

### 2. Calculate Stats (Last 30 Days)
```javascript
const { data } = await supabase
  .from('habit_completions')
  .select('date, value, habit_id')
  .gte('date', thirtyDaysAgoISO)
  .lte('date', todayISO);
// Process in client to build charts
```

### 3. Mark Habit Complete (Toggle)
```javascript
// Check if exists first, then Insert or Delete/Update
const { data } = await supabase
  .from('habit_completions')
  .upsert({
    user_id: uid,
    habit_id: habitId,
    date: todayStr,
    completed: true,
    value: targetValue // or current accumulated value
  })
  .select();
```

---

## 5. Sample Data (SQL)

You can run this SQL to seed your database with test data for a user.
*Replace `USER_UUID_HERE` with a real user ID from your `auth.users` table.*

```sql
-- 1. Create a "Morning Run" habit
INSERT INTO public.habits (user_id, name, description, icon, color, category, type, goal_value, unit, frequency_days)
VALUES 
  ('USER_UUID_HERE', 'Morning Run', '5km run around the park', 'fitness', '#FBBF24', 'fitness', 'build', 5, 'km', '["mon", "wed", "fri"]'::jsonb);

-- 2. Create a "Read Book" habit
INSERT INTO public.habits (user_id, name, description, icon, color, category, type, goal_value, unit, frequency_days)
VALUES 
  ('USER_UUID_HERE', 'Read Book', '30 mins before bed', 'book', '#60A5FA', 'personal', 'build', 30, 'minutes', '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb);

-- 3. Log some completions for "Morning Run"
-- Assuming the ID of the run habit is known or you run this in a block
DO $$
DECLARE
  run_habit_id uuid;
BEGIN
  SELECT id INTO run_habit_id FROM public.habits WHERE name = 'Morning Run' LIMIT 1;
  
  -- Log yesterday
  INSERT INTO public.habit_completions (user_id, habit_id, date, completed, value)
  VALUES ('USER_UUID_HERE', run_habit_id, CURRENT_DATE - 1, true, 5.2);

  -- Log today
  INSERT INTO public.habit_completions (user_id, habit_id, date, completed, value)
  VALUES ('USER_UUID_HERE', run_habit_id, CURRENT_DATE, true, 5.0);
END $$;
```

---

## 6. Addressing Your Specific Questions

1.  **Streaks: Separate Table or On-demand?**
    *   **Recommendation**: **Cached columns on `habits` table** (`current_streak`, `longest_streak`).
    *   **Reasoning**: Streaks are read *constantly* (every time the dashboard loads) but written *rarely* (once per day per habit). Calculating them on-the-fly involves scanning the entire history of logs, which gets slower as data grows. Caching them allows for instant UI rendering.

2.  **Categories: Hardcoded or Table?**
    *   **Recommendation**: **Text column with Check Constraint** (or ENUM).
    *   **Reasoning**: Your UI shows 4 fixed categories. A separate table adds join complexity for little gain unless you plan to let users create custom categories. For simplicity + functionality, a simple text field is best.

3.  **Frequency Handling**
    *   **Recommendation**: `task_days` JSONB Array (e.g., `["mon", "wed", "fri"]`).
    *   **Reasoning**: This is the most flexible way to handle "Specific Days". For "Daily", you just store all 7 days. For "Weekly", you can interpret the logic in your app (e.g., "any 1 day this week").

4.  **Timezones**
    *   **Recommendation**: Store `timezone` in `profiles`.
    *   **Reasoning**: A habit completed at 1 AM on Tuesday might be 11 PM Monday in UTC. Always store dates as `YYYY-MM-DD` based on the user's *local* time, not UTC, to ensure streaks survive travel.

5.  **Quantifiable Habits**
    *   **Recommendation**: Add `goal_value` to `habits` and `value` to `habit_completions`.
    *   **Reasoning**: This allows you to track "Drank 500ml" vs "Goal 2000ml". A simple boolean `completed` is not enough for these.

---

## 7. Migration Strategy

1.  **Run the provided SQL**: Execute the `CREATE TABLE` and `ALTER TABLE` statements in your Supabase SQL Editor.
2.  **Seed Data**: Create a test user and insert a few habits to verify the UI.
3.  **Update Client Code**: Update your `types.ts` or interfaces to match the new schema fields (especially `value` and `task_days`).

This schema is designed to scale with your user base while keeping the initial implementation straightforward.
