"""
Ingestão de presença de senadores — API de Dados Abertos do Senado Federal.

Fontes:
  1. /plenario/lista/tiposComparecimento — tabela de domínio dos códigos de comparecimento
  2. /senador/lista/atual                — cadastro de senadores em exercício (dimensão)
  3. /votacao?dataInicio=...&dataFim=... — votações nominais com votos individuais

Tabelas de destino (ver db/schema_presenca.sql):
  tipo_comparecimento_senado, votacao_senado, voto_senado

Uso:
  python ingestao_presenca_senadores.py
  DATA_INICIO=2026-07-01 DATA_FIM=2026-07-22 python ingestao_presenca_senadores.py

Variáveis de ambiente:
  DATABASE_URL  — string de conexão Postgres (obrigatória)
  DATA_INICIO   — AAAA-MM-DD (padrão: 30 dias atrás; máx. intervalo: 1 ano)
  DATA_FIM      — AAAA-MM-DD (padrão: hoje)
  USE_CACHE     — 0 para forçar re-download (padrão: 1)

Nota sobre votacaoSecreta=true: a API não expõe votos individuais nesses casos.
O script registra a votação explicitamente com esse flag — não trata como dado ausente.
"""

import os
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn
from lib.http import get_json
from lib.senado_decode import ensure_list

BASE = "https://legis.senado.leg.br/dadosabertos"
USE_CACHE = os.environ.get("USE_CACHE", "1") != "0"

# Mapeamento estático sigla → categoria.
# Categorias que chegarem pela tabela de domínio mas não estiverem aqui
# são inferidas pela descrição textual via _inferir_categoria().
_CATEGORIA_ESTATICA: dict[str, str] = {
    # ── Siglas oficiais (campo Sigla da tabela de domínio) ────────────────────
    # Presente e votou
    "VO":    "presente_votou",
    # Presente sem votar
    "PSF":   "presente_sem_voto",
    "SF":    "presente_sem_voto",
    "P-NRV": "presente_sem_voto",
    "PNRV":  "presente_sem_voto",
    "P-OD":  "presente_sem_voto",
    "P-MV":  "presente_sem_voto",
    # Ausente justificado
    "LS":    "ausente_justificado",
    "L1":    "ausente_justificado",
    "L2":    "ausente_justificado",
    "L3":    "ausente_justificado",
    "LA":    "ausente_justificado",
    "LGE":   "ausente_justificado",
    "LPC":   "ausente_justificado",
    "LMF":   "ausente_justificado",
    "LEI":   "ausente_justificado",
    "LUT":   "ausente_justificado",
    "AFO":   "ausente_justificado",
    "AP":    "ausente_justificado",
    "DJ":    "ausente_justificado",
    "GR":    "ausente_justificado",
    "MIS":   "ausente_justificado",
    "REP":   "ausente_justificado",
    "FAM":   "ausente_justificado",
    "CAL":   "ausente_justificado",
    "MCM":   "ausente_justificado",
    # Ausente não justificado
    "NCom":  "ausente_nao_justificado",
    "NCOM":  "ausente_nao_justificado",
    "AUS":   "ausente_nao_justificado",
    "NJ":    "ausente_nao_justificado",

    # ── Votos literais (retornados diretamente em siglaVotoParlamentar) ────────
    # A API usa o valor do voto como "sigla" em vez do código curto oficial.
    "Sim":        "presente_votou",   # votou a favor
    "Não":        "presente_votou",   # votou contra (presente e votante)
    "Abstenção":  "presente_votou",   # se absteve — presente e votante pelo RISF

    # ── Licenças e ausências justificadas adicionais ──────────────────────────
    "LP":   "ausente_justificado",    # Licença Particular
    "LAP":  "ausente_justificado",    # Licença por Atividade Parlamentar
    "NA":   "ausente_nao_justificado", # Dispositivo não citado — residual

    # ── Presidência da sessão ─────────────────────────────────────────────────
    # Art. 51 RISF: o Presidente só vota em caso de empate — presente mas não votante
    "Presidente (art. 51 RISF)": "presente_sem_voto",

    # ── Textos de descrição retornados no campo siglaVotoParlamentar ─────────
    # A API do Senado frequentemente retorna a DESCRIÇÃO neste campo em vez do
    # código curto. Ex: "Votou" em vez de "VO", "Não Compareceu" em vez de "NCom".
    "Votou":                            "presente_votou",
    "Presente no Senado Federal":       "presente_sem_voto",
    "Presente - Não Registrou Voto":    "presente_sem_voto",
    "Presente - Obstrução":             "presente_sem_voto",
    "Presente - Mudança de Voto":       "presente_sem_voto",
    "Não Compareceu":                   "ausente_nao_justificado",
    "Ausente":                          "ausente_nao_justificado",
    "Licença saúde":                    "ausente_justificado",
    "Licença":                          "ausente_justificado",
    "Atividade parlamentar":            "ausente_justificado",
    "Missão da Casa no País/exterior":  "ausente_justificado",
    "Afastamento por doença":           "ausente_justificado",
    "Luto":                             "ausente_justificado",
    "Gestação/Adoção":                  "ausente_justificado",
    "Missão autorizada":                "ausente_justificado",
}


def _inferir_categoria(descricao: str) -> str:
    """Fallback para siglas não presentes no mapeamento estático."""
    d = descricao.upper()
    if "VOTOU" in d or "VOTE" in d:
        return "presente_votou"
    if "PRESENTE" in d:
        return "presente_sem_voto"
    if any(kw in d for kw in ("LICENÇA", "MISSÃO", "ATIVIDADE", "SAÚDE", "AFASTA")):
        return "ausente_justificado"
    if any(kw in d for kw in ("NÃO COMPAREC", "AUSENTE", "NÃO JUSTIF")):
        return "ausente_nao_justificado"
    return "ausente_nao_justificado"  # conservador — melhor não inventar presença


# ─── Persistência ────────────────────────────────────────────────────────────


def _upsert_tipo_comparecimento(conn, t: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tipo_comparecimento_senado (sigla, descricao, categoria)
            VALUES (%(sigla)s, %(descricao)s, %(categoria)s)
            ON CONFLICT (sigla) DO UPDATE SET
              descricao = EXCLUDED.descricao,
              categoria = COALESCE(EXCLUDED.categoria,
                                   tipo_comparecimento_senado.categoria)
            """,
            t,
        )


def _upsert_votacao(conn, v: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO votacao_senado
              (codigo_sessao_votacao, codigo_sessao, data_sessao, casa_sessao,
               codigo_materia, id_processo, identificacao, descricao_votacao,
               resultado_votacao, total_votos_sim, total_votos_nao,
               total_votos_abstencao, votacao_secreta)
            VALUES
              (%(codigo_sessao_votacao)s, %(codigo_sessao)s, %(data_sessao)s,
               %(casa_sessao)s, %(codigo_materia)s, %(id_processo)s,
               %(identificacao)s, %(descricao_votacao)s, %(resultado_votacao)s,
               %(total_votos_sim)s, %(total_votos_nao)s, %(total_votos_abstencao)s,
               %(votacao_secreta)s)
            ON CONFLICT (codigo_sessao_votacao) DO UPDATE SET
              resultado_votacao     = EXCLUDED.resultado_votacao,
              total_votos_sim       = EXCLUDED.total_votos_sim,
              total_votos_nao       = EXCLUDED.total_votos_nao,
              total_votos_abstencao = EXCLUDED.total_votos_abstencao,
              fetched_at            = NOW()
            """,
            v,
        )


def _upsert_voto(conn, v: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO voto_senado
              (codigo_sessao_votacao, codigo_parlamentar, nome_parlamentar,
               partido, uf, sexo, sigla_voto, descricao_voto, categoria_presenca)
            VALUES
              (%(codigo_sessao_votacao)s, %(codigo_parlamentar)s, %(nome_parlamentar)s,
               %(partido)s, %(uf)s, %(sexo)s, %(sigla_voto)s, %(descricao_voto)s,
               %(categoria_presenca)s)
            ON CONFLICT (codigo_sessao_votacao, codigo_parlamentar) DO UPDATE SET
              sigla_voto         = EXCLUDED.sigla_voto,
              categoria_presenca = EXCLUDED.categoria_presenca,
              fetched_at         = NOW()
            """,
            v,
        )


# ─── Fetch ────────────────────────────────────────────────────────────────────


def fetch_tipos_comparecimento() -> list[dict]:
    """
    Carrega a tabela de domínio de tipos de comparecimento.
    A API retorna estrutura XML-like aninhada mesmo com Accept: application/json.
    """
    try:
        data = get_json(f"{BASE}/plenario/lista/tiposComparecimento", use_cache=USE_CACHE)
        return _extrair_lista(data, chaves_alvo=["TipoComparecimento", "tipoComparecimento"])
    except Exception as exc:
        print(f"AVISO tipos_comparecimento: {exc}")
        return []


def fetch_senadores_atuais() -> list[dict]:
    """Cadastro de senadores em exercício para log e auditoria."""
    try:
        data = get_json(f"{BASE}/senador/lista/atual", use_cache=USE_CACHE)
        return _extrair_lista(data, chaves_alvo=["Parlamentar", "parlamentar"])
    except Exception as exc:
        print(f"AVISO senadores_atuais: {exc}")
        return []


def fetch_votacoes_senado(data_inicio: str, data_fim: str) -> list[dict]:
    """
    Busca votações no período (máx 1 ano por chamada, conforme docs da API).
    Cada item retornado já contém o array 'votos' com votos individuais.
    """
    try:
        data = get_json(
            f"{BASE}/votacao",
            {"dataInicio": data_inicio, "dataFim": data_fim},
            use_cache=USE_CACHE,
            pause=0.3,
        )
        return _extrair_lista(data, chaves_alvo=["Votacao", "votacao", "Votacoes"])
    except Exception as exc:
        print(f"AVISO /votacao [{data_inicio} a {data_fim}]: {exc}")
        return []


def _extrair_lista(data, chaves_alvo: list[str] | None = None) -> list:
    """
    Navega recursivamente na estrutura de resposta do Senado (JSON aninhado
    derivado de XML) e retorna a primeira lista com elementos relevantes.

    Lida com as variações comuns da API:
    - Lista direta no topo: [...]
    - Chave com lista: {"Votacao": [...]}
    - Chave com dict aninhado: {"Votacoes": {"Votacao": [...]}}  ← bug anterior
    """
    if isinstance(data, list):
        return data
    if not isinstance(data, dict):
        return []

    # Tenta chaves preferenciais primeiro
    for chave in (chaves_alvo or []):
        if chave in data:
            val = data[chave]
            if isinstance(val, list):
                return val
            if isinstance(val, dict):
                # Pode ser {"Votacoes": {"Votacao": [...]}} — desce mais um nível
                # antes de embrulhar em lista
                result = _extrair_lista(val, chaves_alvo)
                if result:
                    return result
                return [val]  # fallback: trata o dict como item único

    # Busca recursiva por qualquer lista não vazia
    for val in data.values():
        if isinstance(val, list) and val:
            return val
        if isinstance(val, dict):
            result = _extrair_lista(val, chaves_alvo)
            if result:
                return result

    return []


def _extrair_votos(vot: dict) -> list[dict]:
    """
    Extrai o array de votos de uma votação.

    Trata duas estruturas possíveis da API:
    - JSON plano:   {"votos": [...]}
    - XML aninhado: {"Votos": {"Voto": [...]}}  (xmltodict 1 nível a mais)
    """
    for chave_outer in ("votos", "Votos", "VotosParlamentares"):
        val = vot.get(chave_outer)
        if val is None:
            continue
        if isinstance(val, list):
            return val
        if isinstance(val, dict):
            # Nível extra de XML: {"Votos": {"Voto": [...]}} ou {"Votos": {...}} (1 voto)
            for chave_inner in ("Voto", "voto"):
                inner = val.get(chave_inner)
                if inner is not None:
                    return ensure_list(inner)
    return []


def _parse_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "1", "sim", "s")
    return bool(val)


# ─── Processamento ────────────────────────────────────────────────────────────


def ingerir_dimensoes(conn) -> dict[str, str]:
    """
    Persiste a tabela de tipos de comparecimento e devolve o mapa
    sigla → categoria para uso na ingestão de votos.
    """
    tipos = fetch_tipos_comparecimento()
    print(f"-> {len(tipos)} tipos de comparecimento carregados")

    mapa: dict[str, str] = {}
    for t in tipos:
        sigla = (t.get("Sigla") or t.get("sigla") or "").strip()
        descricao = (t.get("Descricao") or t.get("descricao") or "").strip()
        if not sigla:
            continue
        categoria = _CATEGORIA_ESTATICA.get(sigla) or _inferir_categoria(descricao)
        mapa[sigla] = categoria
        _upsert_tipo_comparecimento(conn, {
            "sigla": sigla,
            "descricao": descricao,
            "categoria": categoria,
        })

    conn.commit()
    return mapa


def processar_votacoes(conn, data_inicio: str, data_fim: str, mapa_categoria: dict) -> None:
    """Persiste votações e votos individuais do Senado no período."""
    votacoes = fetch_votacoes_senado(data_inicio, data_fim)
    print(f"-> {len(votacoes)} votações no período {data_inicio} a {data_fim}")

    siglas_desconhecidas: set[str] = set()

    for vot in votacoes:
        # Normaliza chaves (API pode retornar camelCase ou PascalCase)
        cod_vot = (
            vot.get("codigoSessaoVotacao")
            or vot.get("CodigoSessaoVotacao")
        )
        if cod_vot is None:
            continue

        try:
            cod_vot = int(cod_vot)
        except (TypeError, ValueError):
            print(f"  AVISO codigoSessaoVotacao invalido: {cod_vot!r}")
            continue

        secreta = _parse_bool(
            vot.get("votacaoSecreta") or vot.get("VotacaoSecreta", False)
        )

        _upsert_votacao(conn, {
            "codigo_sessao_votacao": cod_vot,
            "codigo_sessao":         vot.get("codigoSessao") or vot.get("CodigoSessao"),
            "data_sessao":           vot.get("dataSessao") or vot.get("DataSessao"),
            "casa_sessao":           vot.get("casaSessao") or vot.get("CasaSessao"),
            "codigo_materia":        vot.get("codigoMateria") or vot.get("CodigoMateria"),
            "id_processo":           vot.get("idProcesso") or vot.get("IdProcesso"),
            "identificacao":         vot.get("identificacao") or vot.get("Identificacao"),
            "descricao_votacao":     vot.get("descricaoVotacao") or vot.get("DescricaoVotacao"),
            "resultado_votacao":     vot.get("resultadoVotacao") or vot.get("ResultadoVotacao"),
            "total_votos_sim":       vot.get("totalVotosSim") or vot.get("TotalVotosSim"),
            "total_votos_nao":       vot.get("totalVotosNao") or vot.get("TotalVotosNao"),
            "total_votos_abstencao": vot.get("totalVotosAbstencao") or vot.get("TotalVotosAbstencao"),
            "votacao_secreta":       secreta,
        })

        if secreta:
            # Votação secreta: API não expõe votos individuais por design
            print(f"  votacao secreta {cod_vot} — sem votos individuais (registrado)")
            conn.commit()
            continue

        votos = _extrair_votos(vot)
        for v in votos:
            sigla = (
                v.get("siglaVotoParlamentar")
                or v.get("SiglaVotoParlamentar")
                or ""
            ).strip()
            # Ordem de lookup:
            # 1. mapa_categoria  — construído da tabela de domínio da API
            # 2. _CATEGORIA_ESTATICA — cobre siglas ausentes da API (ex: AP, NCom, Sim, Não)
            # 3. _inferir_categoria(sigla) — inferência textual (ex: "Votou", "Presente...")
            # 4. _inferir_categoria(descricao) — último recurso com o campo descrição
            categoria = mapa_categoria.get(sigla) or _CATEGORIA_ESTATICA.get(sigla)
            if not categoria:
                siglas_desconhecidas.add(sigla)
                descricao_voto = (
                    v.get("descricaoVotoParlamentar")
                    or v.get("DescricaoVotoParlamentar")
                    or ""
                )
                categoria = _inferir_categoria(sigla) or _inferir_categoria(descricao_voto)

            cod_parl = v.get("codigoParlamentar") or v.get("CodigoParlamentar")
            try:
                cod_parl = int(cod_parl) if cod_parl is not None else None
            except (TypeError, ValueError):
                cod_parl = None

            _upsert_voto(conn, {
                "codigo_sessao_votacao": cod_vot,
                "codigo_parlamentar":    cod_parl,
                "nome_parlamentar":      v.get("nomeParlamentar") or v.get("NomeParlamentar"),
                "partido":               v.get("siglaPartidoParlamentar") or v.get("SiglaPartidoParlamentar"),
                "uf":                    v.get("siglaUFParlamentar") or v.get("SiglaUFParlamentar"),
                "sexo":                  v.get("sexoParlamentar") or v.get("SexoParlamentar"),
                "sigla_voto":            sigla or None,
                "descricao_voto":        v.get("descricaoVotoParlamentar") or v.get("DescricaoVotoParlamentar"),
                "categoria_presenca":    categoria,
            })

        ident = vot.get("identificacao") or vot.get("Identificacao") or str(cod_vot)
        print(f"  votacao {cod_vot} [{ident}]: {len(votos)} votos")
        conn.commit()

    if siglas_desconhecidas:
        print(
            f"\nAVISO: {len(siglas_desconhecidas)} sigla(s) nao mapeada(s) — "
            f"categoria inferida por texto: {sorted(siglas_desconhecidas)}\n"
            "Considere adicionar ao _CATEGORIA_ESTATICA ou re-executar "
            "com USE_CACHE=0 para atualizar a tabela de domínio."
        )


def main() -> None:
    data_inicio = os.environ.get("DATA_INICIO", str(date.today() - timedelta(days=30)))
    data_fim = os.environ.get("DATA_FIM", str(date.today()))

    print(f"=== Ingestao presenca Senado: {data_inicio} a {data_fim} ===")

    with get_conn() as conn:
        mapa_categoria = ingerir_dimensoes(conn)
        processar_votacoes(conn, data_inicio, data_fim, mapa_categoria)

    print("=== Senado presenca: ingestao concluida ===")


if __name__ == "__main__":
    main()
