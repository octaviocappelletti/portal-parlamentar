"""
Ingestão de presença parlamentar — Câmara dos Deputados (API v2).

Fontes:
  1. /deputados         — lista base para calcular ausências nominais
  2. /eventos           — eventos encerrados no período + lista de presentes
  3. /votacoes          — votações nominais; votos individuais + marcação de ausentes

Tabelas de destino (ver db/schema_presenca.sql):
  evento_camara, presenca_evento_camara, votacao_camara, voto_camara

Uso:
  python ingestao_presenca_camara.py
  DATA_INICIO=2026-07-01 DATA_FIM=2026-07-22 python ingestao_presenca_camara.py

Variáveis de ambiente:
  DATABASE_URL        — string de conexão Postgres (obrigatória)
  DATA_INICIO         — AAAA-MM-DD (padrão: 30 dias atrás)
  DATA_FIM            — AAAA-MM-DD (padrão: hoje)
  LEGISLATURA_CAMARA  — número da legislatura (padrão: 57)
  USE_CACHE           — 0 para forçar re-download (padrão: 1)
"""

import os
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn
from lib.http import get_json

BASE = "https://dadosabertos.camara.leg.br/api/v2"
LEG = int(os.environ.get("LEGISLATURA_CAMARA", "57"))
USE_CACHE = os.environ.get("USE_CACHE", "1") != "0"

SITUACOES_ENCERRADAS = {"Encerrada", "Encerrada (Final)"}


# ─── Persistência ────────────────────────────────────────────────────────────


def _upsert_evento(conn, ev: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO evento_camara
              (id, data_hora_inicio, data_hora_fim, descricao_tipo, situacao, orgaos_siglas)
            VALUES
              (%(id)s, %(data_hora_inicio)s, %(data_hora_fim)s,
               %(descricao_tipo)s, %(situacao)s, %(orgaos_siglas)s)
            ON CONFLICT (id) DO UPDATE SET
              data_hora_fim  = EXCLUDED.data_hora_fim,
              situacao       = EXCLUDED.situacao,
              fetched_at     = NOW()
            """,
            ev,
        )


def _upsert_presenca_evento(conn, p: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO presenca_evento_camara
              (evento_id, id_deputado, nome, partido, uf)
            VALUES
              (%(evento_id)s, %(id_deputado)s, %(nome)s, %(partido)s, %(uf)s)
            ON CONFLICT (evento_id, id_deputado) DO NOTHING
            """,
            p,
        )


def _upsert_votacao(conn, v: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO votacao_camara
              (id, data_hora, descricao, id_orgao, sigla_orgao, aprovacao)
            VALUES
              (%(id)s, %(data_hora)s, %(descricao)s,
               %(id_orgao)s, %(sigla_orgao)s, %(aprovacao)s)
            ON CONFLICT (id) DO UPDATE SET
              aprovacao  = EXCLUDED.aprovacao,
              fetched_at = NOW()
            """,
            v,
        )


def _upsert_voto(conn, v: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO voto_camara
              (votacao_id, id_deputado, nome, partido, uf,
               tipo_voto, data_registro, status_presenca)
            VALUES
              (%(votacao_id)s, %(id_deputado)s, %(nome)s, %(partido)s, %(uf)s,
               %(tipo_voto)s, %(data_registro)s, %(status_presenca)s)
            ON CONFLICT (votacao_id, id_deputado) DO UPDATE SET
              tipo_voto       = EXCLUDED.tipo_voto,
              status_presenca = EXCLUDED.status_presenca,
              fetched_at      = NOW()
            """,
            v,
        )


# ─── Fetch ────────────────────────────────────────────────────────────────────


def fetch_deputados_ativos() -> dict[int, dict]:
    """Baixa todos os deputados da legislatura (§6.5 — sem filtro de UF)."""
    deputados: dict[int, dict] = {}
    pagina = 1
    while True:
        data = get_json(
            f"{BASE}/deputados",
            {"idLegislatura": LEG, "pagina": pagina, "itens": 100},
            use_cache=USE_CACHE,
        )
        batch = data.get("dados", [])
        if not batch:
            break
        for dep in batch:
            deputados[dep["id"]] = dep
        pagina += 1
    print(f"-> {len(deputados)} deputados na legislatura {LEG}")
    return deputados


def fetch_eventos(data_inicio: str, data_fim: str) -> list[dict]:
    """Lista eventos no período com paginação."""
    eventos: list[dict] = []
    pagina = 1
    while True:
        data = get_json(
            f"{BASE}/eventos",
            {
                "dataInicio": data_inicio,
                "dataFim": data_fim,
                "pagina": pagina,
                "itens": 100,
                "ordem": "ASC",
                "ordenarPor": "dataHoraInicio",
            },
            use_cache=USE_CACHE,
        )
        batch = data.get("dados", [])
        if not batch:
            break
        eventos.extend(batch)
        pagina += 1
    return eventos


def fetch_presentes_evento(id_evento: int) -> list[dict]:
    """Deputados presentes em um evento específico."""
    try:
        data = get_json(
            f"{BASE}/eventos/{id_evento}/deputados",
            use_cache=USE_CACHE,
        )
        return data.get("dados", [])
    except Exception as exc:
        print(f"    AVISO /eventos/{id_evento}/deputados: {exc}")
        return []


def fetch_votacoes(data_inicio: str, data_fim: str) -> list[dict]:
    """Lista votações no período com paginação."""
    votacoes: list[dict] = []
    pagina = 1
    while True:
        try:
            data = get_json(
                f"{BASE}/votacoes",
                {
                    "dataInicio": data_inicio,
                    "dataFim": data_fim,
                    "pagina": pagina,
                    "itens": 100,
                    "ordem": "ASC",
                    "ordenarPor": "dataHoraRegistro",
                },
                use_cache=USE_CACHE,
            )
            batch = data.get("dados", [])
            if not batch:
                break
            votacoes.extend(batch)
            pagina += 1
        except Exception as exc:
            print(f"    AVISO /votacoes pagina {pagina}: {exc}")
            break
    return votacoes


def fetch_votos_votacao(id_votacao: str) -> list[dict]:
    """Votos individuais de uma votação. Lista vazia = votação simbólica."""
    try:
        data = get_json(f"{BASE}/votacoes/{id_votacao}/votos", use_cache=USE_CACHE)
        return data.get("dados", [])
    except Exception as exc:
        print(f"    AVISO /votacoes/{id_votacao}/votos: {exc}")
        return []


# ─── Processamento ────────────────────────────────────────────────────────────


def processar_eventos(conn, data_inicio: str, data_fim: str) -> None:
    """Persiste eventos encerrados e a lista de presentes de cada um."""
    todos = fetch_eventos(data_inicio, data_fim)
    encerrados = [e for e in todos if e.get("situacao") in SITUACOES_ENCERRADAS]
    print(f"-> {len(todos)} eventos | {len(encerrados)} encerrados para processar")

    for ev in encerrados:
        id_ev = ev["id"]
        orgaos = ev.get("orgaos") or []
        siglas = [o.get("sigla") for o in orgaos if o.get("sigla")]

        _upsert_evento(conn, {
            "id": id_ev,
            "data_hora_inicio": ev.get("dataHoraInicio"),
            "data_hora_fim": ev.get("dataHoraFim"),
            "descricao_tipo": ev.get("descricaoTipo"),
            "situacao": ev.get("situacao"),
            "orgaos_siglas": siglas,
        })

        presentes = fetch_presentes_evento(id_ev)
        for p in presentes:
            _upsert_presenca_evento(conn, {
                "evento_id": id_ev,
                "id_deputado": p["id"],
                "nome": p.get("nome"),
                "partido": p.get("siglaPartido"),
                "uf": p.get("siglaUf"),
            })

        print(f"  evento {id_ev} [{ev.get('descricaoTipo', '')}]: {len(presentes)} presentes")
        conn.commit()


def processar_votacoes(conn, data_inicio: str, data_fim: str, deputados_ativos: dict) -> None:
    """
    Persiste votações nominais com votos individuais e marca ausências.

    Para votações simbólicas (votos=[]), registra a votação mas não
    marca ninguém como ausente — a ausência de lista de votos não é
    informação confiável de falta.
    """
    votacoes = fetch_votacoes(data_inicio, data_fim)
    print(f"-> {len(votacoes)} votações para processar")

    for vot in votacoes:
        id_vot = vot.get("id")
        if not id_vot:
            continue

        orgaos = vot.get("orgaos") or [{}]
        orgao = orgaos[0] if orgaos else {}

        _upsert_votacao(conn, {
            "id": id_vot,
            "data_hora": vot.get("dataHoraRegistro") or vot.get("dataHoraInicio"),
            "descricao": vot.get("descricao"),
            "id_orgao": orgao.get("id"),
            "sigla_orgao": orgao.get("sigla"),
            "aprovacao": str(vot.get("aprovacao")) if vot.get("aprovacao") is not None else None,
        })

        votos = fetch_votos_votacao(id_vot)
        if not votos:
            # Votação simbólica — sem votos individuais, não infere ausência
            conn.commit()
            continue

        # Votação nominal: votos conhecidos
        ids_votaram: set[int] = set()
        for v in votos:
            dep = v.get("deputado_") or {}
            dep_id = dep.get("id")
            if not dep_id:
                continue
            ids_votaram.add(dep_id)
            _upsert_voto(conn, {
                "votacao_id": id_vot,
                "id_deputado": dep_id,
                "nome": dep.get("nome"),
                "partido": dep.get("siglaPartido"),
                "uf": dep.get("siglaUf"),
                "tipo_voto": v.get("tipoVoto"),
                "data_registro": v.get("dataRegistroVoto"),
                "status_presenca": "presente_votou",
            })

        # Ausentes: deputados ativos que não aparecem na lista de votos
        for dep_id, dep in deputados_ativos.items():
            if dep_id not in ids_votaram:
                _upsert_voto(conn, {
                    "votacao_id": id_vot,
                    "id_deputado": dep_id,
                    "nome": dep.get("nome"),
                    "partido": dep.get("siglaPartido"),
                    "uf": dep.get("siglaUf"),
                    "tipo_voto": None,
                    "data_registro": None,
                    "status_presenca": "ausente",
                })

        ausentes = len(deputados_ativos) - len(ids_votaram)
        print(f"  votacao {id_vot}: {len(votos)} votaram | {ausentes} ausentes")
        conn.commit()


def main() -> None:
    data_inicio = os.environ.get("DATA_INICIO", str(date.today() - timedelta(days=30)))
    data_fim = os.environ.get("DATA_FIM", str(date.today()))

    print(f"=== Ingestao presenca Camara: {data_inicio} a {data_fim} ===")

    deputados_ativos = fetch_deputados_ativos()

    with get_conn() as conn:
        processar_eventos(conn, data_inicio, data_fim)
        processar_votacoes(conn, data_inicio, data_fim, deputados_ativos)

    print("=== Camara presenca: ingestao concluida ===")


if __name__ == "__main__":
    main()
