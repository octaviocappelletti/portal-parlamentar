"""
Ingestão de redes sociais e órgãos/comissões dos deputados federais.

Fontes:
  GET /deputados/{id}        → redeSocial, urlWebsite  (usa cache da ingestão principal)
  GET /deputados/{id}/orgaos → participação em comissões, mesa, lideranças (chamada nova)

Estratégia:
  - Redes sociais: reutiliza o cache gerado por ingestao_legislativa.py (quase grátis).
  - Órgãos: replace por parlamentar (DELETE + INSERT) para refletir o estado atual da API.
  - Idempotente: pode ser re-executado a qualquer momento sem duplicar dados.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn, replace_parlamentar_orgaos, update_parlamentar_social
from lib.http import get_json

BASE = "https://dadosabertos.camara.leg.br/api/v2"
USE_CACHE = os.environ.get("USE_CACHE", "1") != "0"


def fetch_social(dep_id: int) -> dict:
    """Extrai redes sociais e website do detalhe do deputado (usa cache quando disponível)."""
    data = get_json(f"{BASE}/deputados/{dep_id}", use_cache=USE_CACHE)
    d = data.get("dados", {})
    return {
        "redes_sociais": d.get("redeSocial") or [],
        "website": d.get("urlWebsite") or None,
    }


def fetch_orgaos(dep_id: int) -> list[dict]:
    """Baixa todos os órgãos do deputado, paginando até o fim."""
    orgaos: list[dict] = []
    pagina = 1
    while True:
        data = get_json(
            f"{BASE}/deputados/{dep_id}/orgaos",
            {"pagina": pagina, "itens": 100},
            use_cache=USE_CACHE,
        )
        batch = data.get("dados", [])
        if not batch:
            break
        orgaos.extend(batch)
        pagina += 1
    return orgaos


def _parse_date(s: str | None) -> str | None:
    if not s:
        return None
    return s[:10]


def main() -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, id_externo, nome FROM parlamentar WHERE casa = 'camara' ORDER BY nome"
            )
            deputados = cur.fetchall()

    print(f"-> {len(deputados)} deputados a processar")

    with get_conn() as conn:
        for parl_id, id_externo, nome in deputados:
            print(f"  {id_externo} {nome}")

            # ── Redes sociais (quase sempre cacheado) ──────────────────────────
            try:
                social = fetch_social(id_externo)
                update_parlamentar_social(conn, parl_id, social["redes_sociais"], social["website"])
                redes = social["redes_sociais"]
                if redes:
                    print(f"    redes: {redes}")
            except Exception as exc:
                print(f"    ERRO social: {exc}")

            # ── Órgãos ─────────────────────────────────────────────────────────
            try:
                orgaos_raw = fetch_orgaos(id_externo)
                orgaos = [
                    {
                        "parlamentar_id": parl_id,
                        "id_orgao":       str(o["idOrgao"]),
                        "fonte":          "camara",
                        "nome_orgao":     o.get("nomeOrgao"),
                        "sigla_orgao":    o.get("siglaOrgao"),
                        "titulo":         o.get("titulo"),
                        "cod_titulo":     o.get("codTitulo"),
                        "data_inicio":    _parse_date(o.get("dataInicio")),
                        "data_fim":       _parse_date(o.get("dataFim")),
                    }
                    for o in orgaos_raw
                    if o.get("idOrgao")
                ]
                replace_parlamentar_orgaos(conn, parl_id, orgaos)
                ativos = [o for o in orgaos if o["data_fim"] is None]
                print(f"    orgaos: {len(orgaos)} total, {len(ativos)} sem data_fim")
            except Exception as exc:
                print(f"    ERRO orgaos: {exc}")

            conn.commit()

    print("Social + órgãos Câmara: ingestão concluída.")


if __name__ == "__main__":
    main()
