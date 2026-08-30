/** Dos capas: el detector nativo de Android (rápido, sin descargar nada)
 *  y zxing como respaldo. El escáner nunca es el único camino: siempre
 *  queda la carga manual, porque hay teléfonos donde ninguna de las dos anda. */

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

export function soportaEscanerNativo(): boolean {
  return typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis
}

export async function escanear(
  video: HTMLVideoElement,
  alLeer: (codigo: string) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
  })
  video.srcObject = stream
  await video.play()

  let activo = true
  const detener = () => {
    activo = false
    for (const pista of stream.getTracks()) pista.stop()
  }

  if (soportaEscanerNativo()) {
    const Detector = (globalThis as unknown as {
      BarcodeDetector: new (opciones: { formats: string[] }) => {
        detect(fuente: HTMLVideoElement): Promise<{ rawValue: string }[]>
      }
    }).BarcodeDetector
    const detector = new Detector({ formats: FORMATOS })

    const buscar = async () => {
      if (!activo) return
      try {
        const [codigo] = await detector.detect(video)
        if (codigo) alLeer(codigo.rawValue)
      } catch {
        // un cuadro ilegible no es un error: se prueba con el siguiente
      }
      if (activo) requestAnimationFrame(buscar)
    }
    requestAnimationFrame(buscar)
    return detener
  }

  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const lector = new BrowserMultiFormatReader()
  const control = await lector.decodeFromVideoElement(video, (resultado) => {
    if (resultado && activo) alLeer(resultado.getText())
  })
  return () => {
    control.stop()
    detener()
  }
}
