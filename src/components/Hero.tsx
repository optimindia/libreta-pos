"use client";
// ============================================================
// LIBRETA — Hero LUXE: los dos números que mandan.
// "Hoy vendiste" y "Te deben" — con ganancia en verde,
// separados por hairline vertical, cero decoración ruidosa.
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
  const totalDue = openCredits.reduce((s, c) => s + c_remaining_safe(c), 0);

  return (
    <section className="grid grid-cols-[1fr_auto_1fr] items-center py-7">
      {/* Hoy vendiste */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink3">Hoy vendiste</p>
        <p className="mt-0.5 text-[38px] font-semibold leading-[1.1] tracking-tight tnum">{fmt(total)}</p>
        <p className="mt-0.5 text-[13px] text-slate-400">
          ganancia <b className="font-semibold text-pos">{fmt(profit)}</b> · {sales.length} ventas
        </p>
      </div>
      <div className="mx-4 h-16 w-px bg-white/[0.07]" />
      {/* Te deben */}
      <div className="text-right">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink3">Te deben</p>
        <p className="mt-0.5 text-[38px] font-semibold leading-[1.1] tracking-tight tnum">{fmt(totalDue)}</p>
        <p className="mt-0.5 text-[13px] text-slate-400">
          {openCredits.length > 0 ? (
            <><b className="font-semibold text-gold">{openCredits.length} fiados</b> abiertos</>
          ) : (
            "todo cobrado ✓"
          )}
        </p>
      </div>
    </section>
  );
}

/** remaining seguro (por si un credit viejo no lo tiene) */
function c_remaining_safe(c: Credit) { return c.remaining ?? c.amount; }

/** Alerta de stock bajo: "se te está acabando" — lista de reposición */
export function StockAlerts() {
  const products = useLiveQuery(() => db.products.toArray(), [], [] as Product[]);
  const low = (products ?? []).filter((p) => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock);
  if (low.length === 0) return null;
  return (
    <div className="hairline mb-4 rounded-2xl bg-neg/[0.08] p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neg">⚠ Se te está acabando</p>
      <p className="mt-1.5 line-clamp-2 text-[13px] text-slate-400">
        {low.slice(0, 5).map((p) => `${p.name} (${p.stock})`).join(" · ")}
      </p>
    </div>
  );
}