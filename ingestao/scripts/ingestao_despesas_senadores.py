"""
Ingestão de despesas CEAP do Senado.
Retorna tudo de uma vez por ano (≠ Câmara) — filtrar por codSenador em memória (§5.3).
"""

import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn, upsert_despesa
from lib.http import get_json

BASE = "https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores"
ANO_ATUAL = datetime.date.today().year


def fetch_ceap_ano(ano: int) -> list[dict]:
    data = get_json(f"{BASE}/despesas_ceaps/{ano}", use_cache=True)
    return data if isinstance(data, list) else data.get("dados", [])


def main() -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, id_externo FROM parlamentar WHERE casa = 'senado'")
            senadores = {str(row[1]): row[0] for row in cur.fetchall()}

        print(f"-> {len(senadores)} senadores; buscando CEAP {ANO_ATUAL}")

        despesas_ano = fetch_ceap_ano(ANO_ATUAL)
        print(f"   {len(despesas_ano)} registros no ano")

        for d in despesas_ano:
            cod = str(d.get("codSenador", ""))
            parl_id = senadores.get(cod)
            if not parl_id:
                continue

            mes_raw = d.get("mes", "")
            try:
                mes = int(mes_raw)
            except (ValueError, TypeError):
                continue

            upsert_despesa(conn, {
                "parlamentar_id": parl_id,
                "ano": ANO_ATUAL,
                "mes": mes,
                "natureza": d.get("tipoDespesa"),
                "fornecedor": d.get("fornecedor"),
                "cpf_cnpj": d.get("cpfCnpj"),
                "valor_liquido": d.get("valorReembolsado"),
                "valor_glosa": None,
                "url_documento": d.get("documento"),
                "detalhamento": d.get("detalhamento"),
                "documento": d.get("data"),
            })

        conn.commit()

    print("Senado CEAP: ingestao concluida.")


if __name__ == "__main__":
    main()
