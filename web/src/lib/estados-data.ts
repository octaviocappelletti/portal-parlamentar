export type Regiao = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";

export interface EstadoMeta {
  uf: string;
  nome: string;
  regiao: Regiao;
}

export const REGIOES: Record<
  Regiao,
  { bg: string; hover: string; border: string; text: string }
> = {
  Norte:          { bg: "#dbeafe", hover: "#bfdbfe", border: "#93c5fd", text: "#1e40af" },
  Nordeste:       { bg: "#d1fae5", hover: "#a7f3d0", border: "#6ee7b7", text: "#065f46" },
  "Centro-Oeste": { bg: "#fef9c3", hover: "#fef08a", border: "#fde047", text: "#854d0e" },
  Sudeste:        { bg: "#ede9fe", hover: "#ddd6fe", border: "#c4b5fd", text: "#5b21b6" },
  Sul:            { bg: "#cffafe", hover: "#a5f3fc", border: "#67e8f9", text: "#155e75" },
};

export const ESTADOS_META: EstadoMeta[] = [
  { uf: "AC", nome: "Acre",                  regiao: "Norte"         },
  { uf: "AL", nome: "Alagoas",               regiao: "Nordeste"      },
  { uf: "AM", nome: "Amazonas",              regiao: "Norte"         },
  { uf: "AP", nome: "Amapá",                regiao: "Norte"         },
  { uf: "BA", nome: "Bahia",                 regiao: "Nordeste"      },
  { uf: "CE", nome: "Ceará",                regiao: "Nordeste"      },
  { uf: "DF", nome: "Distrito Federal",      regiao: "Centro-Oeste"  },
  { uf: "ES", nome: "Espírito Santo",       regiao: "Sudeste"       },
  { uf: "GO", nome: "Goiás",                regiao: "Centro-Oeste"  },
  { uf: "MA", nome: "Maranhão",             regiao: "Nordeste"      },
  { uf: "MG", nome: "Minas Gerais",         regiao: "Sudeste"       },
  { uf: "MS", nome: "Mato Grosso do Sul",   regiao: "Centro-Oeste"  },
  { uf: "MT", nome: "Mato Grosso",          regiao: "Centro-Oeste"  },
  { uf: "PA", nome: "Pará",                 regiao: "Norte"         },
  { uf: "PB", nome: "Paraíba",             regiao: "Nordeste"      },
  { uf: "PE", nome: "Pernambuco",           regiao: "Nordeste"      },
  { uf: "PI", nome: "Piauí",               regiao: "Nordeste"      },
  { uf: "PR", nome: "Paraná",              regiao: "Sul"           },
  { uf: "RJ", nome: "Rio de Janeiro",       regiao: "Sudeste"       },
  { uf: "RN", nome: "Rio Grande do Norte",  regiao: "Nordeste"      },
  { uf: "RO", nome: "Rondônia",            regiao: "Norte"         },
  { uf: "RR", nome: "Roraima",              regiao: "Norte"         },
  { uf: "RS", nome: "Rio Grande do Sul",    regiao: "Sul"           },
  { uf: "SC", nome: "Santa Catarina",       regiao: "Sul"           },
  { uf: "SE", nome: "Sergipe",              regiao: "Nordeste"      },
  { uf: "SP", nome: "São Paulo",            regiao: "Sudeste"       },
  { uf: "TO", nome: "Tocantins",            regiao: "Norte"         },
];

export const META_BY_UF = Object.fromEntries(
  ESTADOS_META.map((e) => [e.uf, e]),
) as Record<string, EstadoMeta>;
