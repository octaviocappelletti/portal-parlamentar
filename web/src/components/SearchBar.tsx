"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar() {
  const [q, setQ] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/camara?q=${encodeURIComponent(term)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-[640px] mx-auto flex bg-white border-2 border-brand-blue rounded-xl overflow-hidden shadow-[0_12px_30px_-18px_rgba(19,81,180,0.5)]"
    >
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Busque por nome, partido ou estado…"
        className="flex-1 px-[22px] py-[18px] text-base text-text-strong placeholder:text-[#8a97a6] focus:outline-none bg-transparent"
      />
      <button
        type="submit"
        className="bg-brand-blue text-white px-8 font-bold text-base hover:bg-[#0d3d96] transition-colors shrink-0"
      >
        Buscar
      </button>
    </form>
  );
}
