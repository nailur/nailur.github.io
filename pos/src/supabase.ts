import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cgudfsynurrrlkfzebgh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndWRmc3ludXJycmxrZnplYmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyODIyNTQsImV4cCI6MjA5Nzg1ODI1NH0.8x-qh0BbPOGRk8wSB6LZvmLi4Uv1RU3_JOnJlKR4lkc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
