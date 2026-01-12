import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

export const supabase = createClient(
  'https://iwsacljessokrqhfmdbv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3c2FjbGplc3Nva3JxaGZtZGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxODcyNTMsImV4cCI6MjA4Mzc2MzI1M30.jQ_8KR76Xbbn1Heest75p3I78J6oiSt9V-H31cWWLOo'
)