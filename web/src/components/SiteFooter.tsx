export default function SiteFooter() {
  return (
    <footer className="bg-brand-blue-dark text-[#aebcd4] px-8 py-9 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[9px] bg-brand-blue flex items-center justify-center text-white font-black text-sm select-none">
          CP
        </div>
        <span className="font-bold text-white text-sm">Capivara Parlamentar</span>
      </div>
      <p className="text-[13px]">
        Dados: Câmara dos Deputados · Senado Federal · Portal da Transparência
      </p>
    </footer>
  );
}
