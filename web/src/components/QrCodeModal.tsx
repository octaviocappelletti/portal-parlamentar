"use client";

import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

const PIX_COPIA_COLA =
  "00020126510014BR.GOV.BCB.PIX0129capivaraparlamentar@gmail.com5204000053039865802BR5925Octavio Fellipe de Olivei6009SAO PAULO62140510vxilCFmtxW63047AF9";

export default function QrCodeModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Trigger — QR code decorativo clicável */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Ver QR Code Pix"
        className="w-[52px] h-[52px] rounded-lg bg-white border border-border-base flex items-center justify-center shrink-0 hover:border-brand-green hover:shadow-md transition-all group"
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          className="group-hover:opacity-80 transition-opacity"
        >
          {/* canto superior esquerdo */}
          <rect x="2" y="2" width="14" height="14" rx="2" fill="#071d41" />
          <rect x="5" y="5" width="8" height="8" rx="1" fill="white" />
          <rect x="7" y="7" width="4" height="4" rx="0.5" fill="#071d41" />
          {/* canto superior direito */}
          <rect x="20" y="2" width="14" height="14" rx="2" fill="#071d41" />
          <rect x="23" y="5" width="8" height="8" rx="1" fill="white" />
          <rect x="25" y="7" width="4" height="4" rx="0.5" fill="#071d41" />
          {/* canto inferior esquerdo */}
          <rect x="2" y="20" width="14" height="14" rx="2" fill="#071d41" />
          <rect x="5" y="23" width="8" height="8" rx="1" fill="white" />
          <rect x="7" y="25" width="4" height="4" rx="0.5" fill="#071d41" />
          {/* módulos centrais */}
          <rect x="20" y="20" width="4" height="4" rx="0.5" fill="#071d41" />
          <rect x="26" y="20" width="4" height="4" rx="0.5" fill="#071d41" />
          <rect x="32" y="20" width="2" height="4" rx="0.5" fill="#071d41" />
          <rect x="20" y="26" width="4" height="4" rx="0.5" fill="#071d41" />
          <rect x="26" y="26" width="8" height="4" rx="0.5" fill="#071d41" />
          <rect x="20" y="32" width="4" height="2" rx="0.5" fill="#071d41" />
          <rect x="28" y="32" width="6" height="2" rx="0.5" fill="#071d41" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div
          ref={overlayRef}
          onClick={(e) => {
            if (e.target === overlayRef.current) setOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[360px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-base">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-bg text-brand-green font-extrabold flex items-center justify-center text-sm">
                  Pix
                </div>
                <span className="font-extrabold text-text-strong">
                  QR Code Pix
                </span>
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
            <div className="px-6 py-6 flex flex-col items-center gap-4">
              <p className="text-[14px] text-text-body text-center leading-relaxed">
                Aponte a câmera do seu banco para o QR Code abaixo para fazer a
                doação via Pix.
              </p>

              <div className="p-4 bg-white border-2 border-border-base rounded-xl">
                <QRCodeSVG
                  value={PIX_COPIA_COLA}
                  size={200}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#071d41"
                />
              </div>

              <p className="text-[12px] text-text-muted text-center">
                Chave Pix:{" "}
                <span className="font-bold text-text-strong">
                  capivaraparlamentar@gmail.com
                </span>
              </p>

              <button
                onClick={() => setOpen(false)}
                className="w-full border-[1.5px] border-border-base text-text-body rounded-[10px] py-3 font-bold text-[14px] hover:border-brand-green hover:text-brand-green transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
