const { chromium } = require('playwright')
const ancho = Number(process.argv[2] || 1440), alto = Number(process.argv[3] || 900)
const rutas = (process.argv[4] || '/vender,/fiados,/stock,/plata,/pedidos,/clientes,/historial,/operacion,/config,/cuenta').split(',')
;(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const p = await b.newPage({ viewport: { width: ancho, height: alto } })
  await p.goto('http://localhost:3111/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
  await p.evaluate(async () => {
    const db = await new Promise((ok) => { const r = indexedDB.open('libreta'); r.onsuccess = () => ok(r.result) })
    const hoy = new Date(); const a = (d, h, m = 0) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - d, h, m).getTime()
    const P = [
      ['p1', 'Yerba Playadito 1kg', 300000, 420000, 12, 3, 'Almacén'], ['p2', 'Fideos Matarazzo', 80000, 148000, 1, 6, 'Almacén'],
      ['p3', 'Coca-Cola 2,25L', 180000, 290000, 2, 6, 'Bebidas'], ['p4', 'Pan lactal Bimbo', 150000, 230000, 8, 3, 'Panadería'],
      ['p5', 'Leche La Serenísima', 90000, 140000, 20, 6, 'Lácteos'], ['p6', 'Galletitas Oreo', 70000, 120000, 15, 4, 'Almacén'],
      ['p7', 'Aceite Natura 1,5L', 250000, 380000, 0, 2, 'Almacén'], ['p8', 'Arroz Gallo 1kg', 110000, 175000, 9, 3, 'Almacén'],
      ['p9', 'Agua Villavicencio 2L', 60000, 110000, 24, 6, 'Bebidas'], ['p10', 'Queso cremoso x kg', 600000, 950000, 5, 2, 'Lácteos'],
      ['p11', 'Jabón Ala 800g', 200000, 320000, 7, 2, 'Limpieza'], ['p12', 'Papel higiénico x4', 150000, 260000, 10, 3, 'Limpieza'],
    ].map(([id, nombre, costo, precio, stock, stockMinimo, categoria]) => ({ id, codigoBarras: null, nombre, costo, precio, stock, stockMinimo, categoria, actualizadoEn: 1 }))
    const V = []
    let n = 0
    for (let d = 0; d < 6; d++) for (const [h, medio, pid, cant] of [[8, 'efectivo', 'p5', 2], [10, 'qr', 'p1', 1], [11, 'efectivo', 'p6', 3], [13, 'transferencia', 'p3', 2], [17, 'fiado', 'p8', 1], [19, 'efectivo', 'p10', 1]]) {
      const pr = P.find((x) => x.id === pid)
      V.push({ id: 'v' + n++, fecha: a(d, h, 10 + d), total: pr.precio * cant, medioPago: medio, items: [{ productoId: pid, nombre: pr.nombre, cantidad: cant, precio: pr.precio, costo: pr.costo }], clienteId: medio === 'fiado' ? 'c1' : null, estado: 'completada', estadoCobro: 'confirmado' })
    }
    const tx = db.transaction(['productos', 'ventas', 'negocio', 'clientes', 'fiados'], 'readwrite')
    P.forEach((x) => tx.objectStore('productos').put(x)); V.forEach((x) => tx.objectStore('ventas').put(x))
    tx.objectStore('negocio').put({ id: 'unico', nombre: 'Almacén Rosales', logo: null, color: null, negocioId: 'n-1', usuarioId: 'u-1', rol: 'dueno' })
    ;[['c1', 'Doña Rosa'], ['c2', 'Raúl Gómez'], ['c3', 'Marta (vecina)']].forEach(([id, nombre]) => tx.objectStore('clientes').put({ id, nombre, telefono: '2615551234' }))
    tx.objectStore('fiados').put({ id: 'f1', clienteId: 'c1', ventaId: null, monto: 2130000, fecha: Date.now() - 20 * 864e5, vence: Date.now() - 5 * 864e5 })
    tx.objectStore('fiados').put({ id: 'f2', clienteId: 'c2', ventaId: null, monto: 540000, fecha: Date.now() - 3 * 864e5, vence: Date.now() + 5 * 864e5 })
    await new Promise((ok) => { tx.oncomplete = ok })
    try { localStorage.setItem('libreta.guiaOculta.n-1', '1') } catch {}
  })
  for (const ruta of rutas) {
    await p.goto('http://localhost:3111' + ruta, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
    await p.screenshot({ path: `/tmp/claude-0/pag-${ancho}${ruta.replace(/\//g, '-')}.png`, fullPage: false })
  }
  await b.close()
})()
