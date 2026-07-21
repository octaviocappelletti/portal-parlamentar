export default function GovBar() {
  return (
    <div className="bg-brand-blue-dark text-[#c9d4e8] text-xs px-8 py-[7px] flex items-center gap-5">
      <span className="font-bold text-white">gov.br</span>
      <span className="opacity-70">Portal de dados abertos do Poder Legislativo</span>
      <div className="ml-auto flex gap-4">
        <span>Acessibilidade</span>
        <span>Alto contraste</span>
        <span>Mapa do site</span>
      </div>
    </div>
  );
}
