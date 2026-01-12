import { createClient } from '@supabase/supabase-js'

export function getSupabase(req){
  const token = req.headers.authorization?.replace('Bearer ','')
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` }}}
  )
}