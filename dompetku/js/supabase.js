import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://nnizooudxhvjyfaahydc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaXpvb3VkeGh2anlmYWFoeWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MjgxNTcsImV4cCI6MjEwMzMwNDE1N30.KGxjyDNZMv0co7irBQWfJsyYsO6ZII38FvSLamHqWIQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

