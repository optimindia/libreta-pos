"use client";
// ============================================================
// LIBRETA — Home / Punto de venta
// Venta en 3 toques: escaneás → suma al ticket → cobrás.
// Todo local (IndexedDB) → cero dependencia de internet.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { db, registerSale, type Product, type SaleItem } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useBarcodeScanner } from "@/lib/scanner";

const fmt = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

export default function Home() {
  // catálogo vivo (se actualiza solo con Dexie live queries)
  const products = useLiveQuery(() => db.products.toArray(), [], [] as Product[]);
  const [ticket, setTicket] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"venta" | "fiados" | "stats">("venta");
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const scanner = useBarcodeScanner((r) => {
    const p = products.find((x) => x.barcode === r.text);
    if (p) addToTicket(p);
    else setToast(`Código ${r.text} no está en tu catálogo`);
  });

  // --- helpers de ticket ---
  function addToTicket(p: Product, qty = 1) {
    setTicket((t) => {
      const i = t.findIndex((x) => x.productId === p.id!);
      if (i >= 0) {
        const copy = [...t];
        copy[i] = { ...copy[i], qty: copy[i].qty + qty };
        return copy;
      }
      return [...t, { productId: p.id!, barcode: p.barcode, name: p.name, qty, salePrice: p.salePrice, costPrice: p.costPrice }];
    });
  }

  const total = useMemo(() => ticket.reduce((s, i) => s + i.qty * i.salePrice, 0), [ticket]);
  const cost = useMemo(() => ticket.reduce((s, i) => s + i.qty * i.costPrice, 0), [ticket]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 12); // sin búsqueda: los 12 primeros
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q)).slice(0, 30);
  }, [products, search]);

  // --- cobro ---
  async function charge(payment: SaleItem extends never ? never : "efectivo" | "qr" | "transferencia" | "fiado", customerName?: string) {
    if (ticket.length === 0) return;
    if (payment === "fiado" && !customerName?.trim()) {
      setToast("Para fiado necesitás el nombre del cliente");
      return;
    }
    await registerSale(ticket, payment, payment === "fiado" ? { name: customerName!.trim() } : undefined);
    setTicket([]);
    setConfirming(false);
    setToast(payment === "fiado" ? `Fiado anotado para ${customerName} ✍️` : "¡Venta registrada! 🎉");
  }

  // toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-4">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📒</span>
          <h1 className="text-xl font-bold">Libreta</h1>
        </div>
        <nav className="flex gap-1 rounded-full bg-slate-900 p-1 text-sm">
          {(["venta", "fiados", "stats"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 capitalize transition ${view === v ? "bg-fuchsia-600 text-white" : "text-slate-400"}`}
            >
              {v}
            </button>
          ))}
        </nav>
      </header>

      {view === "venta" && (
        <>
          {/* Scanner */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => scanner.setActive(!scanner.active)}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold transition ${scanner.active ? "bg-red-600" : "bg-fuchsia-600"} text-white`}
            >
              {scanner.active ? "✕ Cerrar escáner" : "📷 Escanear"}
            </button>
            <button
              onClick={() => setView("venta")}
              className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-fuchsia-300"
              onClickCapture={() => document.getElementById("nuevo-producto")?.click()}
              style={{ display: "none" }}
            >
              + Producto
            </button>
          </div>
          {scanner.active && (
            <div className="mb-4 overflow-hidden rounded-xl bg-black">
              <video ref={scanner.videoRef} className="h-56 w-full object-cover" playsInline muted />
              {scanner.error && <p className="p-3 text-xs text-red-400">{scanner.error}</p>}
            </div>
          )}

          {/* Búsqueda / catálogo rápido */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o código…"
            className="mb-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm outline-none ring-fuchsia-600 focus:ring-2"
          />

          {/* Catálogo (grid de botones grandes — dedos con guantes también) */}
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToTicket(p)}
                className="rounded-xl bg-slate-900 p-3 text-left active:scale-95"
              >
                <p className="line-clamp-2 text-xs font-medium leading-tight">{p.name}</p>
                <p className="mt-1 text-sm font-bold text-fuchsia-400">{fmt(p.salePrice)}</p>
                <p className="text-[10px] text-slate-500">stock: {p.stock}</p>
              </button>
            ))}
          </div>

          {/* Ticket flotante */}
          {ticket.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md rounded-t-2xl border-t border-slate-800 bg-slate-900/95 p-4 backdrop-blur">
              <div className="mb-2 max-h-32 space-y-1 overflow-y-auto">
                {ticket.map((i) => (
                  <div key={i.productId} className="flex items-center justify-between text-sm">
                    <span className="flex-1 truncate">{i.qty}× {i.name}</span>
                    <span className="font-semibold">{fmt(i.qty * i.salePrice)}</span>
                    <button onClick={() => setTicket((t) => t.filter((x) => x.productId !== i.productId))} className="ml-2 text-slate-500">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                <div>
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-2xl font-extrabold">{fmt(total)}</p>
                </div>
                <button
                  onClick={() => setConfirming(true)}
                  className="rounded-xl bg-fuchsia-600 px-6 py-3 font-bold text-white active:scale-95"
                >
                  Cobrar
                </button>
              </div>
            </div>
          )}

          {/* Modal de cobro */}
          {confirming && (
            <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={() => setConfirming(false)}>
              <div className="mx-auto w-full max-w-md rounded-t-2xl bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
                <p className="mb-1 text-center text-sm text-slate-400">Total a cobrar</p>
                <p className="mb-4 text-center text-4xl font-extrabold">{fmt(total)}</p>
                <p className="mb-2 text-center text-xs text-emerald-400">ganancia estimada: {fmt(total - cost)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => charge("efectivo")} className="rounded-xl bg-emerald-600 py-3 font-semibold">💵 Efectivo</button>
                  <button onClick={() => charge("qr")} className="rounded-xl bg-sky-600 py-3 font-semibold">📱 QR</button>
                  <button onClick={() => charge("transferencia")} className="rounded-xl bg-violet-600 py-3 font-semibold">🏦 Transferencia</button>
                  <button onClick={() => { const n = prompt("¿A quién le fiás?"); if (n) charge("fiado", n); }} className="rounded-xl bg-fuchsia-600 py-3 font-semibold">✍️ Fiado</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {view === "fiados" && <Fiados />}
      {view === "stats" && <Stats />}

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-6 z-40 -translate-x-1/2 rounded-full bg-slate-800 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

// ============================================================
// Vista FIADOS — la libreta de deudas, digital
// ============================================================
function Fiados() {
  const credits = useLiveQuery(() => db.credits.toArray(), [], []);
  const [paying, setPaying] = useState<{ id: number; name: string; remaining: number } | null>(null);
  const open = (credits ?? []).filter((c) => c.status !== "cobrada");
  const totalDue = open.reduce((s, c) => s + c.remaining, 0);

  return (
    <div>
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-rose-600 to-fuchsia-700 p-5">
        <p className="text-sm opacity-80">Te deben en total</p>
        <p className="text-4xl font-extrabold">{fmt(totalDue)}</p>
        <p className="mt-1 text-xs opacity-70">{open.length} deudas abiertas</p>
      </div>

      <div className="space-y-2">
        {open
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((c) => {
            const days = Math.floor((Date.now() - c.createdAt) / 86400000);
            return (
              <div key={c.id} className="rounded-xl bg-slate-900 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{c.customerName}</p>
                  <p className="font-bold text-rose-400">{fmt(c.remaining)}</p>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    hace {days === 0 ? "hoy" : `${days} día${days === 1 ? "" : "s"}`}
                    {c.status === "parcial" && ` · ${fmt(c.amount - c.remaining)} cobrado`}
                  </p>
                  <button onClick={() => setPaying({ id: c.id!, name: c.customerName, remaining: c.remaining })} className="text-xs font-semibold text-emerald-400">
                    Cobrar
                  </button>
                </div>
              </div>
            );
          })}
        {open.length === 0 && <p className="mt-8 text-center text-sm text-slate-500">Sin fiados abiertos. Todo cobrado 🎉</p>}
      </div>

      {paying && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-6" onClick={() => setPaying(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 font-semibold">{paying.name}</p>
            <p className="mb-4 text-2xl font-extrabold text-rose-400">{fmt(paying.remaining)}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => { await registerCreditPayment(paying.id, paying.remaining); setPaying(null); }}
                className="rounded-xl bg-emerald-600 py-3 font-semibold"
              >
                Cobró todo
              </button>
              <button
                onClick={async () => {
                  const v = prompt(`¿Cuánto te pagó ${paying.name}?`);
                  if (v) { await registerCreditPayment(paying.id, Number(v)); setPaying(null); }
                }}
                className="rounded-xl bg-slate-700 py-3 font-semibold"
              >
                Parcial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { registerCreditPayment } from "@/lib/db";

// ============================================================
// Vista STATS — "¿cuánto gané hoy?" (la pregunta sin respuesta)
// ============================================================
function Stats() {
  const sales = useLiveQuery(() => db.sales.toArray(), [], []);
  const [range, setRange] = useState<"hoy" | "mes">("hoy");

  const stats = useMemo(() => {
    const now = new Date();
    const start = range === "hoy" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const inRange = (sales ?? []).filter((s) => s.ts >= start);
    const total = inRange.reduce((s, x) => s + x.total, 0);
    const cost = inRange.reduce((s, x) => s + x.cost, 0);
    const byPayment = inRange.reduce<Record<string, number>>((acc, x) => { acc[x.payment] = (acc[x.payment] ?? 0) + x.total; return acc; }, {});
    // top productos
    const byProduct = inRange.reduce<Record<string, { qty: number; revenue: number }>>((acc, x) => {
      for (const it of x.items) {
        acc[it.name] ??= { qty: 0, revenue: 0 };
        acc[it.name].qty += it.qty;
        acc[it.name].revenue += it.qty * it.salePrice;
      }
      return acc;
    }, {});
    const top = Object.entries(byProduct).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
    return { count: inRange.length, total, profit: total - cost, byPayment, top };
  }, [sales, range]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["hoy", "mes"] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${range === r ? "bg-fuchsia-600" : "bg-slate-900 text-slate-400"}`}>
            {r === "hoy" ? "Hoy" : "Este mes"}
        </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-900 p-4">
          <p className="text-xs text-slate-400">Vendido</p>
          <p className="text-2xl font-bold">{fmt(stats.total)}</p>
          <p className="text-[11px] text-slate-500">{stats.count} ventas</p>
        </div>
        <div className="rounded-2xl bg-emerald-900/40 p-4 ring-1 ring-emerald-700">
          <p className="text-xs text-emerald-300">GANANCIA</p>
          <p className="text-2xl font-bold text-emerald-300">{fmt(stats.profit)}</p>
          <p className="text-[11px] text-emerald-500/70">lo que queda para vos</p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 p-4">
        <p className="mb-2 text-sm font-semibold">Por medio de pago</p>
        <div className="space-y-1 text-sm">
          {Object.entries(stats.byPayment).map(([k, v]) => (
            <div key={k} className="flex justify-between"><span className="capitalize text-slate-400">{k}</span><span>{fmt(v)}</span></div>
          ))}
          {Object.keys(stats.byPayment).length === 0 && <p className="text-slate-500">Sin ventas todavía</p>}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 p-4">
        <p className="mb-2 text-sm font-semibold">Top productos</p>
        <div className="space-y-1 text-sm">
          {stats.top.map(([name, v]) => (
            <div key={name} className="flex justify-between"><span className="truncate text-slate-300">{name}</span><span className="text-slate-400">{v.qty}× · {fmt(v.revenue)}</span></div>
          ))}
          {stats.top.length === 0 && <p className="text-slate-500">Todavía no hay data</p>}
        </div>
      </div>
    </div>
  );
}