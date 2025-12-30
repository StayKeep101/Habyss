# Habit Tracker Database Schema Design Request

## Context
I'm building a habit tracking application and need you to analyze my habit creation modal/form to design an optimal database schema.

## What I Need
Please analyze the attached screenshots/description of my habit creation interface and provide:

1. **Complete SQL schema** for Supabase/PostgreSQL
2. **Justification** for each table and column
3. **Index recommendations** for performance
4. **Row Level Security (RLS) policies** for Supabase
5. **Common queries** I'll need to run

## My Habit Creation Modal Features

Based on the provided screenshots, my modal includes:

### HABIT DETAILS Section
- **Icon Selector**: Button with "+" icon to select/add habit icon
- **Habit Name**: Text input field (placeholder: "Habit Name")
- **Description**: Large textarea (optional, placeholder: "Description (optional)")
- **Build/Quit Buttons**: Primary action "Build" button and secondary "Quit" button

### Visual Customization
- **Color Picker**: Row of circular color buttons (purple, blue, green, orange, red, pink, purple, cyan, gray) - user can select one
- **Category Selector**: Four pill-shaped buttons with icons:
  - ❄️ Health
  - 💪 Fitness
  - 💼 Work (selected/highlighted in purple)
  - 👤 Personal

### GOAL SETUP Section
- **Target**: Number input field with label "count" (default value: 1)
  - Appears to be for tracking quantifiable goals
- **Frequency**: Three options (pill buttons):
  - Daily (selected/highlighted)
  - Weekly
  - Monthly

### SCHEDULE Section
- **Day Selector**: Seven circular day buttons for M, T, W, T, F, S, S (all appear selected/active in purple)
  - Allows selecting specific days of the week
- **Start Time**: Dropdown/selector (default: "Anytime")
- **End Time**: Dropdown/selector (default: "Anytime")

### ANALYTICS Section
- **Chart Type**: Two options (toggle buttons):
  - 📊 Bar Chart (selected)
  - 📈 Line Chart

### TERM Section
- **Start Date**: Date picker (showing: 12/30/2025)
- **End Date**: Date picker (showing: "Forever")
  - Appears to support both specific end dates and indefinite ("Forever") duration

### Bottom Action
- **Create Habit**: Large primary button at the bottom to submit the form

### Key Features Observed:
- All days of the week can be individually selected/deselected
- Time ranges can be set (or left as "Anytime")
- Target count is customizable for quantifiable tracking
- Visual analytics preference (bar vs line chart)
- Habits can have specific term durations or run indefinitely
- Clean, dark-themed mobile interface
- Clear visual feedback for selected options (purple highlighting)

## Requirements

### Database Technology
- Supabase (PostgreSQL)
- Use UUIDs for primary keys
- Proper foreign key relationships
- Timestamp tracking (created_at, updated_at)

### Key Functionality to Support
1. **Multiple users** - Each user has their own habits
2. **Daily logging** - Users mark habits complete each day
3. **Streak calculation** - Current streak and longest streak
4. **Historical data** - Never lose past completions
5. **Archiving** - Soft delete (hide without removing data)
6. **Statistics** - Weekly/monthly completion rates
7. **Real-time updates** - Supabase real-time subscriptions

### Data Integrity
- Prevent duplicate logs for the same day
- Cascade deletes where appropriate
- Default values for optional fields
- Constraints on enum-like fields (use CHECK constraints)

### Performance Considerations
- Index frequently queried columns
- Optimize for these common queries:
  - Get all user's active habits
  - Get today's completion status for all habits
  - Get habit logs for last 30/90 days
  - Calculate current streak
  - Get weekly/monthly statistics

### Security (Supabase RLS)
Must include policies for:
- Users can only see/modify their own habits
- Users can only see/modify their own logs
- Proper authentication checks using `auth.uid()`

## Design Principles to Follow

1. **Normalize appropriately** - Don't over-normalize (avoid excessive joins) but don't store redundant data
2. **Future-proof** - Design should accommodate new features without major migrations
3. **Query-friendly** - Structure should make common queries simple and fast
4. **Type-safe** - Use proper PostgreSQL data types (don't use TEXT for everything)
5. **Timestamp handling** - Use DATE for completion dates, TIMESTAMP for audit trails

## Specific Questions to Address

1. Should I use a separate `habit_streaks` table or calculate streaks on-demand?
2. Should categories be hardcoded or in their own table?
3. How should I handle different frequency types (daily, weekly, specific days)?
4. Should I store timezone information?
5. What's the best way to handle "quantifiable" habits (e.g., drink 8 glasses of water)?
6. Should reminders be in the habits table or separate?

## Deliverables

Please provide:

### 1. Complete SQL Schema
```sql
-- All CREATE TABLE statements
-- All indexes
-- All constraints
-- Any helper functions
```

### 2. RLS Policies
```sql
-- Enable RLS
-- All security policies with explanations
```

### 3. Common Queries
```sql
-- 5-10 most common queries with explanations
-- Include both raw SQL and Supabase JS client versions
```

### 4. Sample Data
```sql
-- INSERT statements for realistic test data
```

### 5. Migration Strategy
- How to create this schema in Supabase
- Any triggers needed for automation (e.g., auto-update timestamps)
- Recommended initial setup steps

## Optional Enhancements

If you see opportunities for improvement, please suggest:
- Additional features my modal might be missing
- Better UX through database design
- Performance optimizations
- Data analytics capabilities

## Format

Please structure your response as:

1. **Schema Overview** - High-level explanation
2. **Detailed Schema** - SQL code with inline comments
3. **Design Decisions** - Why you made specific choices
4. **Usage Examples** - How to query this schema
5. **Next Steps** - Implementation checklist

---

## My Modal Details

[INSERT YOUR MODAL SCREENSHOT OR DETAILED DESCRIPTION HERE]

[If you have mockups, wireframes, or existing code, paste them here]

---

Thank you! I'm looking for a production-ready schema that balances simplicity with functionality.