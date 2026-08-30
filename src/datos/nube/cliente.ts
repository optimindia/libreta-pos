import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Sin credenciales, la nube simplemente no existe y la aplicación
 *  funciona igual: todo vive en el teléfono. */
export const cliente: SupabaseClient | null =
  url && clave ? createClient(url, clave) : null

export function nubeActiva(): boolean {
  return cliente !== null
}
