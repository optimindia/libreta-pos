import type { Metadata } from 'next'
import Link from 'next/link'
import { DocumentoLegal, PRESTADOR, Seccion } from '@/ui/legal/DocumentoLegal'

export const metadata: Metadata = {
  title: 'Términos y condiciones · Libreta',
  description: 'Las reglas para usar Libreta, el punto de venta por suscripción para comercios de barrio.',
}

export default function Terminos() {
  return (
    <DocumentoLegal
      titulo="Términos y condiciones"
      bajada="Estas son las reglas para usar Libreta. Las escribimos lo más claro que pudimos. Si usás Libreta, aceptás estos términos y la Política de privacidad."
      otro={{ href: '/privacidad', texto: 'Leer la Política de privacidad' }}
    >
      <Seccion id="quien" titulo="1. Quién presta el servicio">
        <p>
          Libreta es un servicio de {PRESTADOR.razonSocial}, CUIT {PRESTADOR.cuit}, con domicilio en {PRESTADOR.domicilio} (en adelante, “nosotros” o “el prestador”).
          Para cualquier consulta, reclamo o pedido podés escribirnos a {PRESTADOR.email} o por WhatsApp al {PRESTADOR.whatsapp}.
        </p>
        <p>
          “Vos” o “el comercio” es la persona o empresa que contrata Libreta para su negocio, incluidas las personas a las que les des acceso (por ejemplo, tus vendedores).
        </p>
      </Seccion>

      <Seccion id="que-es" titulo="2. Qué es Libreta">
        <p>
          Libreta es un punto de venta para almacenes, kioscos y comercios de barrio. Sirve para vender, llevar el stock, la caja, los fiados, los pedidos y la lista de clientes.
          Funciona en el celular y en la computadora, también sin internet: los datos se guardan en el aparato y se sincronizan con la nube cuando vuelve la señal.
        </p>
        <p>
          Algunas funciones son opcionales, como leer facturas de proveedores con una foto o abrir WhatsApp para mandarle un mensaje a un cliente. Los mensajes los mandás vos desde tu aparato: Libreta no los envía sola.
        </p>
      </Seccion>

      <Seccion id="cuenta" titulo="3. Tu cuenta, tu teléfono y tu PIN">
        <ul>
          <li>Entrás con un número de teléfono y un PIN. Son personales: no los compartas y cuidá que nadie los vea.</li>
          <li>Si das acceso a vendedores, sos responsable de lo que hagan con ese acceso. Podés pedirnos que lo demos de baja cuando quieras.</li>
          <li>Si creés que alguien conoce tu PIN o entró sin permiso, avisanos enseguida para cambiarlo.</li>
          <li>Los datos que cargás tienen que ser verdaderos y tenés que tener derecho a usarlos.</li>
        </ul>
      </Seccion>

      <Seccion id="suscripcion" titulo="4. Suscripción y precio">
        <p>
          Libreta se paga por suscripción mensual. El precio y la forma de pago te los informamos antes de contratar y figuran en la pantalla Cuenta.
          Hoy el cobro es manual: nos pagás por el medio que acordemos y nosotros extendemos el vencimiento de tu cuenta.
        </p>
        <p>
          Si cambiamos el precio te avisamos con al menos 30 días de anticipación. Si no estás de acuerdo, podés dar de baja la suscripción antes de que empiece a regir el nuevo precio.
        </p>
      </Seccion>

      <Seccion id="prueba" titulo="5. Período de prueba">
        <p>
          Podemos ofrecerte un período de prueba gratis. Te avisamos cuántos días dura y la fecha de fin aparece en la pantalla Cuenta.
          Al terminar, la prueba no se cobra sola: para seguir usando Libreta tenés que contratar la suscripción.
        </p>
      </Seccion>

      <Seccion id="falta-de-pago" titulo="6. Vencimiento, falta de pago y suspensión">
        <ul>
          <li>Unos días antes del vencimiento, Libreta te muestra un aviso para que renueves.</li>
          <li>Si la suscripción vence sin pago, el acceso a las pantallas de venta y gestión se bloquea hasta que renueves. La pantalla Cuenta sigue disponible para que veas el estado y puedas renovar.</li>
          <li>Durante la suspensión no borramos tus datos. Si pasan más de 90 días sin renovar, te avisaremos antes de eliminarlos (ver “Baja”).</li>
          <li>También podemos suspender una cuenta si se usa para algo ilegal, para dañar el servicio o a otras personas, o si se incumplen estos términos. Salvo urgencia, te avisamos antes.</li>
        </ul>
      </Seccion>

      <Seccion id="baja" titulo="7. Baja y arrepentimiento">
        <p>
          Podés dar de baja la suscripción cuando quieras, por el mismo medio por el que la contrataste (WhatsApp o {PRESTADOR.email}). La baja rige al final del período ya pagado y no se cobran meses siguientes.
        </p>
        <p>
          Si contrataste a distancia y la ley te considera consumidor, tenés 10 días corridos desde que contrataste para arrepentirte sin dar motivos ni pagar nada (art. 34, Ley 24.240).
        </p>
        <p>
          Antes de irte podés descargar una copia de tus datos desde Configuración (Respaldo). Después de la baja borramos tus datos de la nube como explica la <Link href="/privacidad">Política de privacidad</Link>.
        </p>
      </Seccion>

      <Seccion id="factura" titulo="8. El ticket no es una factura">
        <p>
          Los tickets, comprobantes y resúmenes que genera Libreta son para tu control interno y el de tus clientes. <strong>No son facturas ni comprobantes fiscales</strong> y no reemplazan la facturación que te exige ARCA (ex AFIP) u otro organismo.
          Cumplir con tus obligaciones impositivas, de precios y de defensa del consumidor frente a tus clientes es responsabilidad tuya.
        </p>
      </Seccion>

      <Seccion id="datos-de-clientes" titulo="9. Los datos de tus clientes">
        <p>
          Los datos de tus clientes (nombre, teléfono, fiados, pedidos) los cargás vos y son de tu comercio. Vos sos el responsable de esos datos ante tus clientes y ante la ley; nosotros sólo los guardamos y procesamos para prestarte el servicio, por tu cuenta y siguiendo tus instrucciones.
          Tenés que avisarles a tus clientes que anotás sus datos y para qué, y atender sus pedidos de acceso, corrección o borrado. Los detalles están en la <Link href="/privacidad">Política de privacidad</Link>.
        </p>
      </Seccion>

      <Seccion id="uso" titulo="10. Uso permitido">
        <p>No podés usar Libreta para:</p>
        <ul>
          <li>vender productos o servicios prohibidos, o registrar operaciones falsas;</li>
          <li>intentar entrar a cuentas de otros comercios, copiar el sistema o atacar el servicio;</li>
          <li>cargar datos de personas sin derecho a hacerlo, o mandarles mensajes que no pidieron.</li>
        </ul>
      </Seccion>

      <Seccion id="disponibilidad" titulo="11. Disponibilidad del servicio">
        <p>
          Trabajamos para que Libreta funcione siempre, pero puede haber cortes por mantenimiento, fallas de internet o de nuestros proveedores. Para eso Libreta sigue andando sin conexión y sincroniza después.
          Podemos mejorar, cambiar o quitar funciones; si quitamos una función importante que estás pagando, te avisamos con tiempo.
        </p>
        <p>
          La lectura de facturas por foto usa inteligencia artificial y puede equivocarse: revisá siempre los productos, cantidades y precios antes de guardarlos.
        </p>
      </Seccion>

      <Seccion id="responsabilidad" titulo="12. Limitación de responsabilidad">
        <ul>
          <li>Libreta es una herramienta de ayuda: las decisiones sobre precios, stock, fiados y caja las tomás vos.</li>
          <li>No respondemos por pérdidas causadas por un uso indebido de tu cuenta, por compartir el PIN, por dejar el aparato desbloqueado al alcance de otros, por borrar la app o los datos del navegador antes de que se sincronicen, ni por fallas de tu aparato o tu conexión.</li>
          <li>Tampoco respondemos por ganancias que dejaste de tener ni por daños indirectos.</li>
          <li>Salvo dolo o culpa grave de nuestra parte, nuestra responsabilidad total frente a vos se limita a lo que pagaste por la suscripción en los últimos 12 meses.</li>
          <li>Nada de esto limita los derechos que te da la Ley 24.240 de Defensa del Consumidor cuando corresponda aplicarla.</li>
        </ul>
      </Seccion>

      <Seccion id="propiedad" titulo="13. Propiedad intelectual">
        <p>
          El software, la marca y el diseño de Libreta son nuestros. Te damos permiso para usarlos mientras tengas la suscripción vigente. Tus datos siguen siendo tuyos.
        </p>
      </Seccion>

      <Seccion id="cambios" titulo="14. Cambios a estos términos">
        <p>
          Podemos actualizar estos términos. Si el cambio es importante, te avisamos dentro de la app o por WhatsApp con al menos 30 días de anticipación. Si seguís usando Libreta después de esa fecha, se entiende que aceptás los nuevos términos; si no estás de acuerdo, podés dar de baja la suscripción.
        </p>
      </Seccion>

      <Seccion id="ley" titulo="15. Ley aplicable y jurisdicción">
        <p>
          Estos términos se rigen por las leyes de la República Argentina. Cualquier conflicto se resolverá ante los tribunales ordinarios de {PRESTADOR.jurisdiccion}, salvo que seas consumidor: en ese caso podés reclamar ante los tribunales de tu domicilio, como prevé la Ley 24.240.
          También podés hacer un reclamo ante la oficina de Defensa del Consumidor de tu localidad o en la Ventanilla Única Federal (argentina.gob.ar/produccion/defensadelconsumidor).
        </p>
      </Seccion>
    </DocumentoLegal>
  )
}
