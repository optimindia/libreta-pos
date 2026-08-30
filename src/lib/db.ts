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
    this.version(1).stores({
      // id no se indexa: es la keyPath primaria implícita
      products: "++id, &barcode, name, stock",
      sales: "++id, ts, payment, customerId",
      customers: "++id, &name",
      credits: "++id, customerId, status, dueDate, createdAt",
      creditPayments: "++id, creditId, ts",
      stockMovements: "++id, productId, type, ts",
    });
  }
}

// Singleton: una sola conexión a IndexedDB por pestaña
export const db = new LibretaDB();

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