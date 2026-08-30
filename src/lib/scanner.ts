"use client";
// ============================================================
// LIBRETA — Escáner de código de barras
// Estrategia en 2 capas (por velocidad y compatibilidad):
//   1. BarcodeDetector API nativa del browser (rápida, Android/Chrome)
//   2. Fallback @zxing/browser (Safari, Firefox, browsers viejos)
// ============================================================
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export interface ScanResult {
  text: string; // el código leído
  format: string;
}

export function useBarcodeScanner(onDetect: (r: ScanResult) => void) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cbRef = useRef(onDetect);
  cbRef.current = onDetect; // siempre fresco sin re-armar el effect

  useEffect(() => {
    if (!active || !videoRef.current) return;
    let stopFn: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const video = videoRef.current!;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, // cámara trasera
          audio: false,
        });
        video.srcObject = stream;
        await video.play();

        // Capa 1: BarcodeDetector nativo (Chrome/Android — la mayoría de los celus del almacén)
        const anyWin = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<ScanResult[]> } };
        if (anyWin.BarcodeDetector) {
          const detector = new anyWin.BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "qr_code"] });
          const loop = async () => {
            if (cancelled) return;
            try {
              const results = await detector.detect(video);
              if (results.length > 0) {
                cbRef.current({ text: results[0].text, format: results[0].format });
                return; // detectó → salir del loop
              }
            } catch { /* frame ilegible: siguiente frame */ }
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
          stopFn = () => stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Capa 2: zxing para Safari/Firefox
        const reader = new BrowserMultiFormatReader();
        const ctrlPromise = reader.decodeFromVideoElement(video, (res) => {
          if (res) cbRef.current({ text: res.getText(), format: res.getBarcodeFormat().toString() });
        });
        stopFn = () => {
          void ctrlPromise.then((c) => c.stop());
          stream.getTracks().forEach((t) => t.stop());
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo abrir la cámara");
        setActive(false);
      }
    })();

    return () => {
      cancelled = true;
      stopFn?.();
    };
  }, [active]);

  return { videoRef, active, setActive, error };
}