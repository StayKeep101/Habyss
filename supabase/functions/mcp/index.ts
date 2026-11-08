import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'
import { serveRequest } from './server.ts'

Deno.serve(req => serveRequest(req, createClient(
    Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
)))
