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
