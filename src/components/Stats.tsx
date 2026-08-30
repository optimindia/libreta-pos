"use client";
// ============================================================
// LIBRETA — Stats: "¿cuánto gané hoy?" — la pregunta que
// ningún POS gratis contesta. Barras, top productos, pagos.
// ============================================================
import { useMemo, useState } from "react";
import { db, saleProfit, type Sale } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { haptic } from "@/lib/juice";

const fmt = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const dayStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function Stats() {
  const sales = useLiveQuery(() => db.sales.toArray(), [], [] as Sale[]);
  const [range, setRange] = useState<"hoy" | "mes">("hoy");

  const stats = useMemo(() => {
    const now = new Date();
    const start = range === "hoy" ? dayStart() : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const inRange = (sales ?? []).filter((s) => s.ts >= start);
    const total = inRange.reduce((s, x) => s + x.total, 0);
    const profit = inRange.reduce((s, x) => s + saleProfit(x), 0);
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
    return { count: inRange.length, total, profit, byPayment, top, maxRevenue };
  }, [sales, range]);

  return (
    <div className="anim-slide-up space-y-4">
      <div className="flex gap-2">
        {(["hoy", "mes"] as const).map((r) => (
          <button key={r} onClick={() => { setRange(r); haptic(); }} className={`haptic flex-1 rounded-2xl py-2.5 text-sm font-bold ${range === r ? "bg-gradient-to-r from-brand to-accent shadow-lg" : "glass text-slate-400"}`}>
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