import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })

    const { email, password, name, role, branch_id, outlet_id, status } = await req.json()

    // 1. Create the user using admin API
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Automatically confirm email since it's created by an admin
    })

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const userId = userData.user.id

    // 2. Update their profile details
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        name: name,
        role: role,
        branch_id: branch_id || null,
        outlet_id: outlet_id || null,
        status: status || 'active'
      })
      .eq('id', userId)

    if (profileError) {
      // If profile update fails, we might want to delete the user to avoid orphaned accounts, 
      // but for simplicity we will just return the error.
      return new Response(
        JSON.stringify({ error: 'User created but profile update failed: ' + profileError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Success
    return new Response(
      JSON.stringify({ message: 'User created successfully', user: userData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
