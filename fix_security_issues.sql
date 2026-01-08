-- ==============================================================================
-- Fix Supabase Security Warnings
-- Run this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. SECURITY: ENABLE RLS ON PUBLIC TABLES
-- Warning: Table `public.notifications` is public, but RLS has not been enabled.
-- Action: Enable RLS and add a basic policy.

ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Users can view their own notifications'
    ) THEN
        CREATE POLICY "Users can view their own notifications" 
        ON public.notifications 
        FOR SELECT 
        USING ((select auth.uid()) = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Users can update their own notifications'
    ) THEN
        CREATE POLICY "Users can update their own notifications" 
        ON public.notifications 
        FOR UPDATE 
        USING ((select auth.uid()) = user_id);
    END IF;
END $$;


-- 2. SECURITY: FIX MUTABLE SEARCH PATHS ON FUNCTIONS
-- Warning: Functions have role mutable search_path.
-- Action: Set search_path to 'public' to prevent malicious code injection via object shadowing.

DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Loop through all functions named 'handle_new_user', 'update_updated_at_column', 'notify_user', etc.
    FOR func_record IN 
        SELECT n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN (
            'handle_new_user', 
            'update_updated_at_column', 
            'notify_user', 
            'shared_habits_after_insert_notify', 
            'habit_completion_after_insert_notify_shared'
        )
    LOOP
        -- Execute the ALTER FUNCTION command dynamically
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = public',
            func_record.schema_name,
            func_record.function_name,
            func_record.args
        );
    END LOOP;
END $$;
