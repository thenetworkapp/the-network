import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorised', { status: 401, headers: corsHeaders })

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify the JWT and get the calling user
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return new Response('Unauthorised', { status: 401, headers: corsHeaders })

    // Guard: only works if NO positions currently have a person assigned (true first run)
    const { count } = await serviceClient
      .from('positions')
      .select('id', { count: 'exact', head: true })
      .not('person_id', 'is', null)

    if ((count ?? 0) > 0) {
      return new Response(
        JSON.stringify({ error: 'Platform already initialised. Ask an existing admin to assign your role.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Find or create the executive position
    let execId: string
    const { data: existing } = await serviceClient
      .from('positions')
      .select('id')
      .eq('role', 'executive')
      .is('person_id', null)
      .limit(1)
      .single()

    if (existing) {
      execId = existing.id
      await serviceClient
        .from('positions')
        .update({ person_id: user.id })
        .eq('id', execId)
    } else {
      // No executive position in seed — create one
      const { data: created, error: createErr } = await serviceClient
        .from('positions')
        .insert({
          title: 'Executive Director',
          role: 'executive',
          path: 'executive',
          show_ids: [],
          person_id: user.id,
        })
        .select('id')
        .single()
      if (createErr || !created) throw createErr ?? new Error('Failed to create position')
      execId = created.id
    }

    // Ensure a profile row exists for this user
    await serviceClient
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: user.email?.split('@')[0] ?? 'Admin',
        initials: (user.email?.slice(0, 2) ?? 'AD').toUpperCase(),
        avatar_colour: '#1C3FCB',
      })

    return new Response(
      JSON.stringify({ success: true, positionId: execId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('bootstrap-admin error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
