-- Habit to Integration Mapping Table
CREATE TABLE IF NOT EXISTS habit_integration_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE NOT NULL,
  data_type VARCHAR(100) NOT NULL, -- e.g., 'steps', 'workout', 'reading_time'
  config JSONB DEFAULT '{}', -- Configuration for mapping (e.g., workout type filter, minimum values)
  auto_complete BOOLEAN DEFAULT true, -- Whether to auto-complete habit when data meets goal
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(habit_id, integration_id, data_type)
);

-- Add indexes for better query performance
CREATE INDEX idx_habit_integration_mappings_habit_id ON habit_integration_mappings(habit_id);
CREATE INDEX idx_habit_integration_mappings_integration_id ON habit_integration_mappings(integration_id);
CREATE INDEX idx_synced_activities_integration_id ON synced_activities(integration_id);
CREATE INDEX idx_synced_activities_habit_id ON synced_activities(habit_id);
CREATE INDEX idx_synced_activities_synced_at ON synced_activities(synced_at);
CREATE INDEX idx_integrations_user_service ON integrations(user_id, service_name);

-- RLS Policies for habit_integration_mappings
ALTER TABLE habit_integration_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own habit integration mappings"
  ON habit_integration_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM habits
      WHERE habits.id = habit_integration_mappings.habit_id
      AND habits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own habit integration mappings"
  ON habit_integration_mappings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM habits
      WHERE habits.id = habit_integration_mappings.habit_id
      AND habits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own habit integration mappings"
  ON habit_integration_mappings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM habits
      WHERE habits.id = habit_integration_mappings.habit_id
      AND habits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own habit integration mappings"
  ON habit_integration_mappings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM habits
      WHERE habits.id = habit_integration_mappings.habit_id
      AND habits.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_habit_integration_mappings_updated_at
    BEFORE UPDATE ON habit_integration_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add policy for synced_activities INSERT (was missing)
CREATE POLICY "Users can insert their own synced activities"
  ON synced_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = synced_activities.integration_id
      AND integrations.user_id = auth.uid()
    )
  );
