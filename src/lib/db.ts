// ============================================================
// LIBRETA — Base de datos local (Dexie/IndexedDB)
// Fuente de verdad OFFLINE: todo funciona sin internet.
// Sync con Supabase: fase posterior (el MVP nace offline-first).
// ============================================================
import Dexie, { type Table } from "dexie";

export interface Product {
  id?: number; // auto-incremental local
  barcode: string; // "" si no tiene
  name: string;
  costPrice: number; // costo mayorista (para calcular ganancia)
  salePrice: number;
  stock: number;
  minStock: number; // umbral de alerta "se te acaba"
  unit: "un" | "kg" | "lt" | "pack";
  createdAt: number;
}

export interface SaleItem {
  productId: number;
  barcode: string;
  name: string; // snapshot del nombre (aunque el producto cambie después)
  qty: number;
  salePrice: number;
  costPrice: number; // para ganancia estimada
}

export interface Sale {
  id?: number;
  ts: number; // Date.now()
  items: SaleItem[];
  total: number;
  cost: number; // costo total (ganancia = total - cost)
  payment: "efectivo" | "qr" | "transferencia" | "fiado";
  customerName?: string; // si es fiado
  customerId?: number;
}

export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  createdAt: number;
}

export interface Credit {
  id?: number;
  customerId?: number;
  customerName: string; // snapshot (para no perder el nombre si borran el cliente)
  amount: number; // monto total de la deuda
  remaining: number; // lo que queda por cobrar
  createdAt: number;
  dueDate?: number; // fecha comprometida de pago
  status: "abierta" | "cobrada" | "parcial";
  note?: string;
}

export interface CreditPayment {
  id?: number;
  creditId: number;
  amount: number;
  ts: number;
}

// Movimientos de inventario: entradas (compra mayorista) y salidas (venta/rotura)
export interface StockMovement {
  id?: number;
  productId: number;
  type: "entrada" | "venta" | "ajuste" | "perdida";
  qty: number; // siempre positivo
  ts: number;
  note?: string;
}

class LibretaDB extends Dexie {
  products!: Table<Product, number>;
  sales!: Table<Sale, number>;
  customers!: Table<Customer, number>;
  credits!: Table<Credit, number>;
  creditPayments!: Table<CreditPayment, number>;
  stockMovements!: Table<StockMovement, number>;

  constructor() {
    super("libreta");
    // v1: barcode único. v2: barcode NO único (productos sin código comparten "")
    this.version(1).stores({
      products: "++id, &barcode, name, stock",
      sales: "++id, ts, payment, customerId",
      customers: "++id, &name",
      credits: "++id, customerId, status, dueDate, createdAt",
      creditPayments: "++id, creditId, ts",
      stockMovements: "++id, productId, type, ts",
    });
    this.version(2).stores({
      products: "++id, barcode, name, stock",
    });
  }
}

// Singleton: una sola conexión a IndexedDB por pestaña
export const db = new LibretaDB();

// ---------- Seed demo: para probar sin cargar nada ----------
/** Carga 20 productos de almacén real + ventas historicas + 1 fiado.
 *  Solo corre si el catálogo está VACÍO (no pisa datos reales). */
export async function seedDemoData() {
  if ((await db.products.count()) > 0) return false;
  const now = Date.now();
  const p = (barcode: string, name: string, costPrice: number, salePrice: number, stock: number): Omit<Product, "id"> =>
    ({ barcode, name, costPrice, salePrice, stock, minStock: 3, unit: "un", createdAt: now });

  const prods: Omit<Product, "id">[] = [
    p("7790070412008", "Yerba Playadito 1kg", 1800, 2500, 8),
    p("7790895000318", "Coca Cola 2.25L", 2100, 2900, 12),
    p("7790070418103", "Coca Cola 500ml", 900, 1400, 24),
    p("7790070400099", "Fanta 2L", 1800, 2600, 6),
    p("7791009001002", "Pan lactal grande", 800, 1300, 10),
    p("7791009001003", "Facturas x6 (pedidas)", 600, 1200, 4),
    p("", "Azúcar 1kg", 900, 1300, 15),
    p("", "Leche entera 1L", 1000, 1450, 20),
    p("", "Fideos guiseros 500g", 750, 1100, 18),
    p("", "Arroz 1kg", 950, 1400, 12),
    p("", "Aceite girasol 900ml", 1900, 2600, 9),
    p("", "Sal fina 500g", 400, 700, 14),
    p("", "Yogur entero 1L", 1100, 1600, 8),
    p("", "Café 500g", 3200, 4200, 5),
    p("", "Galletitas criollas", 900, 1400, 11),
    p("", "Dulce de leche 500g", 1500, 2100, 7),
    p("", "Mermelada durazno 454g", 1100, 1700, 6),
    p("", "Papel higiénico x4", 1300, 1900, 10),
    p("", "Detergente 750ml", 1000, 1500, 9),
    p("", "Cerveza Andes 1L", 1500, 2300, 18),
  ];
  const ids = await db.products.bulkAdd(prods, { allKeys: true });

  const mkItem = (idx: number, qty: number): SaleItem => {
    const pr = prods[idx];
    return { productId: ids[idx] as number, barcode: pr.barcode, name: pr.name, qty, salePrice: pr.salePrice, costPrice: pr.costPrice };
  };
  const mkSale = (items: SaleItem[], payment: Sale["payment"], ts: number, customerName?: string): Omit<Sale, "id"> => ({
    ts, items, payment, customerName,
    total: items.reduce((s, i) => s + i.qty * i.salePrice, 0),
    cost: items.reduce((s, i) => s + i.qty * i.costPrice, 0),
  });

  const s1 = mkSale([mkItem(1, 2), mkItem(3, 1)], "efectivo", now - 3 * 3600000);        // hoy: 2 Coca + Fanta
  const s2 = mkSale([mkItem(0, 1), mkItem(7, 2)], "qr", now - 1 * 3600000);              // hoy: yerba + leche
  const s3 = mkSale([mkItem(2, 1), mkItem(14, 1)], "efectivo", now - 26 * 3600000);      // ayer
  const fiadoItems = [mkItem(19, 2), mkItem(9, 1), mkItem(11, 2)];                       // Andes, arroz, yogur
  const s4 = mkSale(fiadoItems, "fiado", now - 5 * 86400000, "Doña Rosa");               // fiado hace 5 días

  await db.sales.bulkAdd([s1, s2, s3, s4]);
  const fiadoTotal = s4.total;
  await db.credits.add({
    customerName: "Doña Rosa", amount: fiadoTotal, remaining: fiadoTotal,
    createdAt: s4.ts, status: "abierta", note: "Castilla y González",
  });
  return true;
}

// ---------- Helpers de negocio (usados por UI y stats) ----------

/** Venta en 3 toques: descuenta stock y registra todo */
export async function registerSale(items: SaleItem[], payment: Sale["payment"], customer?: { id?: number; name: string }) {
  const now = Date.now();
  const total = items.reduce((s, i) => s + i.qty * i.salePrice, 0);
  const cost = items.reduce((s, i) => s + i.qty * i.costPrice, 0);

  const saleId = await db.transaction("rw", db.products, db.sales, db.credits, db.stockMovements, async () => {
    // 1. descontar stock de cada producto
    for (const it of items) {
      const p = await db.products.get(it.productId);
      if (p) {
        p.stock -= it.qty;
        await db.products.put(p);
        await db.stockMovements.add({
          productId: it.productId, type: "venta", qty: it.qty, ts: now,
        });
      }
    }
    // 2. registrar la venta
    const id = await db.sales.add({
      ts: now, items, total, cost, payment,
      customerName: customer?.name, customerId: customer?.id,
    });
    // 3. si es fiado → crear deuda
    if (payment === "fiado" && customer) {
      await db.credits.add({
        customerId: customer.id, customerName: customer.name,
        amount: total, remaining: total, createdAt: now, status: "abierta",
      });
    }
    return id;
  });
  return saleId;
}

/** Registrar cobro parcial o total de una deuda */
export async function registerCreditPayment(creditId: number, amount: number) {
  await db.transaction("rw", db.credits, db.creditPayments, async () => {
    const c = await db.credits.get(creditId);
    if (!c) throw new Error("Deuda inexistente");
    const pay = Math.min(amount, c.remaining);
    c.remaining -= pay;
    c.status = c.remaining <= 0 ? "cobrada" : "parcial";
    await db.credits.put(c);
    await db.creditPayments.add({ creditId, amount: pay, ts: Date.now() });
  });
}

/** Ganancia = ventas - costo de lo vendido (el número que el almacenero NO conoce) */
export function saleProfit(s: Sale) {
  return s.total - s.cost;
}