"use client";
import Image from "next/image";
import { useState } from "react";

type Props = {
  url: string | null | undefined;
  iniciais: string;
  size: number;        // largura e altura em px
  rounded?: string;    // classe Tailwind de borda (ex: "rounded-xl")
  avatarBg?: string;
  avatarText?: string;
  fontSize?: number;   // px; padrão: ~35% do size
};

export default function AvatarFoto({
  url,
  iniciais,
  size,
  rounded = "rounded-xl",
  avatarBg = "#e8f0fb",
  avatarText = "#1351B4",
  fontSize,
}: Props) {
  const [erro, setErro] = useState(false);
  const fs = fontSize ?? Math.round(size * 0.35);

  const fallback = (
    <div
      className={`flex items-center justify-center font-extrabold select-none shrink-0 ${rounded}`}
      style={{ width: size, height: size, backgroundColor: avatarBg, color: avatarText, fontSize: fs }}
    >
      {iniciais}
    </div>
  );

  if (!url || erro) return fallback;

  return (
    <div
      className={`relative overflow-hidden shrink-0 ${rounded}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={url}
        alt={iniciais}
        fill
        sizes={`${size}px`}
        className="object-cover object-top"
        onError={() => setErro(true)}
        unoptimized
      />
    </div>
  );
}
