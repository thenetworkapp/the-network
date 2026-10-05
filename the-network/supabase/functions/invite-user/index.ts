import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorised', { status: 401, headers: corsHeaders })

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify caller and check manage_users permission
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return new Response('Unauthorised', { status: 401, headers: corsHeaders })

    // Check caller has manage_users permission (is executive or head with that permission)
    const { data: positions } = await serviceClient
      .from('positions')
      .select('role')
      .eq('person_id', user.id)

    const adminRoles = ['executive', 'head']
    const isAdmin = positions?.some(p => adminRoles.includes(p.role))
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only admins can invite new users.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json() as { email: string; redirectTo?: string }
    const { email, redirectTo } = body
    if (!email?.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'A valid email address is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo ?? Deno.env.get('SITE_URL') ?? 'http://localhost:5173',
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, userId: data.user.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('invite-user error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
