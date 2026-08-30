"use client";
// ============================================================
// LIBRETA — Hero del top: venta de hoy + te deben (live)
// + alerta de stock bajo. Todo reacciona a IndexedDB en vivo.
// ============================================================
import { db, saleProfit, type Product, type Sale, type Credit } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";

const fmt = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const dayStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function TodayHero() {
  const sales = useLiveQuery(() => db.sales.where("ts").above(dayStart()).toArray(), [], [] as Sale[]);
  const credits = useLiveQuery(() => db.credits.toArray(), [], [] as Credit[]);
  const total = sales.reduce((s, x) => s + x.total, 0);
  const profit = sales.reduce((s, x) => s + saleProfit(x), 0);
  const openCredits = (credits ?? []).filter((c) => c.status !== "cobrada");
  const totalDue = openCredits.reduce((s, c) => s + c.remaining, 0);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark/90 via-brand/80 to-accent/70 p-4 shadow-xl shadow-brand-dark/30">
        <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Hoy vendiste</p>
        <p className="mt-0.5 text-[26px] font-black leading-none tnum text-white">{fmt(total)}</p>
        <p className="mt-1.5 text-[12px] font-semibold text-emerald-300">
          💚 {fmt(profit)} · {sales.length} ventas
        </p>
        <div className="absolute right-3 top-2 text-2xl opacity-80">🧉</div>
      </div>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600/90 to-fuchsia-800/80 p-4 shadow-xl">
        <div className="absolute -left-6 -bottom-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Te deben</p>
        <p className="mt-0.5 text-[26px] font-black leading-none tnum text-white">{fmt(totalDue)}</p>
        <p className="mt-1.5 text-[12px] font-semibold text-white/80">
          {openCredits.length > 0 ? `✍️ ${openCredits.length} fiados` : "todo cobrado 🎉"}
        </p>
        <div className="absolute right-3 top-2 text-2xl opacity-80">💵</div>
      </div>
    </div>
  );
}

/** Alerta de stock bajo: "se te está acabando" — la lista de reposición */
export function StockAlerts() {
  const products = useLiveQuery(() => db.products.toArray(), [], [] as Product[]);
  const low = (products ?? []).filter((p) => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock);
  if (low.length === 0) return null;
  return (
    <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">⚠️ Se te está acabando</p>
      <p className="mt-1.5 line-clamp-2 text-[13px] text-amber-200/90">
        {low.slice(0, 5).map((p) => `${p.name} (${p.stock})`).join(" · ")}
      </p>
    </div>
  );
}