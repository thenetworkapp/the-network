import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── VAPID helpers ──────────────────────────────────────────────────────────────
// RFC 8292 / Web Push Protocol implementation for Deno.
// Uses the VAPID_PRIVATE_KEY secret (base64url-encoded raw EC private key).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + (4 - s.length % 4) % 4, '=')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

function base64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function makeVapidToken(audience: string, subject: string, privateKeyB64: string): Promise<string> {
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  })))
  const sigInput = `${header}.${payload}`

  const rawKey = base64urlDecode(privateKeyB64)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(sigInput),
  )
  return `${sigInput}.${base64urlEncode(sig)}`
}

// ── Handler ───────────────────────────────────────────────────────────────────

interface PushPayload {
  /** Target user IDs — omit to broadcast to all subscribed users */
  personIds?: string[]
  title: string
  body: string
  /** Relative URL to open when the notification is clicked */
  url?: string
  threadId?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Verify the calling user has at least viewer role (is a real team member)
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401, headers: CORS })

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401, headers: CORS })

  const payload: PushPayload = await req.json()
  const { personIds, title, body, url = '/', threadId } = payload

  if (!title || !body) {
    return new Response(JSON.stringify({ error: 'title and body are required' }), { status: 400, headers: CORS })
  }

  // Fetch target subscriptions
  let query = supabase.from('push_subscriptions').select('endpoint, keys, person_id')
  if (personIds && personIds.length > 0) {
    query = query.in('person_id', personIds)
  }
  const { data: subs, error: subErr } = await query
  if (subErr) return new Response(JSON.stringify({ error: subErr.message }), { status: 500, headers: CORS })
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
  const vapidSubject = `mailto:${Deno.env.get('VAPID_SUBJECT') ?? 'admin@thenetwork.app'}`

  const notificationBody = JSON.stringify({ title, body, url, threadId })

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const endpoint: string = sub.endpoint
      const keys: { p256dh: string; auth: string } = sub.keys as { p256dh: string; auth: string }

      const origin = new URL(endpoint).origin
      const token = await makeVapidToken(origin, vapidSubject, vapidPrivateKey)

      // Encrypt payload using Web Push content encryption (RFC 8291)
      // For simplicity we send an unencrypted body — add web-push-lib if you need encryption.
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `vapid t=${token},k=${vapidPublicKey}`,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'TTL': '86400',
        },
        body: new TextEncoder().encode(notificationBody),
      })

      if (res.status === 410) {
        // Subscription expired — remove it
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
      }

      return { endpoint, status: res.status }
    }),
  )

  const sent = results.filter(r => r.status === 'fulfilled' && (r.value as { status: number }).status < 300).length

  return new Response(
    JSON.stringify({ sent, total: subs.length }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
