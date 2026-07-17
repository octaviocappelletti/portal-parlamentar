"""
Ingestão de despesas CEAP do Senado Federal.

A API do Senado retorna TODOS os senadores de um determinado ano em uma única
chamada (diferente da Câmara, que pagina por parlamentar). Por isso, o loop
externo é por ANO, não por senador.

Melhorias em relação à versão inicial:
  - Coleta todo o histórico disponível, não apenas o ano corrente.
  - Range de anos determinado pela proposição mais antiga entre todos os senadores.
  - Para cada ano, evita chamar a API se todos os senadores já têm dados (skip total).
  - Para anos parcialmente ingeridos, insere apenas os senadores que faltam.
  - Ano corrente é sempre re-buscado.

Endpoint: GET /despesas_ceaps/{ano}
Campos: codSenador, nomeSenador, mes, tipoDespesa, fornecedor, cpfCnpj,
        valorReembolsado, data, documento, detalhamento
"""

import datetime
import sys
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn, upsert_despesa
from lib.http import get_json

BASE = "https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores"
ANO_ATUAL = datetime.date.today().year

# Ano mínimo absoluto — a CEAP do Senado tem dados desde ~2008.
# Limitamos a 2015 por padrão (mandatos da 55ª legislatura).
# Ajuste se quiser histórico mais antigo.
ANO_MINIMO_ABSOLUTO = 2015


def ano_global_inicio(conn: psycopg.Connection, fallback: int) -> int:
    """Menor ano de proposição entre todos os senadores, limitado pelo absoluto."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(MIN(pr.ano), %s)
            FROM parlamentar p
            LEFT JOIN proposicao pr ON pr.parlamentar_id = p.id
            WHERE p.casa = 'senado'
            """,
            (fallback,),
        )
        ano = cur.fetchone()[0]
    return max(ano, ANO_MINIMO_ABSOLUTO)


def senadores_sem_dado(
    conn: psycopg.Connection, parl_ids: list[int], ano: int
) -> set[int]:
    """Retorna IDs internos dos senadores que ainda NÃO têm despesas no ano."""
    if not parl_ids:
        return set()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT parlamentar_id FROM despesa
            WHERE ano = %s AND parlamentar_id = ANY(%s)
            """,
            (ano, parl_ids),
        )
        ja_tem = {row[0] for row in cur.fetchall()}
    return set(parl_ids) - ja_tem


def fetch_ceap_ano(ano: int) -> list[dict]:
    data = get_json(f"{BASE}/despesas_ceaps/{ano}", use_cache=True)
    return data if isinstance(data, list) else data.get("dados", [])


def main() -> None:
    with get_conn() as conn:
        # Carrega mapa {cod_externo_str: parl_id_interno}
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, id_externo, nome FROM parlamentar WHERE casa = 'senado' ORDER BY nome"
            )
            rows = cur.fetchall()

        senadores = {str(row[1]): row[0] for row in rows}          # cod -> parl_id
        parl_ids_todos = list(senadores.values())                    # todos os IDs internos
        nomes = {row[0]: row[2] for row in rows}                     # parl_id -> nome

        print(f"-> {len(senadores)} senadores no banco")

        ano_inicio = ano_global_inicio(conn, fallback=ANO_ATUAL)
        anos_range = range(ano_inicio, ANO_ATUAL + 1)
        print(f"-> coletando CEAP de {ano_inicio} a {ANO_ATUAL} ({len(anos_range)} anos)\n")

        totais = {"anos_buscados": 0, "anos_pulados": 0, "registros": 0}

        for ano in anos_range:
            if ano < ANO_ATUAL:
                faltantes = senadores_sem_dado(conn, parl_ids_todos, ano)
                if not faltantes:
                    print(f"  {ano}: todos os senadores ja ingeridos, pulando API")
                    totais["anos_pulados"] += 1
                    continue
                print(f"  {ano}: {len(faltantes)} senador(es) sem dados, buscando...")
            else:
                faltantes = set(parl_ids_todos)   # ano atual: re-busca todos
                print(f"  {ano} (ano corrente): re-buscando todos os {len(faltantes)} senadores")

            despesas_ano = fetch_ceap_ano(ano)
            print(f"         API retornou {len(despesas_ano)} registros brutos")

            count = 0
            for d in despesas_ano:
                cod = str(d.get("codSenador", ""))
                parl_id = senadores.get(cod)
                if not parl_id or parl_id not in faltantes:
                    continue

                mes_raw = d.get("mes", "")
                try:
                    mes = int(mes_raw)
                    if not 1 <= mes <= 12:
                        continue
                except (ValueError, TypeError):
                    continue

                # Campo "documento" do Senado pode ser URL ou identificador.
                # Usamos o campo "data" (data do gasto) como chave de dedup
                # porque o "documento" é frequentemente uma URL não única.
                doc_raw = d.get("documento") or ""
                url_doc = doc_raw if doc_raw.startswith("http") else None
                doc_key = d.get("data") or doc_raw or ""

                upsert_despesa(conn, {
                    "parlamentar_id": parl_id,
                    "ano":            ano,
                    "mes":            mes,
                    "natureza":       d.get("tipoDespesa"),
                    "fornecedor":     d.get("fornecedor"),
                    "cpf_cnpj":       d.get("cpfCnpj"),
                    "valor_liquido":  d.get("valorReembolsado"),
                    "valor_glosa":    None,   # Senado não informa glosa
                    "url_documento":  url_doc,
                    "detalhamento":   d.get("detalhamento"),
                    "documento":      doc_key,
                })
                count += 1

            conn.commit()
            totais["anos_buscados"] += 1
            totais["registros"] += count

            # Resumo por senador para o ano processado
            for parl_id in sorted(faltantes):
                qtd = sum(
                    1 for d in despesas_ano
                    if senadores.get(str(d.get("codSenador", ""))) == parl_id
                )
                if qtd:
                    print(f"         {nomes.get(parl_id, parl_id)}: {qtd} registros")

        print(
            f"\nSenado CEAP: concluido."
            f" Anos buscados: {totais['anos_buscados']},"
            f" pulados: {totais['anos_pulados']},"
            f" registros inseridos/atualizados: {totais['registros']}"
        )


if __name__ == "__main__":
    main()
