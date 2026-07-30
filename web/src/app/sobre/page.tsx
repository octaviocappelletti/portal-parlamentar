import Link from "next/link";
import type { Metadata } from "next";
import PixModal from "@/components/PixModal";
import QrCodeModal from "@/components/QrCodeModal";

export const metadata: Metadata = {
  title: "Sobre o projeto",
  description:
    "Conheça o Capivara Parlamentar: origem dos dados, aviso sobre o projeto e como entrar em contato.",
};

const FONTES = [
  {
    sigla: "C",
    titulo: "Câmara dos Deputados",
    descricao:
      "Cota parlamentar, presença, proposições e votações dos 513 deputados federais.",
    url: "dadosabertos.camara.leg.br",
    cor: "bg-blue-bg text-brand-blue",
  },
  {
    sigla: "S",
    titulo: "Senado Federal",
    descricao:
      "Verbas de gabinete, matérias legislativas e atividade dos 81 senadores.",
    url: "legis.senado.leg.br/dadosabertos",
    cor: "bg-green-bg text-brand-green",
  },
  {
    sigla: "T",
    titulo: "Portal da Transparência",
    descricao:
      "Cruzamento de despesas, fornecedores e informações complementares.",
    url: "portaltransparencia.gov.br",
    cor: "bg-yellow-bg text-yellow-text",
  },
] as const;

export default function SobrePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-surface-alt to-white px-4 sm:px-8 pt-10 pb-10">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-[13px] text-text-muted mb-4 flex items-center gap-2">
            <Link href="/" className="hover:text-text-strong transition-colors">
              Início
            </Link>
            <span>›</span>
            <span className="text-text-strong font-semibold">Sobre</span>
          </div>
          <span className="inline-block bg-blue-bg text-brand-blue text-xs font-bold px-3.5 py-[6px] rounded-full uppercase tracking-[0.04em] mb-5">
            Sobre o projeto
          </span>
          <h1 className="text-[38px] font-extrabold leading-[1.14] tracking-[-0.02em] max-w-[720px] mb-4 text-text-strong">
            Transparência parlamentar, explicada para qualquer cidadão
          </h1>
          <p className="text-[18px] text-text-body max-w-[680px] leading-[1.55]">
            O Capivara Parlamentar reúne dados públicos sobre deputados e
            senadores — custos, proposições e verbas — e os apresenta de forma
            simples, para que qualquer pessoa possa fiscalizar seus
            representantes.
          </p>
        </div>
      </section>

      {/* Origem dos dados */}
      <section className="px-4 sm:px-8 py-11 border-t border-border-base">
        <div className="max-w-[1180px] mx-auto">
          <p className="section-label mb-2">Origem dos dados</p>
          <h2 className="text-[26px] font-extrabold text-text-strong mb-3">
            De onde vêm as informações
          </h2>
          <p className="text-[15px] text-text-body leading-relaxed mb-7 max-w-[720px]">
            Todos os dados exibidos são{" "}
            <strong>oficiais e de acesso público</strong>, obtidos diretamente
            das APIs de dados abertos das casas legislativas e do governo
            federal. Nenhuma informação é editada — apenas organizada e
            traduzida em linguagem acessível.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            {FONTES.map(({ sigla, titulo, descricao, url, cor }) => (
              <div
                key={sigla}
                className="border border-border-base rounded-xl p-6"
              >
                <div
                  className={`w-10 h-10 rounded-[10px] flex items-center justify-center font-extrabold text-[15px] mb-4 ${cor}`}
                >
                  {sigla}
                </div>
                <h3 className="font-bold text-base text-text-strong mb-1.5">
                  {titulo}
                </h3>
                <p className="text-[14px] text-text-body leading-relaxed mb-3">
                  {descricao}
                </p>
                <span className="text-[13px] text-brand-blue font-bold">
                  {url}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[13px] text-text-muted">
            Frequência de sincronização: diária.
          </p>
        </div>
      </section>

      {/* Aviso */}
      <section className="px-4 sm:px-8 pb-11">
        <div className="max-w-[1180px] mx-auto">
          <div className="flex gap-5 bg-yellow-bg border border-[#f5e2a3] border-l-4 border-l-[#FFCD07] rounded-xl p-6">
            <div className="w-10 h-10 rounded-full bg-[#FFCD07] text-[#5a4700] font-black text-xl flex items-center justify-center shrink-0">
              i
            </div>
            <div>
              <h3 className="font-extrabold text-[17px] text-[#5a4700] mb-2">
                Projeto acadêmico e sem fins lucrativos
              </h3>
              <p className="text-[14px] text-[#7a6200] leading-relaxed">
                O Capivara Parlamentar é um{" "}
                <strong>projeto criado para fins de estudo</strong>, sem vínculo
                oficial com a Câmara, o Senado ou qualquer órgão do governo.
                Não representamos entidade pública e não temos finalidade
                comercial. Os dados são reproduzidos de fontes oficiais e podem
                conter defasagens de sincronização — em caso de divergência,
                prevalece sempre a fonte original.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback + Doação */}
      <section className="px-4 sm:px-8 pb-14">
        <div className="max-w-[1180px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Feedback */}
          <div className="border border-border-base rounded-2xl overflow-hidden">
            <div className="h-[6px] bg-brand-blue" />
            <div className="p-7">
              <p className="section-label mb-2">Fale conosco</p>
              <h2 className="text-[22px] font-extrabold text-text-strong mb-2.5">
                Encontrou algo errado? Conte pra gente
              </h2>
              <p className="text-[14px] text-text-body leading-relaxed mb-6">
                Elogios, sugestões ou inconsistências nos dados são muito
                bem-vindos. Sua mensagem ajuda a manter o portal preciso e
                confiável.
              </p>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4 bg-surface-alt rounded-[10px] px-[18px] py-4">
                  <div className="w-[38px] h-[38px] rounded-[9px] bg-blue-bg text-brand-blue font-extrabold flex items-center justify-center shrink-0 text-lg">
                    @
                  </div>
                  <div>
                    <p className="text-[12px] text-text-muted font-semibold">
                      Envie um e-mail para
                    </p>
                    <p className="text-[15px] font-extrabold text-text-strong">
                      capivaraparlamentar@gmail.com
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <a
                    href="mailto:capivaraparlamentar@gmail.com?subject=Elogio%20/%20Sugestão%20—%20Capivara%20Parlamentar"
                    className="flex-1 bg-brand-blue text-white text-center py-[13px] rounded-[10px] font-bold text-[14px] hover:bg-[#0d3d96] transition-colors"
                  >
                    ✉ Elogiar / sugerir
                  </a>
                  <a
                    href="mailto:capivaraparlamentar@gmail.com?subject=Inconsistência%20—%20Capivara%20Parlamentar"
                    className="flex-1 border-[1.5px] border-brand-blue text-brand-blue text-center py-[13px] rounded-[10px] font-bold text-[14px] hover:bg-blue-bg transition-colors"
                  >
                    ⚠ Reportar inconsistência
                  </a>
                </div>

                <p className="text-[12px] text-text-muted leading-relaxed">
                  Ao reportar, inclua o nome do parlamentar e a página onde
                  notou a divergência — respondemos em até 5 dias úteis.
                </p>
              </div>
            </div>
          </div>

          {/* Doação */}
          <div className="border border-border-base rounded-2xl overflow-hidden">
            <div className="h-[6px] bg-brand-green" />
            <div className="p-7">
              <p className="text-[12px] font-bold text-brand-green uppercase tracking-[0.05em] mb-2">
                Apoie o projeto
              </p>
              <h2 className="text-[22px] font-extrabold text-text-strong mb-2.5">
                Ajude o portal a continuar no ar
              </h2>
              <p className="text-[14px] text-text-body leading-relaxed mb-6">
                Mantemos servidores e a sincronização diária dos dados por conta
                própria. Qualquer valor ajuda a manter o Capivara Parlamentar
                gratuito e independente.
              </p>

              <PixModal />

              <div className="flex items-center gap-4 bg-surface-alt rounded-[10px] px-4 py-3.5">
                <QrCodeModal />
                <div>
                  <p className="text-[12px] text-text-muted font-semibold">
                    Chave Pix (e-mail)
                  </p>
                  <p className="text-[14px] font-extrabold text-text-strong">
                    capivaraparlamentar@gmail.com
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
