export type Casa = "camara" | "senado";

export interface Parlamentar {
  id: number;
  casa: Casa;
  id_externo: number;
  nome: string;
  nome_civil?: string;
  partido?: string;
  uf?: string;
  foto_url?: string;
  data_nascimento?: string;
  situacao?: string;
  redes_sociais?: string[];
  website?: string;
}

export interface ParlamentarOrgao {
  id: number;
  parlamentar_id: number;
  id_orgao: number;
  nome_orgao?: string;
  sigla_orgao?: string;
  titulo?: string;
  cod_titulo?: string;
  data_inicio?: string;
  data_fim?: string | null;
}

export interface Mandato {
  id: number;
  parlamentar_id: number;
  legislatura: number;
  data_inicio?: string;
  data_fim?: string;
}

export interface Proposicao {
  id: number;
  parlamentar_id: number;
  casa: Casa;
  tipo: string;
  numero: number;
  ano: number;
  ementa?: string;
  autor_principal?: boolean;
  situacao?: string;
  aprovada?: boolean;
  data_apresentacao?: string;
  url_inteiro_teor?: string;
}

export interface Despesa {
  id: number;
  parlamentar_id: number;
  ano: number;
  mes: number;
  natureza?: string;
  fornecedor?: string;
  cpf_cnpj?: string;
  valor_liquido?: number;
  valor_glosa?: number;
  url_documento?: string;
  detalhamento?: string;
  documento?: string;
}

export interface CnaeItem {
  codigo: string;
  descricao: string;
}

export interface Fornecedor {
  id: number;
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  motivo_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  cnae_principal?: string;
  cnae_principal_descricao?: string;
  cnae_secundarios?: CnaeItem[];
  natureza_juridica_codigo?: string;
  natureza_juridica_descricao?: string;
  porte_empresa?: string;
  capital_social?: string;
  opcao_simples?: boolean;
  opcao_mei?: boolean;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  enriched_at?: string;
}

export interface FornecedorSocio {
  id: number;
  fornecedor_cnpj: string;
  nome?: string;
  identificador_socio?: string;  // '1'=PJ  '2'=PF  '3'=Estrangeiro
  qualificacao_codigo?: string;
  qualificacao_descricao?: string;
  data_entrada_sociedade?: string;
  faixa_etaria?: string;
  cpf_representante_legal?: string;
}

/** Linha da view voto_camara_enriquecido — votação nominal + dados do evento. */
export interface VotoCamaraEnriquecido {
  votacao_id: string;
  id_deputado: number;
  nome?: string;
  partido?: string;
  uf?: string;
  tipo_voto?: string | null;
  status_presenca?: string | null;
  data_hora?: string | null;
  descricao_votacao?: string | null;
  sigla_orgao?: string | null;
  aprovacao?: string | null;
}

/** Linha da view voto_senado_enriquecido — votação nominal + dados da sessão. */
export interface VotoSenadoEnriquecido {
  codigo_sessao_votacao: number;
  codigo_parlamentar: number;
  nome_parlamentar?: string;
  partido?: string;
  uf?: string;
  sigla_voto?: string | null;
  descricao_voto?: string | null;
  categoria_presenca?: string | null;
  data_sessao?: string | null;
  identificacao?: string | null;
  descricao_votacao?: string | null;
  resultado_votacao?: string | null;
}

/** Linha da view despesa_resumo_ano — carregada em SSR para montar a timeline. */
export interface DespesaResumoAno {
  parlamentar_id: number;
  ano: number;
  total: number;        // SUM(valor_liquido)::FLOAT8
  lancamentos: number;  // COUNT(*)::INT
}
