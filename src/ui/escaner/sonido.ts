/** El "pi" de la caja: un tono cortito al leer un código y otro más grave
 *  cuando no lo conocemos. Se genera con Web Audio (sin archivos), y si el
 *  navegador no deja o el aparato está en silencio, no pasa nada. */

let contexto: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Constructor) return null
  contexto ??= new Constructor()
  if (contexto.state === 'suspended') void contexto.resume().catch(() => undefined)
  return contexto
}

function tono(frecuencia: number, desde: number, duracion: number) {
  const ctx = audio()
  if (!ctx) return
  const oscilador = ctx.createOscillator()
  const volumen = ctx.createGain()
  oscilador.type = 'sine'
  oscilador.frequency.value = frecuencia
  const inicio = ctx.currentTime + desde
  volumen.gain.setValueAtTime(0.0001, inicio)
  volumen.gain.exponentialRampToValueAtTime(0.25, inicio + 0.01)
  volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion)
  oscilador.connect(volumen).connect(ctx.destination)
  oscilador.start(inicio)
  oscilador.stop(inicio + duracion + 0.02)
}

export type ResultadoLectura = 'ok' | 'falta'

/** Suena y vibra según lo que pasó con el código leído. */
export function avisarLectura(resultado: ResultadoLectura) {
  try {
    if (resultado === 'ok') {
      tono(1760, 0, 0.09)
      navigator.vibrate?.(40)
    } else {
      tono(392, 0, 0.12)
      tono(294, 0.14, 0.18)
      navigator.vibrate?.([60, 40, 60])
    }
  } catch {
    // sin sonido no se rompe nada: la pantalla igual avisa
  }
}
