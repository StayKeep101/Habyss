import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wlbjhtlznzdumqxetilx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsYmpodGx6bnpkdW1xeGV0aWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODEyNzgsImV4cCI6MjA4MjQ1NzI3OH0.8ROXRqtoSRcKRqtR8vfZZax6XiBFMgewbRUryHG4Bz0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
