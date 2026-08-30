"use client";
// ============================================================
// LIBRETA — Fiados: la libreta de papel, pero digital.
// Textura de renglones + margen rojo + deudas tachadas a mano.
// ============================================================
import { useState } from "react";
import { db, registerCreditPayment, type Credit } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { haptic, celebrateCash } from "@/lib/juice";

const fmt = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const dayStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysAgo = (t: number) => Math.floor((dayStart() - dayStart(t)) / 86400000);

export function Fiados() {
  const credits = useLiveQuery(() => db.credits.toArray(), [], [] as Credit[]);
  const [paying, setPaying] = useState<{ id: number; name: string; remaining: number } | null>(null);
  const open = (credits ?? []).filter((c) => c.status !== "cobrada");
  const cobradas = (credits ?? []).filter((c) => c.status === "cobrada");
  const totalDue = open.reduce((s, c) => s + c.remaining, 0);

  return (
    <div className="anim-slide-up">
      {/* Resumen */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600/90 to-fuchsia-800/80 p-5 shadow-xl">
        <div className="absolute -left-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Te deben en total</p>
        <p className="mt-0.5 text-[38px] font-black leading-none tnum text-white">{fmt(totalDue)}</p>
        <p className="mt-1.5 text-xs text-white/70">{open.length} fiados abiertos</p>
      </div>

      {/* La LIBRETA de verdad — papel rayado */}
      <div className="libreta-paper mt-4 rounded-3xl p-5 pb-6 shadow-2xl">
        <p className="mb-2 text-sm font-bold">📝 Fiados abiertos</p>
        <div>
          {open.sort((a, b) => b.createdAt - a.createdAt).map((c) => {
            const d = daysAgo(c.createdAt);
            return (
              <div key={c.id} className="flex items-center justify-between border-b border-slate-400/20 py-2.5" style={{ minHeight: "2rem" }}>
                <div className="pl-14">
                  <p className="text-[15px] font-bold leading-tight">{c.customerName}</p>
                  <p className="text-[11px] opacity-60">
                    {d === 0 ? "hoy" : `hace ${d} días`}
                    {c.status === "parcial" && ` · ya te pagó ${fmt(c.amount - c.remaining)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 pr-3">
                  <p className="text-[17px] font-black tnum">{fmt(c.remaining)}</p>
                  <button
                    onClick={() => { setPaying({ id: c.id!, name: c.customerName, remaining: c.remaining }); haptic(); }}
                    className="haptic rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 shadow"
                  >
                    Cobrar
                  </button>
                </div>
              </div>
            );
          })}
          {open.length === 0 && (
            <p className="py-4 pl-14 text-sm opacity-60">Nada pendiente — todo cobrado 🎉</p>
          )}
        </div>
      </div>

      {/* Historial tachado */}
      {cobradas.length > 0 && (
        <div className="libreta-paper mt-4 rounded-3xl p-5 shadow-2xl">
          <p className="mb-2 text-sm font-bold">✅ Ya cobrados</p>
          <div>
            {cobradas.slice(0, 10).map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-slate-400/20 py-2.5" style={{ minHeight: "2rem" }}>
                <p className="pl-14 text-[15px] font-bold tachado opacity-70">{c.customerName}</p>
                <p className="pr-3 text-[15px] font-black tnum tachado opacity-70">{fmt(c.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal cobrar fiado */}
      {paying && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={() => setPaying(null)}>
          <div className="w-full max-w-xs rounded-3xl bg-slate-900 p-6 anim-pop" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">{paying.name}</p>
            <p className="mt-1 text-3xl font-black tnum text-rose-300">{fmt(paying.remaining)}</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                onClick={async () => { await registerCreditPayment(paying.id, paying.remaining); celebrateCash(); setPaying(null); }}
                className="haptic rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 font-bold"
              >
                Cobró todo
              </button>
              <button
                onClick={async () => {
                  const v = prompt(`¿Cuánto te pagó ${paying.name}?`);
                  if (v) { await registerCreditPayment(paying.id, Number(v)); celebrateCash(); setPaying(null); }
                }}
                className="haptic rounded-2xl bg-slate-700 py-3.5 font-bold"
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