import React from "react";

type Plataforma = "twitter" | "facebook" | "youtube" | "instagram" | "link";

function detectar(url: string): Plataforma {
  const u = url.toLowerCase();
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "facebook";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("instagram.com")) return "instagram";
  return "link";
}

const LABELS: Record<Plataforma, string> = {
  twitter: "X / Twitter",
  facebook: "Facebook",
  youtube: "YouTube",
  instagram: "Instagram",
  link: "Site",
};

function IconTwitter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.024 10.125 11.927v-8.434H7.078v-3.493h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.493h-2.796v8.434C19.612 23.097 24 18.1 24 12.073z" />
    </svg>
  );
}

function IconYoutube() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

const ICONES: Record<Plataforma, () => React.ReactElement> = {
  twitter: IconTwitter,
  facebook: IconFacebook,
  youtube: IconYoutube,
  instagram: IconInstagram,
  link: IconLink,
};

const CORES_HOVER: Record<Plataforma, string> = {
  twitter:   "#000000",
  facebook:  "#1877F2",
  youtube:   "#FF0000",
  instagram: "#E1306C",
  link:      "#1351B4",
};

type Props = {
  links: string[];
  website?: string | null;
};

export default function RedesSociais({ links, website }: Props) {
  const todos: Array<{ url: string; plataforma: Plataforma }> = [
    ...links.map((url) => ({ url, plataforma: detectar(url) })),
    // website usa a mesma detecção de plataforma — para senadores, pode ser Facebook, etc.
    ...(website ? [{ url: website, plataforma: detectar(website) }] : []),
  ];

  if (todos.length === 0) return null;

  return (
    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
      {todos.map(({ url, plataforma }) => {
        const Icone = ICONES[plataforma];
        const label = LABELS[plataforma];
        const corHover = CORES_HOVER[plataforma];
        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className="flex items-center gap-1.5 text-text-muted transition-colors duration-150 hover:text-[var(--rede-cor)]"
            style={{ "--rede-cor": corHover } as React.CSSProperties}
          >
            <Icone />
            <span className="text-[12px] font-semibold">{label}</span>
          </a>
        );
      })}
    </div>
  );
}
