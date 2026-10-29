import axe from 'axe-core'

/** Corre axe-core (WCAG 2.0/2.1/2.2 A y AA) sobre un nodo y devuelve las
 *  violaciones en texto legible. El contraste no se puede medir en jsdom (no
 *  hay layout ni CSS): lo cubre tests/estilos/accesibilidad-contraste.test.ts
 *  con los tokens reales. */
export async function violacionesAxe(nodo: Element = document.body): Promise<string[]> {
  const resultado = await axe.run(nodo, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    rules: {
      'color-contrast': { enabled: false },
      // jsdom no calcula tamaños: el objetivo táctil se verifica sobre el CSS.
      'target-size': { enabled: false },
      // Cada pantalla se prueba suelta, sin el <main> de ControlAcceso.
      region: { enabled: false },
      'page-has-heading-one': { enabled: false },
      'landmark-one-main': { enabled: false },
    },
  })
  return resultado.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`)
}
