"""
Ingestão de redes sociais e órgãos dos senadores federais.

Fontes:
  GET /senador/{cod}           (XML, cacheado) → UrlPaginaParticular
  GET /senador/{cod}/comissoes (JSON)          → comissões permanentes e especiais
  GET /senador/{cod}/cargos    (JSON)          → frentes parlamentares e outros cargos
  GET /senador/{cod}/liderancas (JSON)         → lideranças partidárias/de blocos

Estratégia de armazenamento:
  - UrlPaginaParticular → redes_sociais[0] (detecção de plataforma no front)
  - Órgãos: REPLACE por senador (DELETE + INSERT) — reflete estado atual da API
  - Idempotente: pode ser re-executado sem duplicar dados

Observações da API do Senado:
  - Três endpoints separados por tipo de vínculo (não há um endpoint único de "órgãos")
  - Endpoints aceitam ?formato=json mas mantêm nomes de chave em CamelCase (como no XML)
  - Datas podem vir como None quando o vínculo ainda está ativo
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn, replace_parlamentar_orgaos, update_parlamentar_social
from lib.http import get_json, get_xml
from lib.senado_decode import ensure_list, xml_to_dict

BASE = "https://legis.senado.leg.br/dadosabertos"
USE_CACHE = os.environ.get("USE_CACHE", "1") != "0"

# Imprime o JSON bruto do primeiro senador de cada endpoint para diagnóstico.
# Defina DEBUG_FIRST=1 para ativar.
DEBUG_FIRST = os.environ.get("DEBUG_FIRST", "0") == "1"
_debug_done: set[str] = set()


def _dbg(tag: str, data) -> None:
    if DEBUG_FIRST and tag not in _debug_done:
        import json
        print(f"  [DEBUG {tag}] {json.dumps(data, ensure_ascii=False, default=str)[:800]}")
        _debug_done.add(tag)


def _parse_date(s: str | None) -> str | None:
    if not s or s in ("null", "None"):
        return None
    return str(s)[:10]


def _deep_list(obj, *path: str) -> list:
    """Navega um dict aninhado pelo caminho fornecido e retorna a lista encontrada."""
    cur = obj
    for key in path:
        if not isinstance(cur, dict):
            return []
        cur = cur.get(key)
        if cur is None:
            return []
    return ensure_list(cur)


# ── Página particular / redes sociais ────────────────────────────────────────

def fetch_pagina_particular(cod: int) -> str | None:
    """Extrai UrlPaginaParticular do detalhe XML (cacheado de ingestao_senadores.py)."""
    try:
        content = get_xml(f"{BASE}/senador/{cod}", use_cache=USE_CACHE)
        root = xml_to_dict(content)
        dados = (
            root.get("DetalheParlamentar", {})
                .get("Parlamentar", {})
                .get("IdentificacaoParlamentar", {})
        )
        url = dados.get("UrlPaginaParticular")
        return url if url and url.strip() else None
    except Exception as exc:
        print(f"    AVISO pagina_particular {cod}: {exc}")
        return None


# ── Comissões ─────────────────────────────────────────────────────────────────

def fetch_comissoes(cod: int) -> list[dict]:
    """
    GET /senador/{cod}/comissoes?formato=json
    Chave esperada: MembroComissaoParlamentar > Parlamentar > MembroComissoes > MembroComissao
    Campos por item: CodigoOrgao, SiglaOrgao, NomeOrgao, DescricaoParticipacao,
                     DescricaoTipoOrgao, DataInicio, DataFim
    """
    try:
        data = get_json(
            f"{BASE}/senador/{cod}/comissoes",
            {"formato": "json"},
            use_cache=USE_CACHE,
        )
        _dbg("comissoes", data)
    except Exception as exc:
        print(f"    AVISO comissoes {cod}: {exc}")
        return []

    items = _deep_list(
        data,
        "MembroComissaoParlamentar", "Parlamentar", "MembroComissoes", "MembroComissao",
    )

    result = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        cod_orgao = str(item.get("CodigoOrgao") or f"cm_{item.get('SiglaOrgao', cod)}_{i}")
        result.append({
            "id_orgao":    cod_orgao,
            "fonte":       "senado_comissoes",
            "nome_orgao":  item.get("NomeOrgao"),
            "sigla_orgao": item.get("SiglaOrgao"),
            "titulo":      item.get("DescricaoParticipacao"),
            "cod_titulo":  item.get("DescricaoTipoOrgao"),
            "data_inicio": _parse_date(item.get("DataInicio")),
            "data_fim":    _parse_date(item.get("DataFim")),
        })
    return result


# ── Cargos ────────────────────────────────────────────────────────────────────

def fetch_cargos(cod: int) -> list[dict]:
    """
    GET /senador/{cod}/cargos?formato=json
    Chave esperada: CargoParlamentar > Parlamentar > Cargos > Cargo
    Campos por item: CodigoOrgao, SiglaOrgao, NomeOrgao, NomeCargo, DataInicio, DataFim
    """
    try:
        data = get_json(
            f"{BASE}/senador/{cod}/cargos",
            {"formato": "json"},
            use_cache=USE_CACHE,
        )
        _dbg("cargos", data)
    except Exception as exc:
        print(f"    AVISO cargos {cod}: {exc}")
        return []

    items = _deep_list(data, "CargoParlamentar", "Parlamentar", "Cargos", "Cargo")

    result = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        sigla = item.get("SiglaOrgao") or ""
        nome_cargo = item.get("NomeCargo") or ""
        cod_orgao = str(item.get("CodigoOrgao") or f"cargo_{sigla}_{nome_cargo}_{i}")
        result.append({
            "id_orgao":    cod_orgao,
            "fonte":       "senado_cargos",
            "nome_orgao":  item.get("NomeOrgao"),
            "sigla_orgao": sigla,
            "titulo":      nome_cargo,
            "cod_titulo":  None,
            "data_inicio": _parse_date(item.get("DataInicio")),
            "data_fim":    _parse_date(item.get("DataFim")),
        })
    return result


# ── Lideranças ────────────────────────────────────────────────────────────────

def fetch_liderancas(cod: int) -> list[dict]:
    """
    GET /senador/{cod}/liderancas?formato=json
    Chave esperada: LiderancaParlamentar > Parlamentar > Liderancas > Lideranca
    Campos por item: DescricaoTipoLideranca, SiglaBlocoParlamentar/SiglaPartido,
                     NomeBlocoParlamentar/NomePartido, DataInicio, DataFim
    """
    try:
        data = get_json(
            f"{BASE}/senador/{cod}/liderancas",
            {"formato": "json"},
            use_cache=USE_CACHE,
        )
        _dbg("liderancas", data)
    except Exception as exc:
        print(f"    AVISO liderancas {cod}: {exc}")
        return []

    items = _deep_list(data, "LiderancaParlamentar", "Parlamentar", "Liderancas", "Lideranca")

    result = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        sigla = (
            item.get("SiglaBlocoParlamentar")
            or item.get("SiglaPartido")
            or ""
        )
        nome_partido = (
            item.get("NomeBlocoParlamentar")
            or item.get("NomePartido")
            or sigla
        )
        tipo_lid = item.get("DescricaoTipoLideranca") or ""
        result.append({
            "id_orgao":    f"lid_{sigla}_{tipo_lid}_{i}",
            "fonte":       "senado_liderancas",
            "nome_orgao":  nome_partido or None,
            "sigla_orgao": sigla or None,
            "titulo":      tipo_lid or None,
            "cod_titulo":  None,
            "data_inicio": _parse_date(item.get("DataInicio")),
            "data_fim":    _parse_date(item.get("DataFim")),
        })
    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, id_externo, nome FROM parlamentar WHERE casa = 'senado' ORDER BY nome"
            )
            senadores = cur.fetchall()

    print(f"-> {len(senadores)} senadores a processar")

    with get_conn() as conn:
        for parl_id, cod, nome in senadores:
            print(f"  {cod} {nome}")

            # ── Página particular / rede social ────────────────────────────────
            url_pp = fetch_pagina_particular(cod)
            redes = [url_pp] if url_pp else []
            try:
                update_parlamentar_social(conn, parl_id, redes, website=None)
                if url_pp:
                    print(f"    pagina_particular: {url_pp}")
            except Exception as exc:
                print(f"    ERRO social: {exc}")

            # ── Órgãos (3 endpoints) ───────────────────────────────────────────
            try:
                comissoes  = fetch_comissoes(cod)
                cargos     = fetch_cargos(cod)
                liderancas = fetch_liderancas(cod)

                todos_orgaos = [
                    {**o, "parlamentar_id": parl_id}
                    for o in (comissoes + cargos + liderancas)
                ]

                replace_parlamentar_orgaos(conn, parl_id, todos_orgaos)
                print(
                    f"    orgaos: {len(comissoes)} comissoes "
                    f"| {len(cargos)} cargos "
                    f"| {len(liderancas)} liderancas"
                )
            except Exception as exc:
                print(f"    ERRO orgaos: {exc}")

            conn.commit()

    print("Social + órgãos Senado: ingestão concluída.")


if __name__ == "__main__":
    main()
