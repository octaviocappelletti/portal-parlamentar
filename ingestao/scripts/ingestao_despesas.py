"""
Ingestão de despesas CEAP da Câmara.
Pagina por deputado × ano (§5.1).
"""

import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn, upsert_despesa
from lib.http import get_json

BASE = "https://dadosabertos.camara.leg.br/api/v2"
ANO_ATUAL = datetime.date.today().year


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
            cur.execute("SELECT id, id_externo FROM parlamentar WHERE casa = 'camara'")
            deputados = cur.fetchall()

        print(f"-> {len(deputados)} deputados para processar despesas")

        for parl_id, dep_id in deputados:
            print(f"  deputado {dep_id}")
            # Reprocessa ano corrente sempre; anos fechados podem ser pulados com cache
            for ano in [ANO_ATUAL]:
                despesas = fetch_despesas_deputado(dep_id, ano)
                for d in despesas:
                    upsert_despesa(conn, {
                        "parlamentar_id": parl_id,
                        "ano": d.get("ano"),
                        "mes": d.get("mes"),
                        "natureza": d.get("tipoDespesa"),
                        "fornecedor": d.get("nomeFornecedor"),
                        "cpf_cnpj": d.get("cnpjCpfFornecedor"),
                        "valor_liquido": d.get("valorLiquido"),
                        "valor_glosa": d.get("valorGlosa"),
                        "url_documento": d.get("urlDocumento"),
                        "detalhamento": d.get("descricao"),
                        "documento": d.get("numDocumento"),
                    })
            conn.commit()

    print("Camara CEAP: ingestao concluida.")


if __name__ == "__main__":
    main()
