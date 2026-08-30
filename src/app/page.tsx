"use client";
// ============================================================
// LIBRETA — Home / Punto de venta
// Venta en 3 toques: escaneás → suma al ticket → cobrás.
// Todo local (IndexedDB) → cero dependencia de internet.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { db, registerSale, seedDemoData, type Product, type SaleItem, type Sale, type Credit } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useBarcodeScanner } from "@/lib/scanner";

const fmt = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const dayStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysAgo = (t: number) => Math.floor((dayStart() - dayStart(t)) / 86400000);

export default function Home() {
  const products = useLiveQuery(() => db.products.toArray(), [], [] as Product[]);
  const [ticket, setTicket] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"venta" | "fiados" | "stats">("venta");
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [fiadoName, setFiadoName] = useState("");
  const [charged, setCharged] = useState<{ total: number; profit: number; payment: string } | null>(null);

  const scanner = useBarcodeScanner((r) => {
    const p = products.find((x) => x.barcode === r.text);
    if (p) addToTicket(p);
    else setToast(`❌ ${r.text} no está en tu catálogo`);
  });

  // Seed demo SOLO la primera vez (si el catálogo está vacío)
  useEffect(() => { void seedDemoData(); }, []);

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
    if (!q) return products.slice(0, 12);
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q)).slice(0, 30);
  }, [products, search]);

  // --- cobro ---
  async function charge(payment: "efectivo" | "qr" | "transferencia" | "fiado") {
    if (ticket.length === 0) return;
    if (payment === "fiado" && !fiadoName.trim()) {
      setToast("Escribí el nombre de quién te fió");
      return;
    }
    const soldTotal = total;
    const soldProfit = total - cost;
    await registerSale(ticket, payment, payment === "fiado" ? { name: fiadoName.trim() } : undefined);
    setTicket([]);
    setConfirming(false);
    setFiadoName("");
    setCharged({ total: soldTotal, profit: soldProfit, payment });
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-40 pt-5">
      {/* ===== Header ===== */}
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-dark to-accent text-lg shadow-lg shadow-brand-dark/40">
            📒
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Libreta</h1>
            <p className="mt-0.5 text-[11px] text-slate-400">tu almacén en tu celu</p>
          </div>
        </div>
        <nav className="flex gap-1 rounded-full glass p-1">
          {(["venta", "fiados", "stats"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`anim-tap rounded-full px-3.5 py-1.5 text-[13px] font-semibold capitalize transition ${
                view === v ? "bg-gradient-to-r from-brand to-accent text-white shadow" : "text-slate-400"
              }`}
            >
              {v}
            </button>
          ))}
        </nav>
      </header>

      {view === "venta" && (
        <div className="anim-slide-up">
          {/* ===== Hero: venta de hoy ===== */}
          <TodayHero />

          {/* ===== Scanner + búsqueda ===== */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => scanner.setActive(!scanner.active)}
              className={`anim-tap flex-1 rounded-2xl py-3.5 text-sm font-bold transition ${
                scanner.active ? "bg-red-600/90" : "bg-gradient-to-r from-brand to-accent text-white shadow-lg shadow-brand/30"
              }`}
            >
              {scanner.active ? "✕ Cerrar escáner" : "📷  Escanear código"}
            </button>
          </div>

          {scanner.active && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black anim-pop">
              <video ref={scanner.videoRef} className="h-60 w-full object-cover" playsInline muted />
              {scanner.error && <p className="p-3 text-xs text-red-400">{scanner.error}</p>}
            </div>
          )}

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍  Buscar producto o código…"
            className="mt-3 w-full rounded-2xl glass px-4 py-3.5 text-sm outline-none placeholder:text-slate-500 focus:border-brand/60"
          />

          {/* ===== Grilla de productos ===== */}
          {filtered.length === 0 ? (
            <p className="mt-10 text-center text-sm text-slate-500">
              {search ? "Nada con esa búsqueda 🤷" : "Cargá productos para empezar a vender"}
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {filtered.map((p) => {
                const out = p.stock <= 0;
                const low = !out && p.stock <= p.minStock;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToTicket(p)}
                    disabled={out}
                    className={`anim-tap group relative overflow-hidden rounded-2xl border p-3 text-left ${
                      out
                        ? "border-white/5 bg-white/[0.02] opacity-50"
                        : "border-white/10 bg-white/[0.04] hover:border-brand/50 active:bg-white/10"
                    }`}
                  >
                    {low && (
                      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" title={`Quedan ${p.stock}`} />
                    )}
                    <p className="line-clamp-2 min-h-[2rem] text-[12px] font-semibold leading-tight text-slate-200">{p.name}</p>
                    <p className="mt-1.5 text-[15px] font-extrabold tnum text-accent">{fmt(p.salePrice)}</p>
                    <p className={`mt-0.5 text-[10px] font-medium ${out ? "text-red-400" : low ? "text-amber-400" : "text-slate-500"}`}>
                      {out ? "SIN STOCK" : `stock: ${p.stock}`}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "fiados" && <Fiados />}
      {view === "stats" && <Stats />}

      {/* ===== Ticket flotante ===== */}
      {ticket.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 anim-slide-up">
          <div className="mx-auto max-w-md rounded-t-3xl border-t border-x border-white/10 bg-slate-950/90 p-4 pt-3 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-600" />
            <div className="no-scrollbar mb-2 max-h-36 space-y-1.5 overflow-y-auto">
              {ticket.map((i) => (
                <div key={i.productId} className="flex items-center gap-2 text-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand/25 text-[11px] font-bold text-brand-light">{i.qty}</span>
                  <span className="flex-1 truncate text-slate-200">{i.name}</span>
                  <span className="tnum font-semibold">{fmt(i.qty * i.salePrice)}</span>
                  <button
                    onClick={() => setTicket((t) => t.filter((x) => x.productId !== i.productId))}
                    className="anim-tap grid h-6 w-6 place-items-center rounded-lg text-slate-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-end justify-between border-t border-white/10 pt-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Total</p>
                <p className="text-[26px] font-black leading-none tnum">{fmt(total)}</p>
              </div>
              <button
                onClick={() => setConfirming(true)}
                className="anim-tap rounded-2xl bg-gradient-to-r from-brand to-accent px-8 py-3.5 font-bold text-white shadow-lg shadow-brand/40"
              >
                Cobrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal de cobro ===== */}
      {confirming && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setConfirming(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-slate-900 p-6 pt-4 anim-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-600" />
            <p className="text-center text-xs uppercase tracking-widest text-slate-400">total a cobrar</p>
            <p className="mt-1 text-center text-[44px] font-black leading-none tnum">{fmt(total)}</p>
            <p className="mt-1.5 text-center text-sm font-semibold text-emerald-400">ganancia: {fmt(total - cost)}</p>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <PayBtn color="from-emerald-500 to-emerald-600" label="💵 Efectivo" onClick={() => charge("efectivo")} />
              <PayBtn color="from-sky-500 to-sky-600" label="📱 QR" onClick={() => charge("qr")} />
              <PayBtn color="from-violet-500 to-violet-600" label="🏦 Transf." onClick={() => charge("transferencia")} />
              <PayBtn color="from-fuchsia-500 to-fuchsia-600" label="✍️  Fiado" onClick={() => {
                const n = fiadoName.trim();
                if (!n) { setToast("Escribí el nombre de quién te fió"); return; }
                charge("fiado");
              }} />
            </div>

            <input
              value={fiadoName}
              onChange={(e) => setFiadoName(e.target.value)}
              placeholder="Nombre para el fiado (opcional, solo si es fiado)"
              className="mt-3 w-full rounded-xl bg-slate-800 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-fuchsia-500/60"
            />
          </div>
        </div>
      )}

      {/* ===== Celebración post-cobro ===== */}
      {charged && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-6 backdrop-blur-sm" onClick={() => setCharged(null)}>
          <div className="w-full max-w-xs rounded-3xl bg-slate-900 p-6 text-center anim-pop">
            <p className="text-5xl">🎉</p>
            <p className="mt-3 text-2xl font-black tnum">{fmt(charged.total)}</p>
            <p className="mt-1 text-sm text-emerald-400 font-semibold">ganancia {fmt(charged.profit)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {charged.payment === "fiado" ? "anotado en la libreta ✍️" : "cobrado, ¡buen negocio! 💪"}
            </p>
            <button onClick={() => setCharged(null)} className="anim-tap mt-5 w-full rounded-2xl bg-gradient-to-r from-brand to-accent py-3.5 font-bold">
              Seguir vendiendo
            </button>
          </div>
          </div>
      )}

      {/* ===== Toast ===== */}
      {toast && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full glass px-5 py-2.5 text-sm font-medium shadow-xl anim-pop">
          {toast}
        </div>
      )}
    </main>
  );
}

// ============================================================
// Sub-componentes
// ============================================================
function PayBtn({ color, label, onClick }: { color: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`anim-tap rounded-2xl bg-gradient-to-r ${color} py-3.5 font-bold text-white shadow-lg`}>
      {label}
    </button>
  );
}

/** Hero del top: cuánto vendiste y ganaste HOY (live) */
function TodayHero() {
  const sales = useLiveQuery(() => db.sales.where("ts").above(dayStart()).toArray(), [], [] as Sale[]);
  const total = sales.reduce((s, x) => s + x.total, 0);
  const profit = sales.reduce((s, x) => s + x.total - x.cost, 0);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark/90 via-brand/80 to-accent/70 p-5 shadow-xl shadow-brand-dark/30">
      <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Hoy vendiste</p>
          <p className="mt-0.5 text-[38px] font-black leading-none tnum text-white">{fmt(total)}</p>
          <p className="mt-1.5 text-sm font-semibold text-emerald-300">
            💚 ganancia {fmt(profit)} · {sales.length} ventas
          </p>
        </div>
        <div className="text-4xl opacity-80">🧉</div>
      </div>
    </div>
  );
}

// ============================================================
// Vista FIADOS — la libreta de deudas, digital
// ============================================================
function Fiados() {
  const credits = useLiveQuery(() => db.credits.toArray(), [], [] as Credit[]);
  const [paying, setPaying] = useState<{ id: number; name: string; remaining: number } | null>(null);
  const open = (credits ?? []).filter((c) => c.status !== "cobrada");
  const totalDue = open.reduce((s, c) => s + c.remaining, 0);

  return (
    <div className="anim-slide-up">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600/90 to-fuchsia-800/80 p-5 shadow-xl">
        <div className="absolute -left-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Te deben en total</p>
        <p className="mt-0.5 text-[38px] font-black leading-none tnum text-white">{fmt(totalDue)}</p>
      <p className="mt-1.5 text-xs text-white/70">{open.length} fiados abiertos</p>
      </div>

      <div className="mt-4 space-y-2.5">
        {open
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((c) => {
            const d = daysAgo(c.createdAt);
            const old = d >= 7;
            return (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{c.customerName}</p>
                  <p className="font-black tnum text-rose-300">{fmt(c.remaining)}</p>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className={`text-xs font-medium ${old ? "text-amber-400" : "text-slate-500"}`}>
                    {d === 0 ? "hoy" : `hace ${d} día${d === 1 ? "" : "s"}`}
                    {c.status === "parcial" && ` · ya te pagó ${fmt(c.amount - c.remaining)}`}
                  </p>
                  <button onClick={() => setPaying({ id: c.id!, name: c.customerName, remaining: c.remaining })} className="anim-tap text-xs font-bold text-emerald-400">
                    Cobrar →
                  </button>
                </div>
              </div>
            );
          })}
        {open.length === 0 && <p className="mt-10 text-center text-sm text-slate-500">Sin fiados abiertos — todo cobrado 🎉</p>}
      </div>

      {paying && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={() => setPaying(null)}>
          <div className="w-full max-w-xs rounded-3xl bg-slate-900 p-6 anim-pop" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">{paying.name}</p>
            <p className="mt-1 text-3xl font-black tnum text-rose-300">{fmt(paying.remaining)}</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                onClick={async () => { await registerCreditPayment(paying.id, paying.remaining); setPaying(null); }}
                className="anim-tap rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 font-bold"
              >
                Cobró todo
              </button>
              <button
                onClick={async () => {
                  const v = prompt(`¿Cuánto te pagó ${paying.name}?`);
                  if (v) { await registerCreditPayment(paying.id, Number(v)); setPaying(null); }
                }}
                className="anim-tap rounded-2xl bg-slate-700 py-3.5 font-bold"
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
// Vista STATS — "¿cuánto gané hoy/mes?" (la pregunta sin respuesta)
// ============================================================
function Stats() {
  const sales = useLiveQuery(() => db.sales.toArray(), [], [] as Sale[]);
  const [range, setRange] = useState<"hoy" | "mes">("hoy");

  const stats = useMemo(() => {
    const now = new Date();
    const start = range === "hoy" ? dayStart() : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const inRange = (sales ?? []).filter((s) => s.ts >= start);
    const total = inRange.reduce((s, x) => s + x.total, 0);
    const cost = inRange.reduce((s, x) => s + x.cost, 0);
    const byPayment = inRange.reduce<Record<string, number>>((acc, x) => { acc[x.payment] = (acc[x.payment] ?? 0) + x.total; return acc; }, {});
    const byProduct = inRange.reduce<Record<string, { qty: number; revenue: number }>>((acc, x) => {
      for (const it of x.items) {
        acc[it.name] ??= { qty: 0, revenue: 0 };
        acc[it.name].qty += it.qty;
        acc[it.name].revenue += it.qty * it.salePrice;
      }
      return acc;
    }, {});
    const top = Object.entries(byProduct).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
    const maxRevenue = top.length ? Math.max(...top.map(([, v]) => v.revenue)) : 1;
    return { count: inRange.length, total, profit: total - cost, byPayment, top, maxRevenue };
  }, [sales, range]);

  return (
    <div className="anim-slide-up space-y-4">
      <div className="flex gap-2">
        {(["hoy", "mes"] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`anim-tap flex-1 rounded-2xl py-2.5 text-sm font-bold ${range === r ? "bg-gradient-to-r from-brand to-accent shadow-lg" : "glass text-slate-400"}`}>
            {r === "hoy" ? "Hoy" : "Este mes"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">Vendido</p>
          <p className="mt-1 text-2xl font-black tnum">{fmt(stats.total)}</p>
          <p className="text-[11px] text-slate-500">{stats.count} ventas</p>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600/25 to-emerald-900/25 p-4 ring-1 ring-emerald-500/40">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">Ganancia</p>
          <p className="mt-1 text-2xl font-black tnum text-emerald-300">{fmt(stats.profit)}</p>
          <p className="text-[11px] text-emerald-500/80">lo que queda para vos</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <p className="mb-3 text-sm font-bold">Por medio de pago</p>
        <div className="space-y-2">
          {Object.entries(stats.byPayment).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="capitalize text-slate-400">{k}</span>
              <span className="font-semibold tnum">{fmt(v)}</span>
            </div>
          ))}
          {Object.keys(stats.byPayment).length === 0 && <p className="text-sm text-slate-500">Sin ventas todavía</p>}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <p className="mb-3 text-sm font-bold">🏆 Top productos</p>
        <div className="space-y-3">
          {stats.top.map(([name, v], i) => (
            <div key={name}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="truncate text-slate-300">{i + 1}. {name}</span>
                <span className="tnum text-slate-400">{v.qty}× · {fmt(v.revenue)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: `${(v.revenue / stats.maxRevenue) * 100}%` }} />
              </div>
            </div>
          ))}
          {stats.top.length === 0 && <p className="text-sm text-slate-500">Todavía no hay data</p>}
        </div>
      </div>
    </div>
  );
}