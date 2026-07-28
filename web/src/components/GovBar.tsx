'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const FONT_SCALES = [0.9, 1, 1.15, 1.3]
const MIN_LEVEL = -1
const MAX_LEVEL = 2

function applyFontScale(level: number) {
  const scale = FONT_SCALES[level - MIN_LEVEL]
  document.documentElement.style.setProperty('--font-scale', String(scale ?? 1))
}

export default function GovBar() {
  const [altoContraste, setAltoContraste] = useState(false)
  const [fontLevel, setFontLevel] = useState(0)
  const [painelAberto, setPainelAberto] = useState(false)
  const painelRef = useRef<HTMLDivElement>(null)
  const btnAcessRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const contraste = localStorage.getItem('alto_contraste') === '1'
    const nivel = parseInt(localStorage.getItem('font_level') ?? '0', 10)
    if (contraste) {
      document.documentElement.classList.add('contrast-alto')
      setAltoContraste(true)
    }
    applyFontScale(nivel)
    setFontLevel(nivel)
  }, [])

  useEffect(() => {
    if (!painelAberto) return
    function handler(e: MouseEvent) {
      if (
        !painelRef.current?.contains(e.target as Node) &&
        !btnAcessRef.current?.contains(e.target as Node)
      ) {
        setPainelAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [painelAberto])

  function toggleContraste() {
    const next = !altoContraste
    setAltoContraste(next)
    document.documentElement.classList.toggle('contrast-alto', next)
    localStorage.setItem('alto_contraste', next ? '1' : '0')
  }

  function changeFontLevel(delta: number | 'reset') {
    setFontLevel(prev => {
      const next = delta === 'reset' ? 0 : Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, prev + delta))
      applyFontScale(next)
      localStorage.setItem('font_level', String(next))
      return next
    })
  }

  const fontLevelLabel = fontLevel === 0 ? 'padrão' : fontLevel > 0 ? `+${fontLevel}` : String(fontLevel)

  return (
    <div className="bg-brand-blue-dark text-[#c9d4e8] text-xs px-4 sm:px-8 py-[7px] flex items-center gap-5">
      <div className="ml-auto hidden sm:flex gap-4 items-center">

        {/* Acessibilidade */}
        <div className="relative">
          <button
            ref={btnAcessRef}
            onClick={() => setPainelAberto(p => !p)}
            aria-expanded={painelAberto}
            aria-controls="painel-acessibilidade"
            className="hover:text-white transition-colors cursor-pointer"
          >
            Acessibilidade
          </button>

          {painelAberto && (
            <div
              id="painel-acessibilidade"
              ref={painelRef}
              role="dialog"
              aria-label="Opções de acessibilidade"
              className="absolute right-0 top-full mt-2 bg-white text-text-strong rounded-xl border border-border-base shadow-lg p-4 w-52 z-50"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
                Tamanho do texto
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeFontLevel(-1)}
                  disabled={fontLevel <= MIN_LEVEL}
                  aria-label="Diminuir texto"
                  className="flex-1 py-1.5 rounded-lg border border-border-input text-sm font-bold text-text-strong hover:bg-surface-alt disabled:opacity-40 transition-colors cursor-pointer"
                >
                  A−
                </button>
                <button
                  onClick={() => changeFontLevel('reset')}
                  aria-label="Tamanho padrão"
                  className="flex-1 py-1.5 rounded-lg border border-border-input text-sm font-bold text-text-strong hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  A
                </button>
                <button
                  onClick={() => changeFontLevel(1)}
                  disabled={fontLevel >= MAX_LEVEL}
                  aria-label="Aumentar texto"
                  className="flex-1 py-1.5 rounded-lg border border-border-input text-base font-bold text-text-strong hover:bg-surface-alt disabled:opacity-40 transition-colors cursor-pointer"
                >
                  A+
                </button>
              </div>
              <p className="text-[11px] text-text-muted mt-2 text-center">
                Nível atual: {fontLevelLabel}
              </p>
            </div>
          )}
        </div>

        <span className="opacity-30 select-none">|</span>

        {/* Alto contraste */}
        <button
          onClick={toggleContraste}
          aria-pressed={altoContraste}
          className={`transition-colors cursor-pointer ${
            altoContraste
              ? 'text-white underline underline-offset-2'
              : 'hover:text-white'
          }`}
        >
          Alto contraste
        </button>

        <span className="opacity-30 select-none">|</span>

        {/* Mapa do site */}
        <Link href="/mapa-do-site" className="hover:text-white transition-colors">
          Mapa do site
        </Link>

      </div>
    </div>
  )
}
