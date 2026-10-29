// Almacén de intentos de PIN sobre public.intentos_ingreso (sólo service role).
// Lo comparten `ingresar` (límite de ingreso y de recuperación sin sesión) y
// `admin` (límite de reinicios y de verificaciones de PIN).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.4'
import type { AlmacenIntentos } from './ingreso.ts'
import type { EstadoIntentos } from './limiteIngreso.ts'

interface FilaIntentos {
  telefono: string
  fallos: number
  desde: string
  bloqueado_hasta: string | null
  version: number
}

export function crearAlmacenIntentos(admin: SupabaseClient): AlmacenIntentos {
  return {
    async leer(telefono) {
      const { data, error } = await admin
        .from('intentos_ingreso')
        .select('telefono,fallos,desde,bloqueado_hasta,version')
        .eq('telefono', telefono)
        .maybeSingle<FilaIntentos>()
      if (error) throw error
      if (!data) return null
      const estado: EstadoIntentos = {
        fallos: data.fallos,
        desde: new Date(data.desde).getTime(),
        bloqueadoHasta: data.bloqueado_hasta ? new Date(data.bloqueado_hasta).getTime() : null,
        version: Number(data.version),
      }
      return estado
    },
    async guardar(telefono, previo, nuevo) {
      const fila = {
        fallos: nuevo.fallos,
        desde: new Date(nuevo.desde).toISOString(),
        bloqueado_hasta: nuevo.bloqueadoHasta === null ? null : new Date(nuevo.bloqueadoHasta).toISOString(),
        actualizado_en: new Date().toISOString(),
      }
      if (!previo) {
        const { error } = await admin.from('intentos_ingreso').insert({ telefono, ...fila, version: 1 })
        if (!error) return true
        if (error.code === '23505') return false // otro pedido la creó primero
        throw error
      }
      const { data, error } = await admin
        .from('intentos_ingreso')
        .update({ ...fila, version: previo.version + 1 })
        .eq('telefono', telefono)
        .eq('version', previo.version)
        .select('telefono')
      if (error) throw error
      return (data ?? []).length === 1
    },
    async limpiar(telefono) {
      const { error } = await admin.from('intentos_ingreso').delete().eq('telefono', telefono)
      if (error) throw error
    },
  }
}
