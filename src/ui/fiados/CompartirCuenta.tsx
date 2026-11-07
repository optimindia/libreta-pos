'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { dejarDeCompartir, enlaceDeCuenta, ErrorEnlaceCuenta, urlDeCuenta } from '@/datos/nube/cuentaCliente'
import { nubeActiva } from '@/datos/nube/cliente'
import { enlaceWhatsApp } from '@/dominio/mensajes'
import type { Cliente } from '@/dominio/tipos'
import { Boton, clasesBoton } from '@/ui/sistema/Boton'
import { Hoja } from '@/ui/sistema/Hoja'
import { IconoWhatsApp } from '@/ui/sistema/iconos'
import { usePuede } from '@/ui/sistema/usoRol'

/** El dueño le manda al cliente un link para que vea su cuenta cuando
 *  quiera (sólo lectura). Se puede cortar cuando sea. */
export function CompartirCuenta({ cliente, negocio }: { cliente: Cliente; negocio: string }) {
  const esDueno = usePuede('editarProductos')
  const [abierto, setAbierto] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  if (!esDueno || !nubeActiva()) return null

  async function abrir() {
    setAbierto(true)
    setAviso(null)
    setCopiado(false)
    setTrabajando(true)
    try {
      setUrl(urlDeCuenta(await enlaceDeCuenta(cliente.id), window.location.origin))
    } catch (error) {
      setAviso(error instanceof ErrorEnlaceCuenta ? error.message : 'No se pudo crear el link.')
    } finally {
      setTrabajando(false)
    }
  }

  async function cortar() {
    setTrabajando(true)
    try {
      await dejarDeCompartir(cliente.id)
      setUrl(null)
      setAviso('Listo: el link ya no funciona. Si querés, podés crear uno nuevo.')
    } catch (error) {
      setAviso(error instanceof ErrorEnlaceCuenta ? error.message : 'No se pudo cortar el link.')
    } finally {
      setTrabajando(false)
    }
  }

  async function copiar() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
    } catch {
      setAviso('No se pudo copiar. Mandalo por WhatsApp.')
    }
  }

  const mensaje = url ? `Hola ${cliente.nombre.split(' ')[0]}, acá podés ver tu cuenta de ${negocio} cuando quieras: ${url}` : ''

  return (
    <>
      <Boton variante="secundario" tamano="grande" onClick={() => void abrir()}>Link de su cuenta</Boton>
      {abierto && createPortal(
        <Hoja abierta onCerrar={() => setAbierto(false)} titulo={`Cuenta de ${cliente.nombre}`} ancho="angosto">
          <div className="f-compartir-cuenta">
            <p className="f-hoja-ayuda">Con este link {cliente.nombre.split(' ')[0]} ve cuánto debe y sus últimas compras y pagos. No puede cambiar nada.</p>
            {trabajando && !url && <p className="f-dato" role="status">Preparando el link…</p>}
            {url && (
              <>
                <code className="f-compartir-url">{url.replace(/^https?:\/\//, '')}</code>
                {cliente.telefono && (
                  <a className={clasesBoton('principal')} data-tamano="grande" target="_blank" rel="noreferrer" href={enlaceWhatsApp(cliente.telefono, mensaje)}>
                    <IconoWhatsApp /> Mandar por WhatsApp
                  </a>
                )}
                <Boton variante="secundario" onClick={() => void copiar()}>{copiado ? 'Copiado' : 'Copiar link'}</Boton>
                <button type="button" className="f-compartir-cortar" disabled={trabajando} onClick={() => void cortar()}>Dejar de compartir</button>
              </>
            )}
            {aviso && <p className="f-aviso" data-tono="ambar" role="status">{aviso}</p>}
          </div>
        </Hoja>,
        document.body,
      )}
    </>
  )
}
