import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://vrlhimuvtrcydzlflxif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZybGhpbXV2dHJjeWR6bGZseGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzg4NDQsImV4cCI6MjA5Nzk1NDg0NH0.xnlZ8ecgHl7q-KnYKRydjy75W-9cHCdYVw-QX2nM9No';

export const supabase = createClient(supabaseUrl, supabaseKey);
