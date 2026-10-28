// Teléfono + PIN -> credenciales de Supabase Auth, del lado del servidor.
//
// v1 (`libreta-v1:<numero>:<pin>`) se puede calcular en cualquier navegador:
// con el teléfono alcanza para probar el millón de PIN directo contra Auth.
// v2 es un HMAC con un secreto que sólo tienen las funciones de Supabase
// (LIBRETA_PIN_PEPPER): sin ese secreto, conocer el PIN no sirve para pegarle
// directo a Auth, y la única puerta que queda es `ingresar`, que cuenta los
// intentos y bloquea.
//
// Usa sólo Web Crypto, que existe igual en Deno y en Node.

const DOMINIO = 'libreta.app'

export function telefonoNormalizado(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '')
  return digitos.startsWith('54') ? digitos : `54${digitos}`
}

export function emailDeTelefono(numero: string): string {
  return `${numero}@${DOMINIO}`
}

export function passwordV1(numero: string, pin: string): string {
  return `libreta-v1:${numero}:${pin}`
}

export async function passwordV2(numero: string, pin: string, pepper: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = new Uint8Array(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`${numero}:${pin}`)))
  let binario = ''
  for (const byte of firma) binario += String.fromCharCode(byte)
  const base64url = btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `libreta-v2:${base64url}`
}

/** La contraseña con la que se crea o cambia una cuenta: v2 si el servidor
 *  tiene el secreto, v1 si todavía no se configuró. */
export async function passwordParaCuenta(numero: string, pin: string, pepper?: string): Promise<string> {
  return pepper ? passwordV2(numero, pin, pepper) : passwordV1(numero, pin)
}
