import { supabase } from "@/lib/db";
import type { Fornecedor, FornecedorSocio, Parlamentar } from "@/types";
import ParlamentaresFornecedor, {
  type DespesaLinha,
  type ParlamentarGrupo,
} from "@/components/ParlamentaresFornecedor";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 86400;

const BRL0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const SITUACAO_CADASTRAL: Record<string, { label: string; cls: string }> = {
  "01": { label: "Nula",     cls: "bg-slate-100 text-slate-500" },
  "02": { label: "Ativa",    cls: "bg-green-100 text-green-700" },
  "03": { label: "Suspensa", cls: "bg-amber-100 text-amber-700" },
  "04": { label: "Inapta",   cls: "bg-red-100 text-red-600" },
  "08": { label: "Baixada",  cls: "bg-red-100 text-red-600" },
};

const PORTE: Record<string, string> = {
  "00": "Não informado",
  "01": "Micro Empresa",
  "03": "Pequeno Porte",
  "05": "Grande Empresa",
};

const TIPO_SOCIO: Record<string, string> = {
  "1": "Pessoa Jurídica",
  "2": "Pessoa Física",
  "3": "Estrangeiro",
};

const FAIXA_ETARIA: Record<string, string> = {
  "1": "0–12 anos",
  "2": "13–20 anos",
  "3": "21–30 anos",
  "4": "31–40 anos",
  "5": "41–50 anos",
  "6": "51–60 anos",
  "7": "61–70 anos",
  "8": "71–80 anos",
  "9": "Mais de 80 anos",
  "0": "N/A",
};

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCep(cep: string): string {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return cep;
  return d.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

function idadeAnos(dataInicio: string): number {
  const ms = Date.now() - new Date(dataInicio).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25));
}

interface Props {
  params: Promise<{ cnpj: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cnpj } = await params;
  const { data } = await supabase
    .from("despesa")
    .select("fornecedor")
    .eq("cnpj_normalizado", cnpj)
    .not("fornecedor", "is", null)
    .limit(1)
    .single();
  return { title: data?.fornecedor ?? formatCnpj(cnpj) };
}

interface DespesaRow {
  id: number;
  parlamentar_id: number;
  ano: number;
  mes: number;
  valor_liquido: number | null;
  valor_glosa: number | null;
  natureza: string | null;
  fornecedor: string | null;
  detalhamento: string | null;
  url_documento: string | null;
  parlamentar: Parlamentar;
}

export default async function FornecedorPage({ params }: Props) {
  const { cnpj } = await params;

  if (!/^\d{14}$/.test(cnpj)) notFound();

  const [
    { data: despesasRaw, error: errDespesas },
    { data: infoReceita },
    { data: sociosRaw, error: errSocios },
  ] = await Promise.all([
    supabase
      .from("despesa")
      .select(
        "id, parlamentar_id, ano, mes, valor_liquido, valor_glosa, natureza, detalhamento, url_documento, fornecedor, parlamentar(id, id_externo, nome, partido, uf, casa, foto_url)"
      )
      .eq("cnpj_normalizado", cnpj),
    supabase
      .from("fornecedor")
      .select("*")
      .eq("cnpj", cnpj)
      .maybeSingle<Fornecedor>(),
    supabase
      .from("fornecedor_socio")
      .select("*")
      .eq("fornecedor_cnpj", cnpj)
      .order("data_entrada_sociedade")
      .returns<FornecedorSocio[]>(),
  ]);

  if (errDespesas) throw new Error(errDespesas.message);
  if (!despesasRaw?.length) notFound();

  // fornecedor_socio pode ainda não existir no banco — falha silenciosa
  const socios: FornecedorSocio[] = errSocios ? [] : (sociosRaw ?? []);

  const despesas = despesasRaw as unknown as DespesaRow[];

  // Prefere razao_social da Receita Federal como nome canônico
  const nomeCeap = despesas.find((d) => d.fornecedor)?.fornecedor ?? formatCnpj(cnpj);
  const nomePrincipal = infoReceita?.razao_social ?? nomeCeap;
  const nomeFantasia =
    infoReceita?.nome_fantasia && infoReceita.nome_fantasia !== nomePrincipal
      ? infoReceita.nome_fantasia
      : null;

  // Totais
  const totalRecebido = despesas.reduce((s, d) => s + (d.valor_liquido ?? 0), 0);

  // Agrupamento por parlamentar
  const porParlamentar = new Map<number, ParlamentarGrupo>();
  for (const d of despesas) {
    if (!d.parlamentar) continue;
    const entry = porParlamentar.get(d.parlamentar_id) ?? {
      parlamentar: d.parlamentar,
      total: 0,
      lancamentos: 0,
      despesas: [] as DespesaLinha[],
    };
    entry.total += d.valor_liquido ?? 0;
    entry.lancamentos += 1;
    entry.despesas.push({
      id: d.id,
      ano: d.ano,
      mes: d.mes,
      valor_liquido: d.valor_liquido,
      valor_glosa: d.valor_glosa,
      natureza: d.natureza,
      detalhamento: d.detalhamento,
      url_documento: d.url_documento,
    });
    porParlamentar.set(d.parlamentar_id, entry);
  }
  const grupos = [...porParlamentar.values()].sort((a, b) => b.total - a.total);

  // Histórico por ano
  const porAno = new Map<number, number>();
  for (const d of despesas) {
    porAno.set(d.ano, (porAno.get(d.ano) ?? 0) + (d.valor_liquido ?? 0));
  }
  const anos = [...porAno.entries()].sort((a, b) => b[0] - a[0]);
  const maiorAno = anos.length > 0 ? Math.max(...anos.map(([, v]) => v)) : 1;

  // Lookups para badges e seções de detalhe
  const situacao = infoReceita?.situacao_cadastral
    ? (SITUACAO_CADASTRAL[infoReceita.situacao_cadastral] ?? null)
    : null;
  const porte = infoReceita?.porte_empresa ? (PORTE[infoReceita.porte_empresa] ?? null) : null;

  const regimeTributario =
    infoReceita?.opcao_mei
      ? "MEI"
      : infoReceita?.opcao_simples
        ? "Simples Nacional"
        : infoReceita?.opcao_simples === false
          ? "Regime Normal"
          : null;

  const capitalSocial =
    infoReceita?.capital_social
      ? parseFloat(infoReceita.capital_social.replace(",", "."))
      : null;

  const temEndereco = !!(infoReceita?.logradouro || infoReceita?.municipio);
  const temCnaes = !!(
    infoReceita?.cnae_principal ||
    (infoReceita?.cnae_secundarios ?? []).length > 0
  );

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Localização" className="text-sm text-slate-500 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-slate-700 transition-colors">Início</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium truncate max-w-xs">{nomePrincipal}</span>
      </nav>

      {/* Header */}
      <div className="card p-6 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">{nomePrincipal}</h1>
        {nomeFantasia && (
          <p className="text-slate-500 text-sm mt-0.5">{nomeFantasia}</p>
        )}
        <p className="text-sm text-slate-500 font-mono mt-1">{formatCnpj(cnpj)}</p>

        {infoReceita && (
          <div className="flex flex-wrap gap-2 mt-3">
            {situacao && (
              <span className={`badge ${situacao.cls}`}>{situacao.label}</span>
            )}
            {porte && <span className="badge badge-gray">{porte}</span>}
            {infoReceita.natureza_juridica_descricao && (
              <span className="badge badge-gray">{infoReceita.natureza_juridica_descricao}</span>
            )}
            {regimeTributario && (
              <span
                className={`badge ${
                  regimeTributario === "Regime Normal"
                    ? "badge-gray"
                    : "bg-marinho-100 text-marinho-700"
                }`}
              >
                {regimeTributario}
              </span>
            )}
            {infoReceita.municipio && infoReceita.uf && (
              <span className="badge badge-gray">
                {infoReceita.municipio}/{infoReceita.uf}
              </span>
            )}
            {infoReceita.cnae_principal && (
              <span className="badge badge-gray">CNAE {infoReceita.cnae_principal}</span>
            )}
            {infoReceita.data_inicio_atividade && (
              <span className="badge badge-gray">
                Desde {new Date(infoReceita.data_inicio_atividade).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-4">
          <p className="section-label mb-1">
            Total recebido
          </p>
          <p className="text-xl font-bold text-slate-900">{BRL0.format(totalRecebido)}</p>
        </div>
        <div className="card p-4">
          <p className="section-label mb-1">
            Parlamentares
          </p>
          <p className="text-xl font-bold text-slate-900">{grupos.length}</p>
        </div>
        <div className="card p-4">
          <p className="section-label mb-1">
            Lançamentos
          </p>
          <p className="text-xl font-bold text-slate-900">{despesas.length}</p>
        </div>
      </div>

      {/* Dados da Receita Federal */}
      {infoReceita && (
        <>
          {/* Situação + Classificação */}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div className="card p-5">
              <p className="section-label mb-3">
                Situação
              </p>
              <dl className="space-y-3">
                {situacao && (
                  <div>
                    <dt className="text-xs text-slate-500 mb-0.5">Situação cadastral</dt>
                    <dd>
                      <span className={`badge ${situacao.cls}`}>{situacao.label}</span>
                      {infoReceita.data_situacao_cadastral && (
                        <span className="text-xs text-slate-500 ml-2">
                          desde{" "}
                          {new Date(infoReceita.data_situacao_cadastral).toLocaleDateString(
                            "pt-BR"
                          )}
                        </span>
                      )}
                      {infoReceita.motivo_situacao_cadastral && (
                        <p className="text-xs text-slate-500 mt-1">
                          {infoReceita.motivo_situacao_cadastral}
                        </p>
                      )}
                    </dd>
                  </div>
                )}
                {infoReceita.data_inicio_atividade && (
                  <div>
                    <dt className="text-xs text-slate-500 mb-0.5">Início de atividade</dt>
                    <dd className="text-sm text-slate-800">
                      {new Date(infoReceita.data_inicio_atividade).toLocaleDateString("pt-BR")}
                      <span className="text-slate-500 font-normal ml-1.5 text-xs">
                        ({idadeAnos(infoReceita.data_inicio_atividade)} anos)
                      </span>
                    </dd>
                  </div>
                )}
                {capitalSocial !== null && !isNaN(capitalSocial) && (
                  <div>
                    <dt className="text-xs text-slate-500 mb-0.5">Capital social</dt>
                    <dd className="text-sm text-slate-800 font-mono">
                      {BRL0.format(capitalSocial)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="card p-5">
              <p className="section-label mb-3">
                Classificação
              </p>
              <dl className="space-y-3">
                {(infoReceita.natureza_juridica_descricao ||
                  infoReceita.natureza_juridica_codigo) && (
                  <div>
                    <dt className="text-xs text-slate-500 mb-0.5">Natureza jurídica</dt>
                    <dd className="text-sm text-slate-800">
                      {infoReceita.natureza_juridica_descricao ??
                        infoReceita.natureza_juridica_codigo}
                      {infoReceita.natureza_juridica_codigo &&
                        infoReceita.natureza_juridica_descricao && (
                          <span className="text-xs text-slate-500 ml-1.5">
                            ({infoReceita.natureza_juridica_codigo})
                          </span>
                        )}
                    </dd>
                  </div>
                )}
                {porte && (
                  <div>
                    <dt className="text-xs text-slate-500 mb-0.5">Porte</dt>
                    <dd className="text-sm text-slate-800">{porte}</dd>
                  </div>
                )}
                {regimeTributario && (
                  <div>
                    <dt className="text-xs text-slate-500 mb-0.5">Regime tributário</dt>
                    <dd className="text-sm text-slate-800">{regimeTributario}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Endereço */}
          {temEndereco && (
            <div className="card p-5 mb-4">
              <p className="section-label mb-2">
                Endereço
              </p>
              <p className="text-sm text-slate-700">
                {[infoReceita.logradouro, infoReceita.numero].filter(Boolean).join(", ")}
                {infoReceita.bairro ? ` — ${infoReceita.bairro}` : ""}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                {[infoReceita.municipio, infoReceita.uf].filter(Boolean).join("/")}
                {infoReceita.cep ? ` · CEP ${formatCep(infoReceita.cep)}` : ""}
              </p>
            </div>
          )}

          {/* CNAEs */}
          {temCnaes && (
            <div className="card p-5 mb-4">
              <p className="section-label mb-3">
                Atividades (CNAE)
              </p>
              <div className="space-y-2">
                {infoReceita.cnae_principal && (
                  <div className="flex items-baseline gap-3">
                    <span className="badge badge-gray text-xs flex-shrink-0 w-16 text-center">
                      Principal
                    </span>
                    <span className="text-sm text-slate-700">
                      <span className="font-mono">{infoReceita.cnae_principal}</span>
                      {infoReceita.cnae_principal_descricao && (
                        <span className="text-slate-500 ml-2">
                          {infoReceita.cnae_principal_descricao}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {(infoReceita.cnae_secundarios ?? []).map((c) => (
                  <div key={c.codigo} className="flex items-baseline gap-3">
                    <span className="text-xs text-slate-500 flex-shrink-0 w-16 text-right">
                      Sec.
                    </span>
                    <span className="text-sm">
                      <span className="font-mono text-slate-600">{c.codigo}</span>
                      {c.descricao && (
                        <span className="text-slate-500 ml-2 text-xs">{c.descricao}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rodapé Receita */}
          {infoReceita.enriched_at && (
            <p className="text-xs text-slate-500 text-right mt-1 mb-8">
              Dados da Receita Federal atualizados em{" "}
              {new Date(infoReceita.enriched_at).toLocaleDateString("pt-BR")}
            </p>
          )}
        </>
      )}

      {/* Quadro societário */}
      {socios.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="section-label">
              Quadro societário ({socios.length})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold">
                    Sócio
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold hidden sm:table-cell">
                    Qualificação
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold hidden sm:table-cell">
                    Entrada
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold hidden md:table-cell">
                    Faixa etária
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {socios.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{s.nome ?? "—"}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {TIPO_SOCIO[s.identificador_socio ?? ""] ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                      {s.qualificacao_descricao ?? s.qualificacao_codigo ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell whitespace-nowrap">
                      {s.data_entrada_sociedade
                        ? new Date(s.data_entrada_sociedade).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                      {FAIXA_ETARIA[s.faixa_etaria ?? ""] ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Histórico por ano */}
      <div className="card p-5 mb-6">
        <p className="section-label mb-4">
          Histórico por ano
        </p>
        <div className="space-y-2.5">
          {anos.map(([ano, total]) => {
            const pct = Math.round((total / maiorAno) * 100);
            return (
              <div key={ano} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 font-mono w-10 flex-shrink-0">{ano}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: "#1a4690" }}
                  />
                </div>
                <span className="text-sm font-mono text-slate-700 w-32 text-right flex-shrink-0">
                  {BRL0.format(total)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Acordeão de parlamentares */}
      <ParlamentaresFornecedor grupos={grupos} />

      <p className="text-xs text-slate-500 text-center pt-6">
        Dados da Cota para Exercício da Atividade Parlamentar (CEAP) —
        Câmara dos Deputados e Senado Federal. Fonte oficial. Atualizado periodicamente.
      </p>
    </main>
  );
}
