"use client";
// ============================================================
// LIBRETA — Juice: micro-feedback sensorial en cada acción.
// El POS genérico no da nada cuando tocás. Nosotros sí:
//   - tocar  → vibra el celu (haptic)
//   - cobrar → CONFETTI + sonido caja + vibración fuerte
// LUXE: confetti dorado/champagne, no arcoíris.
// ============================================================
import confetti from "canvas-confetti";

/** Vibración corta para toques normales */
export function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

/** Vibración fuerte para cobros */
export function hapticCash() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([30, 40, 80]);
  }
}

/** "Cha-ching" de caja registradora sintetizado con WebAudio */
export function playCashSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;

    // "cha" = dos monedas metálicas (frecuencias altas + decay corto)
    [2100, 2760].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.12, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.45);
    });

    // "ching" = cajón que se abre (barrido descendente)
    const drawer = ctx.createOscillator();
    const dGain = ctx.createGain();
    drawer.type = "sawtooth";
    drawer.frequency.setValueAtTime(900, now + 0.15);
    drawer.frequency.exponentialRampToValueAtTime(120, now + 0.55);
    dGain.gain.setValueAtTime(0.08, now + 0.15);
    dGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    drawer.connect(dGain).connect(ctx.destination);
    drawer.start(now + 0.15);
    drawer.stop(now + 0.65);

    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* sin audio no pasa nada: la app sigue funcionando */
  }
}

/** Confetti + cha-ching + vibración — el momento estrella */
export function celebrateCash() {
  playCashSound();
  hapticCash();

  // LUXE: paleta champagne — oro, crema, bronce
  const colors = ["#E8B44A", "#F0BC58", "#F5EDD8", "#C88F2E", "#8C6D2F"];
  // dos cañones laterales
  confetti({ particleCount: 50, angle: 60, spread: 65, startVelocity: 42, colors, ticks: 220, zIndex: 9999, origin: { x: 0, y: 0.7 } });
  confetti({ particleCount: 50, angle: 120, spread: 65, startVelocity: 42, colors, ticks: 220, zIndex: 9999, origin: { x: 1, y: 0.7 } });
}

/** Confetti suave para cobro de fiado (menos intenso) */
export function celebrateFiado() {
  haptic();
}