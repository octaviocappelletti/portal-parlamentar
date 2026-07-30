"use client";

import { useState, useEffect, useRef } from "react";

const PIX_COPIA_COLA =
  "00020126510014BR.GOV.BCB.PIX0129capivaraparlamentar@gmail.com5204000053039865802BR5925Octavio Fellipe de Olivei6009SAO PAULO62140510vxilCFmtxW63047AF9";

export default function PixModal() {
  const [open, setOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copiar() {
    await navigator.clipboard.writeText(PIX_COPIA_COLA);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-brand-green text-white text-center py-[15px] rounded-[10px] font-extrabold text-[15px] mb-3.5 hover:opacity-90 transition-opacity"
      >
        Doar via Pix
      </button>

      {open && (
        <div
          ref={overlayRef}
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-base">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-bg text-brand-green font-extrabold flex items-center justify-center text-sm">
                  Pix
                </div>
                <span className="font-extrabold text-text-strong">Doar via Pix</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="text-text-muted hover:text-text-strong transition-colors text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              <p className="text-[14px] text-text-body leading-relaxed">
                Copie o código abaixo e cole no seu aplicativo de banco em{" "}
                <strong>Pix → Copia e Cola</strong>.
              </p>

              {/* Código */}
              <div className="bg-surface-alt rounded-xl px-4 py-4">
                <p className="text-[11px] text-text-muted font-semibold mb-2 uppercase tracking-wide">
                  Pix Copia e Cola
                </p>
                <p className="text-[12px] text-text-strong font-mono break-all leading-relaxed">
                  {PIX_COPIA_COLA}
                </p>
              </div>

              {/* Botão copiar */}
              <button
                onClick={copiar}
                className={`w-full py-[14px] rounded-[10px] font-extrabold text-[15px] transition-all ${
                  copiado
                    ? "bg-green-bg text-brand-green border-2 border-brand-green"
                    : "bg-brand-green text-white hover:opacity-90"
                }`}
              >
                {copiado ? "✓ Copiado!" : "Copiar código"}
              </button>

              <p className="text-[12px] text-text-muted text-center">
                Chave Pix (e-mail):{" "}
                <span className="font-bold text-text-strong">
                  capivaraparlamentar@gmail.com
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
