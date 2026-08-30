"use client";
// ============================================================
// LIBRETA — Home / Punto de venta
// Venta en 3 toques + juice en cada acción.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { db, registerSale, seedDemoData, type Product, type SaleItem } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useBarcodeScanner } from "@/lib/scanner";
import { haptic, celebrateCash, celebrateFiado } from "@/lib/juice";
import { TodayHero, StockAlerts } from "@/components/Hero";
import { Fiados } from "@/components/Fiados";
import { Stats } from "@/components/Stats";

const fmt = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

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
    if (p) { addToTicket(p); haptic(); }
    else setToast(`❌ ${r.text} no está en tu catálogo`);
  });

  useEffect(() => { void seedDemoData(); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

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
    if (payment === "fiado") celebrateFiado(); else celebrateCash();
  }

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
              onClick={() => { setView(v); haptic(); }}
              className={`haptic rounded-full px-3.5 py-1.5 text-[13px] font-semibold capitalize transition ${
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
          <TodayHero />
          <StockAlerts />

          <div className="mt-4">
            <button
              onClick={() => { scanner.setActive(!scanner.active); haptic(); }}
              className={`haptic w-full rounded-2xl py-3.5 text-sm font-bold transition ${
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
                    onClick={() => { addToTicket(p); haptic(); }}
                    disabled={out}
                    className={`haptic relative overflow-hidden rounded-2xl border p-3 text-left ${
                      out
                        ? "border-white/5 bg-white/[0.02] opacity-50"
                        : "border-white/10 bg-white/[0.04] hover:border-brand/50 active:bg-white/10"
                    }`}
                  >
                    {low && (
                      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
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
                    onClick={() => { setTicket((t) => t.filter((x) => x.productId !== i.productId)); haptic(); }}
                    className="haptic grid h-6 w-6 place-items-center rounded-lg text-slate-500 hover:text-red-400"
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
                onClick={() => { setConfirming(true); haptic(); }}
                className="haptic rounded-2xl bg-gradient-to-r from-brand to-accent px-8 py-3.5 font-bold text-white shadow-lg shadow-brand/40"
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
              <button onClick={() => charge("efectivo")} className="haptic rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 font-bold shadow-lg">💵 Efectivo</button>
              <button onClick={() => charge("qr")} className="haptic rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 py-3.5 font-bold shadow-lg">📱 QR</button>
              <button onClick={() => charge("transferencia")} className="haptic rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 py-3.5 font-bold shadow-lg">🏦 Transf.</button>
              <button onClick={() => charge("fiado")} className="haptic rounded-2xl bg-gradient-to-r from-fuchsia-500 to-fuchsia-600 py-3.5 font-bold shadow-lg">✍️ Fiado</button>
            </div>

            <input
              value={fiadoName}
              onChange={(e) => setFiadoName(e.target.value)}
              placeholder="Nombre para el fiado (solo si es fiado)"
              className="mt-3 w-full rounded-xl bg-slate-800 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-fuchsia-500/60"
            />
          </div>
        </div>
      )}

      {/* ===== Celebración post-cobro ===== */}
      {charged && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-6 backdrop-blur-sm" onClick={() => setCharged(null)}>
          <div className="w-full max-w-xs rounded-3xl bg-slate-900 p-6 text-center anim-pop">
            <p className="text-5xl">{charged.payment === "fiado" ? "✍️" : "🎉"}</p>
            <p className="mt-3 text-2xl font-black tnum">{fmt(charged.total)}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-400">ganancia {fmt(charged.profit)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {charged.payment === "fiado" ? "anotado en la libreta ✍️" : "cobrado, ¡buen negocio! 💪"}
            </p>
            <button onClick={() => { setCharged(null); haptic(); }} className="haptic mt-5 w-full rounded-2xl bg-gradient-to-r from-brand to-accent py-3.5 font-bold">
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