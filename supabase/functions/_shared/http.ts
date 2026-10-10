import { createClient } from '@supabase/supabase-js';

export const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function authenticate(request: Request) {
  const client = serviceClient();
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new Error('Unauthorized');
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Unauthorized');
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();
  if (profileError || !profile?.active) throw new Error('Account is inactive or unavailable');
  return { client, profile, authUser: data.user };
}
