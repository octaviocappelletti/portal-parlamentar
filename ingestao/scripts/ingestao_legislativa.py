"""
Ingestão de deputados e proposições da Câmara (API v2).

Workarounds aplicados:
  §6.1  — codSituacao ignorado com idDeputadoAutor: buscar lista sem filtro + detalhe individual
  §6.2  — status ausente na lista: 1 chamada /proposicoes/{id} por proposição
  §6.3  — CPF só em /deputados/{id}: percorrer individualmente
  §6.5  — 504 ao paginar por UF: baixar tudo sem filtro, filtrar em memória
  §6.6  — autoria principal: /proposicoes/{id}/autores, ordemAssinatura==1 ou proponente==true
"""

import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn, upsert_mandato, upsert_parlamentar, upsert_proposicao
from lib.http import get_json

BASE = "https://dadosabertos.camara.leg.br/api/v2"
LEG = int(os.environ.get("LEGISLATURA_CAMARA", "57"))

# Código de situação: aprovada (§6.1)
COD_APROVADA = {1140}
COD_ARQUIVADA = {923, 930, 931, 941, 950, 1285, 1292}

TIPOS_PROPOSICAO = ["PL", "PLP", "PEC", "PDL"]


def _classifica_situacao(cod: int | None) -> tuple[str, bool]:
    if cod in COD_APROVADA:
        return "aprovada", True
    if cod in COD_ARQUIVADA:
        return "arquivada", False
    return "em tramitacao", False


def fetch_deputados() -> list[dict]:
    """Baixa todos os deputados da legislatura sem filtro de UF (§6.5)."""
    deputados = []
    pagina = 1
    while True:
        data = get_json(f"{BASE}/deputados", {"idLegislatura": LEG, "pagina": pagina, "itens": 100})
        batch = data.get("dados", [])
        if not batch:
            break
        deputados.extend(batch)
        pagina += 1
    print(f"-> {len(deputados)} deputados na legislatura {LEG}")
    return deputados


def enrich_deputado(dep: dict) -> dict:
    """Busca CPF, situação e detalhes adicionais (§6.3)."""
    detail = get_json(f"{BASE}/deputados/{dep['id']}")
    d = detail.get("dados", {})
    ultimo_status = d.get("ultimoStatus", {})
    return {
        "casa": "camara",
        "id_externo": dep["id"],
        "nome": dep.get("nome"),
        "nome_civil": d.get("nomeCivil"),
        "partido": dep.get("siglaPartido"),
        "uf": dep.get("siglaUf"),
        "foto_url": dep.get("urlFoto"),
        "cpf": d.get("cpf"),
        "data_nascimento": d.get("dataNascimento"),
        "situacao": ultimo_status.get("situacao"),
    }


def fetch_proposicoes_deputado(dep_id: int) -> list[dict]:
    """Lista proposições sem filtro de situação (§6.1) para todos os tipos relevantes."""
    proposicoes = []
    for tipo in TIPOS_PROPOSICAO:
        pagina = 1
        while True:
            data = get_json(
                f"{BASE}/proposicoes",
                {"idDeputadoAutor": dep_id, "siglaTipo": tipo, "pagina": pagina, "itens": 100},
            )
            batch = data.get("dados", [])
            if not batch:
                break
            proposicoes.extend(batch)
            pagina += 1
    return proposicoes


def enrich_proposicao(prop: dict, dep_interno_id: int) -> dict | None:
    """Busca status e autoria principal para uma proposição (§6.1, §6.2, §6.6)."""
    pid = prop["id"]

    detail_data = get_json(f"{BASE}/proposicoes/{pid}")
    detail = detail_data.get("dados", {})
    status = detail.get("statusProposicao", {})
    cod = status.get("codSituacao")
    cod = int(cod) if cod is not None else None
    situacao_str, aprovada = _classifica_situacao(cod)

    # Determina autoria principal (§6.6)
    autor_principal = False
    try:
        autores_data = get_json(f"{BASE}/proposicoes/{pid}/autores")
        for autor in autores_data.get("dados", []):
            if autor.get("proponente") or str(autor.get("ordemAssinatura", "")) == "1":
                # Verifica se é este deputado
                uri = autor.get("uri", "")
                if str(dep_interno_id) in uri.split("/")[-1]:
                    autor_principal = True
                    break
    except Exception:
        pass

    tipo = detail.get("siglaTipo") or prop.get("siglaTipo", "")
    # Normaliza PLS -> PL (§6.10)
    if tipo == "PLS":
        tipo = "PL"

    return {
        "parlamentar_id": None,  # preenchido pelo chamador
        "casa": "camara",
        "tipo": tipo,
        "numero": detail.get("numero") or prop.get("numero"),
        "ano": detail.get("ano") or prop.get("ano"),
        "ementa": detail.get("ementa"),
        "autor_principal": autor_principal,
        "situacao": situacao_str,
        "aprovada": aprovada,
        "data_apresentacao": detail.get("dataApresentacao", "")[:10] if detail.get("dataApresentacao") else None,
        "url_inteiro_teor": detail.get("urlInteiroTeor"),
        "_id_externo": pid,
    }


def main() -> None:
    deputados_raw = fetch_deputados()

    with get_conn() as conn:
        for dep in deputados_raw:
            enriched = enrich_deputado(dep)
            situacao = enriched.get("situacao")
            if situacao != "Exercício":
                print(f"  IGNORADO {dep['id']} {dep.get('nome', '')} — situacao: {situacao}")
                continue
            print(f"  deputado {dep['id']} {dep.get('nome', '')}")
            parl_id = upsert_parlamentar(conn, enriched)

            # Mandato
            upsert_mandato(conn, {
                "parlamentar_id": parl_id,
                "legislatura": LEG,
                "data_inicio": None,
                "data_fim": None,
            })

            # Proposições
            props_raw = fetch_proposicoes_deputado(dep["id"])
            print(f"    -> {len(props_raw)} proposicoes encontradas")

            # Enriquece em paralelo (max_workers=5 conforme §6.2)
            with ThreadPoolExecutor(max_workers=5) as pool:
                futures = {pool.submit(enrich_proposicao, p, dep["id"]): p for p in props_raw}
                for fut in as_completed(futures):
                    try:
                        prop = fut.result()
                        if prop and prop["numero"] and prop["ano"]:
                            prop["parlamentar_id"] = parl_id
                            upsert_proposicao(conn, prop)
                    except Exception as exc:
                        print(f"    ERRO proposicao: {exc}")

            conn.commit()

    print("Camara: ingestao concluida.")


if __name__ == "__main__":
    main()
