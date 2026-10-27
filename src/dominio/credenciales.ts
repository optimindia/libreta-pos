export interface Credenciales {
  email: string
  password: string
}

const DOMINIO = 'libreta.app'
const SAL = 'libreta-v1'

export function telefonoNormalizado(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '')
  return digitos.startsWith('54') ? digitos : `54${digitos}`
}

export function credencialesDesdeTelefono(telefono: string, pin: string): Credenciales {
  const numero = telefonoNormalizado(telefono)
  return {
    email: `${numero}@${DOMINIO}`,
    password: `${SAL}:${numero}:${pin}`,
  }
}

const PIN_OBVIOS = new Set([
  '000000', '111111', '222222', '333333', '444444',
  '555555', '666666', '777777', '888888', '999999',
])

export function validarPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return false
  return !PIN_OBVIOS.has(pin)
}
