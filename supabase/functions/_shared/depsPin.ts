// Conecta la lógica de recuperación del PIN (recuperacionPin.ts) con la base y
// con Auth. Sólo corre en las funciones Edge (Deno), con la clave de servicio.
// No registra nada en consola: ni PIN, ni código, ni teléfonos.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.4'
import type { DatosPin } from './recuperacionPin.ts'

const DOMINIO = '@libreta.app'
const TIEMPO_MAXIMO_MS = 15_000

export function crearDatosPin(admin: SupabaseClient, supabaseUrl: string, serviceKey: string): DatosPin {
  const numeroDeEmail = (email: string | undefined | null): string | null => {
    if (!email || !email.endsWith(DOMINIO)) return null
    const numero = email.slice(0, -DOMINIO.length)
    return /^\d{10,15}$/.test(numero) ? numero : null
  }

  const datos: DatosPin = {
    async vinculo(usuarioId) {
      const { data, error } = await admin
        .from('usuarios_negocio')
        .select('usuario_id,negocio_id,rol,nombre')
        .eq('usuario_id', usuarioId)
        .maybeSingle()
      if (error) throw new Error('pin_vinculo')
      if (!data) return null
      return {
        usuarioId: data.usuario_id as string,
        negocioId: data.negocio_id as string,
        rol: data.rol === 'vendedor' ? 'vendedor' : 'dueno',
        nombre: (data.nombre as string | null) ?? null,
      }
    },

    async vendedoresDe(negocioId) {
      const { data, error } = await admin
        .from('usuarios_negocio')
        .select('usuario_id,nombre,telefono,debe_cambiar_pin')
        .eq('negocio_id', negocioId)
        .eq('rol', 'vendedor')
        .order('creado_en', { ascending: true })
      if (error) throw new Error('pin_vendedores')
      return (data ?? []).map((fila) => ({
        usuarioId: fila.usuario_id as string,
        nombre: (fila.nombre as string | null) ?? null,
        telefono: (fila.telefono as string | null) ?? null,
        debeCambiar: fila.debe_cambiar_pin === true,
      }))
    },

    async numeroDe(usuarioId) {
      const { data, error } = await admin.auth.admin.getUserById(usuarioId)
      if (error || !data.user) return null
      return numeroDeEmail(data.user.email)
    },

    async usuarioPorNumero(numero) {
      // El dueño se encuentra por el teléfono de contacto de su negocio (el
      // alta lo guarda normalizado) y se confirma contra el email de Auth.
      const negocio = await admin.from('negocios').select('id').eq('telefono_contacto', numero).limit(1).maybeSingle()
      if (negocio.error) throw new Error('pin_negocio')
      if (!negocio.data) return null
      const dueno = await admin
        .from('usuarios_negocio')
        .select('usuario_id')
        .eq('negocio_id', negocio.data.id)
        .eq('rol', 'dueno')
        .order('creado_en', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (dueno.error) throw new Error('pin_dueno')
      if (!dueno.data) return null
      const usuarioId = dueno.data.usuario_id as string
      return (await datos.numeroDe(usuarioId)) === numero ? { usuarioId } : null
    },

    async autenticar(email, password) {
      try {
        const respuesta = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
        })
        const cuerpo = await respuesta.json().catch(() => ({}))
        if (respuesta.ok && cuerpo?.access_token) return 'ok'
        const codigo = String(cuerpo?.error_code ?? cuerpo?.error ?? '')
        if (respuesta.status === 400 && /invalid_credentials|invalid_grant/.test(codigo)) return 'rechazado'
        return 'error'
      } catch {
        return 'error'
      }
    },

    async cambiarPassword(usuarioId, password) {
      const { error } = await admin.auth.admin.updateUserById(usuarioId, { password })
      if (error) throw new Error('pin_password')
    },

    async debeCambiar(usuarioId) {
      const { data, error } = await admin
        .from('usuarios_negocio')
        .select('debe_cambiar_pin')
        .eq('usuario_id', usuarioId)
        .maybeSingle()
      if (error) throw new Error('pin_bandera')
      return data?.debe_cambiar_pin === true
    },

    async marcarCambio(usuarioId, debe) {
      const { error } = await admin.from('usuarios_negocio').update({ debe_cambiar_pin: debe }).eq('usuario_id', usuarioId)
      if (error) throw new Error('pin_bandera')
    },

    async hayCodigo(usuarioId) {
      const { data, error } = await admin
        .from('recuperacion_pin_codigos')
        .select('usuario_id')
        .eq('usuario_id', usuarioId)
        .is('usado_en', null)
        .maybeSingle()
      if (error) throw new Error('pin_codigo')
      return !!data
    },

    async guardarCodigo(usuarioId, hash) {
      const { error } = await admin
        .from('recuperacion_pin_codigos')
        .upsert(
          { usuario_id: usuarioId, codigo_hash: hash, creado_en: new Date().toISOString(), usado_en: null },
          { onConflict: 'usuario_id' },
        )
      if (error) throw new Error('pin_codigo')
    },

    async consumirCodigo(usuarioId, hash) {
      // Un solo UPDATE condicional: si dos pedidos llegan juntos, la base deja
      // pasar a uno solo (el otro encuentra usado_en ya marcado).
      const { data, error } = await admin
        .from('recuperacion_pin_codigos')
        .update({ usado_en: new Date().toISOString() })
        .eq('usuario_id', usuarioId)
        .eq('codigo_hash', hash)
        .is('usado_en', null)
        .select('usuario_id')
      if (error) throw new Error('pin_codigo')
      return (data ?? []).length === 1
    },

    async auditar(evento) {
      const { error } = await admin.from('suscripcion_eventos').insert({
        negocio_id: evento.negocioId,
        accion: evento.accion,
        // Sólo ids internos: ni PIN, ni código, ni teléfono.
        detalle: { objetivo: evento.objetivoId },
        actor_id: evento.actorId,
      })
      if (error) throw new Error('pin_auditoria')
    },
  }
  return datos
}
