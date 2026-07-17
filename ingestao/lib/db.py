"""Upserts idempotentes no Postgres — §7 (Idempotência)."""

import os

import psycopg
from dotenv import load_dotenv

load_dotenv()


def get_conn() -> psycopg.Connection:
    return psycopg.connect(os.environ["DATABASE_URL"])


def upsert_parlamentar(conn: psycopg.Connection, p: dict) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO parlamentar
              (casa, id_externo, nome, nome_civil, partido, uf, foto_url, cpf, data_nascimento, situacao)
            VALUES
              (%(casa)s, %(id_externo)s, %(nome)s, %(nome_civil)s, %(partido)s,
               %(uf)s, %(foto_url)s, %(cpf)s, %(data_nascimento)s, %(situacao)s)
            ON CONFLICT (casa, id_externo) DO UPDATE SET
              nome            = EXCLUDED.nome,
              nome_civil      = EXCLUDED.nome_civil,
              partido         = EXCLUDED.partido,
              uf              = EXCLUDED.uf,
              foto_url        = EXCLUDED.foto_url,
              cpf             = EXCLUDED.cpf,
              data_nascimento = EXCLUDED.data_nascimento,
              situacao        = EXCLUDED.situacao,
              updated_at      = NOW()
            RETURNING id
            """,
            p,
        )
        return cur.fetchone()[0]


def upsert_mandato(conn: psycopg.Connection, m: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO mandato (parlamentar_id, legislatura, data_inicio, data_fim)
            VALUES (%(parlamentar_id)s, %(legislatura)s, %(data_inicio)s, %(data_fim)s)
            ON CONFLICT (parlamentar_id, legislatura) DO UPDATE SET
              data_inicio = EXCLUDED.data_inicio,
              data_fim    = EXCLUDED.data_fim
            """,
            m,
        )


def upsert_proposicao(conn: psycopg.Connection, p: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO proposicao
              (parlamentar_id, casa, tipo, numero, ano, ementa, autor_principal,
               situacao, aprovada, data_apresentacao, url_inteiro_teor)
            VALUES
              (%(parlamentar_id)s, %(casa)s, %(tipo)s, %(numero)s, %(ano)s,
               %(ementa)s, %(autor_principal)s, %(situacao)s, %(aprovada)s,
               %(data_apresentacao)s, %(url_inteiro_teor)s)
            ON CONFLICT (casa, tipo, numero, ano, parlamentar_id) DO UPDATE SET
              ementa            = EXCLUDED.ementa,
              autor_principal   = EXCLUDED.autor_principal,
              situacao          = EXCLUDED.situacao,
              aprovada          = EXCLUDED.aprovada,
              url_inteiro_teor  = EXCLUDED.url_inteiro_teor,
              fetched_at        = NOW()
            """,
            p,
        )


def upsert_despesa(conn: psycopg.Connection, d: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO despesa
              (parlamentar_id, ano, mes, natureza, fornecedor, cpf_cnpj,
               valor_liquido, valor_glosa, url_documento, detalhamento, documento)
            VALUES
              (%(parlamentar_id)s, %(ano)s, %(mes)s, %(natureza)s, %(fornecedor)s,
               %(cpf_cnpj)s, %(valor_liquido)s, %(valor_glosa)s, %(url_documento)s,
               %(detalhamento)s, %(documento)s)
            ON CONFLICT (parlamentar_id, ano, mes, fornecedor, valor_liquido, documento)
            DO NOTHING
            """,
            d,
        )
