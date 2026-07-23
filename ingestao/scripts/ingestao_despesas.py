"""
Ingestão de despesas CEAP da Câmara dos Deputados.

Melhorias em relação à versão inicial:
  - Coleta todo o histórico disponível, não apenas o ano corrente.
  - Range de anos determinado pela proposição mais antiga de cada deputado.
  - Anos fechados já ingeridos são pulados (idempotente e rápido em re-execuções).
  - Ano corrente é sempre re-buscado (dados retroativos mudam mensalmente).

Endpoint: GET /deputados/{id}/despesas?ano={ano}&pagina={N}&itens=100
"""

import datetime
import sys
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn, upsert_despesa
from lib.http import get_json

BASE = "https://dadosabertos.camara.leg.br/api/v2"
ANO_ATUAL = datetime.date.today().year

# Ano mínimo absoluto — mantemos apenas os últimos 5 anos (2021-presente).
# Dados anteriores foram removidos pela migração db/migration_storage_opt.sql.
ANO_MINIMO_ABSOLUTO = 2021


def ano_inicio_parlamentar(conn: psycopg.Connection, parl_id: int, fallback: int) -> int:
    """Retorna o ano da proposição mais antiga do parlamentar, com fallback."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COALESCE(MIN(ano), %s) FROM proposicao WHERE parlamentar_id = %s",
            (fallback, parl_id),
        )
        ano = cur.fetchone()[0]
    return max(ano, ANO_MINIMO_ABSOLUTO)


def ja_ingerido(conn: psycopg.Connection, parl_id: int, ano: int) -> bool:
    """True se já existe pelo menos 1 registro de despesa para (parlamentar, ano)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM despesa WHERE parlamentar_id=%s AND ano=%s LIMIT 1)",
            (parl_id, ano),
        )
        return cur.fetchone()[0]


def fetch_despesas_deputado(dep_id: int, ano: int) -> list[dict]:
    despesas = []
    pagina = 1
    while True:
        data = get_json(
            f"{BASE}/deputados/{dep_id}/despesas",
            {"ano": ano, "pagina": pagina, "itens": 100},
        )
        batch = data.get("dados", [])
        if not batch:
            break
        despesas.extend(batch)
        pagina += 1
    return despesas


def main() -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, id_externo, nome FROM parlamentar WHERE casa = 'camara' ORDER BY nome"
            )
            deputados = cur.fetchall()

        print(f"-> {len(deputados)} deputados para processar despesas")

        totais = {"anos_buscados": 0, "anos_pulados": 0, "registros": 0}

        for parl_id, dep_id, nome in deputados:
            ano_inicio = ano_inicio_parlamentar(conn, parl_id, fallback=ANO_ATUAL)
            anos_range = range(ano_inicio, ANO_ATUAL + 1)
            print(f"  [{dep_id}] {nome} — {ano_inicio} a {ANO_ATUAL} ({len(anos_range)} anos)")

            for ano in anos_range:
                # Ano corrente: sempre re-busca (dados mudam ao longo do ano)
                # Anos fechados: pula se já ingerido
                if ano < ANO_ATUAL and ja_ingerido(conn, parl_id, ano):
                    print(f"    {ano}: ja ingerido, pulando")
                    totais["anos_pulados"] += 1
                    continue

                despesas = fetch_despesas_deputado(dep_id, ano)
                count = 0
                for d in despesas:
                    upsert_despesa(conn, {
                        "parlamentar_id": parl_id,
                        "ano":            d.get("ano"),
                        "mes":            d.get("mes"),
                        "natureza":       d.get("tipoDespesa"),
                        "fornecedor":     d.get("nomeFornecedor"),
                        "cpf_cnpj":       d.get("cnpjCpfFornecedor"),
                        "valor_liquido":  d.get("valorLiquido"),
                        "valor_glosa":    d.get("valorGlosa"),
                        "url_documento":  d.get("urlDocumento"),
                        "detalhamento":   d.get("descricao"),
                        "documento":      d.get("numDocumento"),
                    })
                    count += 1

                conn.commit()
                totais["anos_buscados"] += 1
                totais["registros"] += count
                print(f"    {ano}: {count} registros")

        print(
            f"\nCamara CEAP: concluido."
            f" Anos buscados: {totais['anos_buscados']},"
            f" pulados: {totais['anos_pulados']},"
            f" registros inseridos/atualizados: {totais['registros']}"
        )


if __name__ == "__main__":
    main()
