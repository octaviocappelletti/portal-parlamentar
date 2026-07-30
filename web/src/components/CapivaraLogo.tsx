// Logo 6a — emblema detalhado com capivara segurando documentos.
// variant="light"  → fundo claro (header): anel navy + anel branco + azul
// variant="dark"   → fundo escuro (footer): círculo branco externo + azul

type Props = {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
};

export default function CapivaraLogo({ size = 40, variant = "light", className }: Props) {
  if (variant === "dark") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 210 210"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Capivara Parlamentar"
      >
        <circle cx="105" cy="105" r="101" fill="#fff" />
        <circle cx="105" cy="105" r="85" fill="#1351B4" />
        <ellipse cx="105" cy="126" rx="46" ry="34" fill="#a9713f" />
        <path d="M64 92 Q60 54 96 50 L120 50 Q150 54 148 84 Q148 108 120 110 L86 110 Q66 110 64 92 Z" fill="#b87d47" />
        <ellipse cx="74" cy="88" rx="18" ry="17" fill="#a9713f" />
        <circle cx="92" cy="49" r="9" fill="#8a5a2b" />
        <circle cx="126" cy="51" r="9" fill="#8a5a2b" />
        <ellipse cx="100" cy="74" rx="6" ry="6.5" fill="#3a2412" />
        <ellipse cx="128" cy="76" rx="6" ry="6.5" fill="#3a2412" />
        <rect x="78" y="112" width="50" height="44" rx="3" fill="#fff" />
      </svg>
    );
  }

  // variant="light" — emblema completo
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 210 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Capivara Parlamentar"
    >
      <circle cx="105" cy="105" r="101" fill="#071d41" />
      <circle cx="105" cy="105" r="93" fill="#fff" />
      <circle cx="105" cy="105" r="85" fill="#1351B4" />
      <path d="M105 26 A79 79 0 0 1 184 105" stroke="#FFCD07" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M105 184 A79 79 0 0 1 26 105" stroke="#FFCD07" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="105" cy="26" r="4" fill="#FFCD07" />
      <circle cx="105" cy="184" r="4" fill="#FFCD07" />
      {/* corpo */}
      <ellipse cx="105" cy="126" rx="46" ry="34" fill="#a9713f" />
      <path d="M70 118 Q75 150 105 152 Q135 150 140 118 Q140 145 105 148 Q70 145 70 118 Z" fill="#9a6535" opacity="0.5" />
      {/* cabeça */}
      <path d="M64 92 Q60 54 96 50 L120 50 Q150 54 148 84 Q148 108 120 110 L86 110 Q66 110 64 92 Z" fill="#b87d47" />
      <path d="M96 50 Q106 66 106 92 Q106 104 100 110 L86 110 Q66 110 64 92 Q60 54 96 50 Z" fill="#a9713f" opacity="0.35" />
      {/* pelo bochechas */}
      <path d="M70 96 q6 4 4 10" stroke="#8a5a2b" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M78 100 q6 4 4 10" stroke="#8a5a2b" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* focinho */}
      <ellipse cx="74" cy="88" rx="18" ry="17" fill="#a9713f" />
      <ellipse cx="74" cy="90" rx="18" ry="12" fill="#986237" opacity="0.5" />
      <ellipse cx="66" cy="84" rx="4.5" ry="3.2" fill="#3a2412" />
      <ellipse cx="80" cy="86" rx="4.5" ry="3.2" fill="#3a2412" />
      <path d="M70 96 Q74 99 78 96" stroke="#5a3a1c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* orelhas */}
      <circle cx="92" cy="49" r="9" fill="#8a5a2b" /><circle cx="92" cy="50" r="4.5" fill="#6b4423" />
      <circle cx="126" cy="51" r="9" fill="#8a5a2b" /><circle cx="126" cy="52" r="4.5" fill="#6b4423" />
      {/* olhos */}
      <ellipse cx="100" cy="74" rx="6" ry="6.5" fill="#3a2412" />
      <circle cx="102" cy="72" r="2" fill="#fff" />
      <ellipse cx="128" cy="76" rx="6" ry="6.5" fill="#3a2412" />
      <circle cx="130" cy="74" r="2" fill="#fff" />
      <path d="M94 65 Q100 62 106 65" stroke="#8a5a2b" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M122 67 Q128 64 134 67" stroke="#8a5a2b" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* documentos */}
      <g transform="rotate(-9 105 134)">
        <rect x="80" y="112" width="52" height="46" rx="3" fill="#e9edf3" />
        <rect x="75" y="108" width="52" height="46" rx="3" fill="#fff" stroke="#e4e9f0" strokeWidth="1.2" />
        <rect x="82" y="116" width="38" height="4" rx="2" fill="#1351B4" />
        <rect x="82" y="124" width="38" height="3.4" rx="1.7" fill="#c9d4e8" />
        <rect x="82" y="131" width="38" height="3.4" rx="1.7" fill="#c9d4e8" />
        <rect x="82" y="138" width="24" height="3.4" rx="1.7" fill="#168821" />
        <rect x="82" y="145" width="15" height="3.4" rx="1.7" fill="#FFCD07" />
      </g>
      {/* patas */}
      <g fill="#8a5a2b">
        <ellipse cx="80" cy="130" rx="9" ry="7" />
        <ellipse cx="130" cy="128" rx="9" ry="7" />
      </g>
      <g stroke="#6b4423" strokeWidth="1.4" strokeLinecap="round">
        <path d="M76 130 v5" /><path d="M80 131 v5" /><path d="M84 130 v5" />
        <path d="M126 128 v5" /><path d="M130 129 v5" /><path d="M134 128 v5" />
      </g>
    </svg>
  );
}
