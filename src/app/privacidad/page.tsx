import type { Metadata } from 'next'
import Link from 'next/link'
import { DocumentoLegal, PRESTADOR, Seccion } from '@/ui/legal/DocumentoLegal'

export const metadata: Metadata = {
  title: 'Política de privacidad · Libreta',
  description: 'Qué datos guarda Libreta, para qué, dónde y cómo ejercer tus derechos según la Ley 25.326.',
}

export default function Privacidad() {
  return (
    <DocumentoLegal
      titulo="Política de privacidad"
      bajada="Acá te contamos qué datos guarda Libreta, para qué los usamos, dónde se guardan y qué podés hacer con ellos. Se aplica la Ley 25.326 de Protección de Datos Personales."
      otro={{ href: '/terminos', texto: 'Leer los Términos y condiciones' }}
    >
      <Seccion id="responsable" titulo="1. Quiénes somos">
        <p>
          Libreta es un servicio de {PRESTADOR.razonSocial}, CUIT {PRESTADOR.cuit}, con domicilio en {PRESTADOR.domicilio}. Contacto para temas de datos personales: {PRESTADOR.email}.
        </p>
      </Seccion>

      <Seccion id="que-datos" titulo="2. Qué datos guardamos y para qué">
        <ul>
          <li><strong>Datos de tu cuenta:</strong> teléfono de acceso, PIN (se guarda transformado de forma que nadie, ni nosotros, puede leerlo), nombre del negocio, logo y datos de tus vendedores. Los usamos para que entres a tu cuenta y para identificarte.</li>
          <li><strong>Datos de tu negocio:</strong> productos, precios, stock, ventas, caja, gastos y configuraciones. Los usamos para que funcione el punto de venta y para sincronizar tus aparatos.</li>
          <li><strong>Datos de tus clientes:</strong> nombre, teléfono, deudas de fiado, pagos y pedidos que vos cargás (ver punto 3).</li>
          <li><strong>Datos de la suscripción:</strong> plan, fechas de alta y vencimiento, pagos. Los usamos para habilitar o bloquear el acceso y para comunicarnos con vos.</li>
          <li><strong>Datos técnicos:</strong> registros básicos de acceso y errores que generan nuestros proveedores (por ejemplo, la dirección IP o el tipo de navegador). Los usamos para seguridad y para arreglar problemas.</li>
          <li><strong>Fotos de facturas</strong>, sólo si usás la lectura de facturas por foto (ver punto 4).</li>
        </ul>
        <p>No vendemos tus datos ni los de tus clientes, no los usamos para publicidad y no los compartimos salvo con los proveedores de este listado o si nos lo exige una autoridad con una orden legal.</p>
      </Seccion>

      <Seccion id="tus-clientes" titulo="3. Los datos de tus clientes: vos sos el responsable">
        <p>
          Los datos de las personas que les compran a vos los cargás y decidís vos. Por eso, para la Ley 25.326, <strong>tu comercio es el responsable</strong> de esos datos y <strong>nosotros actuamos como encargado del tratamiento</strong>: los guardamos y procesamos sólo para prestarte Libreta, siguiendo tus instrucciones, sin usarlos para otra cosa y con confidencialidad (art. 25, Ley 25.326).
        </p>
        <ul>
          <li>Avisales a tus clientes que anotás sus datos (por ejemplo, para el fiado o los pedidos) y cargá sólo lo necesario.</li>
          <li>Si un cliente te pide ver, corregir o borrar sus datos, lo podés hacer vos desde la app. Si necesitás ayuda, escribinos.</li>
          <li>Los mensajes por WhatsApp los abrís y mandás vos desde tu aparato; Libreta no los envía sola ni guarda las conversaciones.</li>
          <li>Si un cliente tuyo nos escribe a nosotros, le vamos a pedir que se dirija a tu comercio, y te avisaremos.</li>
        </ul>
      </Seccion>

      <Seccion id="proveedores" titulo="4. Proveedores que nos ayudan a prestar el servicio">
        <ul>
          <li><strong>Supabase</strong>: base de datos en la nube, inicio de sesión y sincronización. Guarda los datos de tu cuenta, tu negocio y tus clientes.</li>
          <li><strong>Vercel</strong>: aloja la aplicación web y procesa las conexiones a Libreta.</li>
          <li><strong>OpenAI</strong>: sólo si usás la lectura de facturas por foto. La imagen de la factura del proveedor se envía para extraer productos, cantidades y precios. No envíes fotos que tengan datos de tus clientes. Según las condiciones de OpenAI para su servicio por API, esos datos no se usan para entrenar sus modelos.</li>
        </ul>
        <p>Estos proveedores tratan los datos sólo para prestarnos su servicio y bajo sus propias obligaciones de seguridad y confidencialidad.</p>
      </Seccion>

      <Seccion id="fuera-de-argentina" titulo="5. Datos guardados fuera de Argentina">
        <p>
          Los servidores de Supabase que usamos están en <strong>Estados Unidos</strong> (región us-east-2), y Vercel y OpenAI también operan desde ese país y otros. Eso implica una transferencia internacional de datos.
          Estados Unidos no está en la lista de países que la Argentina considera con protección adecuada, por eso la hacemos con proveedores que asumen por contrato obligaciones de seguridad y confidencialidad, en los términos del art. 12 de la Ley 25.326 y las normas de la AAIP.
          Al usar Libreta, y al cargar datos de tus clientes, aceptás esta transferencia y te comprometés a informarla a tus clientes.
        </p>
      </Seccion>

      <Seccion id="en-tu-aparato" titulo="6. Datos guardados en tu aparato">
        <p>
          Para que Libreta funcione sin internet, una copia de los datos de tu negocio queda guardada en el celular o la computadora donde la usás (en el almacenamiento del navegador). Esa copia sigue ahí aunque cierres la app.
        </p>
      </Seccion>

      <Seccion id="tus-derechos" titulo="7. Tus derechos y cómo ejercerlos">
        <p>Como titular de tus datos tenés derecho a:</p>
        <ul>
          <li><strong>Acceso:</strong> saber qué datos tuyos tenemos. Te respondemos dentro de los 10 días corridos (art. 14, Ley 25.326). Podés pedirlo gratis cada seis meses, o antes si tenés un interés legítimo.</li>
          <li><strong>Rectificación, actualización y supresión:</strong> corregir o borrar tus datos. Lo hacemos dentro de los 5 días hábiles (art. 16, Ley 25.326).</li>
        </ul>
        <p>
          Para ejercerlos escribinos a {PRESTADOR.email} desde el teléfono o correo de tu cuenta, o mandanos una nota a {PRESTADOR.domicilio}. Podemos pedirte que acredites tu identidad.
          Si sos cliente de un comercio que usa Libreta, dirigite primero a ese comercio.
        </p>
        <p>
          La <strong>Agencia de Acceso a la Información Pública (AAIP)</strong>, como órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales. Más información en argentina.gob.ar/aaip.
        </p>
      </Seccion>

      <Seccion id="conservacion" titulo="8. Conservación y baja">
        <ul>
          <li>Guardamos tus datos mientras tengas la cuenta activa o suspendida.</li>
          <li>Antes de irte podés descargar una copia de tus datos desde Configuración (Respaldo).</li>
          <li>Cuando das de baja la cuenta, o si pasan más de 90 días suspendida sin renovar y después de avisarte, borramos de la nube los datos de tu negocio y de tus clientes dentro de los 30 días siguientes. Las copias de seguridad de nuestros proveedores se eliminan en sus ciclos normales.</li>
          <li>Podemos conservar sólo lo que la ley nos obligue a guardar (por ejemplo, datos de facturación de tu suscripción).</li>
          <li>La copia que queda en tu aparato la borrás vos, eliminando los datos del sitio en el navegador o desinstalando la app.</li>
        </ul>
      </Seccion>

      <Seccion id="seguridad" titulo="9. Seguridad y sus límites">
        <p>
          Protegemos los datos con conexiones cifradas, PIN de acceso y reglas que separan la información de cada comercio para que ningún negocio vea la de otro.
          Ningún sistema es 100% seguro, y hay cosas que dependen de vos:
        </p>
        <ul>
          <li><strong>Si tu celular o computadora queda desbloqueado, quien lo tenga puede ver los datos guardados en el aparato</strong>, incluso sin internet. Usá bloqueo de pantalla y no prestes el aparato con la sesión abierta.</li>
          <li>No compartas tu PIN. Cada vendedor tiene que tener su propio acceso.</li>
          <li>Si perdés un aparato o sospechás un acceso indebido, avisanos para cerrar el acceso.</li>
        </ul>
        <p>Si ocurre un incidente de seguridad que afecte tus datos, te vamos a avisar y te diremos qué hacer.</p>
      </Seccion>

      <Seccion id="menores" titulo="10. Menores de edad">
        <p>Libreta es para comercios. Las cuentas deben estar a nombre de personas mayores de 18 años.</p>
      </Seccion>

      <Seccion id="cambios" titulo="11. Cambios a esta política">
        <p>
          Si cambiamos esta política de forma importante, te avisamos dentro de la app o por WhatsApp antes de que rija. La fecha de arriba indica la última versión.
          También podés leer los <Link href="/terminos">Términos y condiciones</Link>.
        </p>
      </Seccion>
    </DocumentoLegal>
  )
}
