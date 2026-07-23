"""Upserts idempotentes no Postgres — §7 (Idempotência)."""

import json
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


def upsert_fornecedor(conn: psycopg.Connection, f: dict) -> None:
    cnae_sec = f.get("cnae_secundarios")
    params = {
        **f,
        "cnae_secundarios": json.dumps(cnae_sec, ensure_ascii=False) if cnae_sec else None,
    }
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO fornecedor (
              cnpj, razao_social, nome_fantasia,
              situacao_cadastral, data_situacao_cadastral, motivo_situacao_cadastral,
              data_inicio_atividade,
              cnae_principal, cnae_principal_descricao, cnae_secundarios,
              natureza_juridica_codigo, natureza_juridica_descricao,
              porte_empresa, capital_social, opcao_simples, opcao_mei,
              logradouro, numero, bairro, municipio, uf, cep,
              enriched_at
            )
            VALUES (
              %(cnpj)s, %(razao_social)s, %(nome_fantasia)s,
              %(situacao_cadastral)s, %(data_situacao_cadastral)s, %(motivo_situacao_cadastral)s,
              %(data_inicio_atividade)s,
              %(cnae_principal)s, %(cnae_principal_descricao)s, %(cnae_secundarios)s,
              %(natureza_juridica_codigo)s, %(natureza_juridica_descricao)s,
              %(porte_empresa)s, %(capital_social)s, %(opcao_simples)s, %(opcao_mei)s,
              %(logradouro)s, %(numero)s, %(bairro)s, %(municipio)s, %(uf)s, %(cep)s,
              NOW()
            )
            ON CONFLICT (cnpj) DO UPDATE SET
              razao_social                = EXCLUDED.razao_social,
              nome_fantasia               = EXCLUDED.nome_fantasia,
              situacao_cadastral          = EXCLUDED.situacao_cadastral,
              data_situacao_cadastral     = EXCLUDED.data_situacao_cadastral,
              motivo_situacao_cadastral   = EXCLUDED.motivo_situacao_cadastral,
              data_inicio_atividade       = EXCLUDED.data_inicio_atividade,
              cnae_principal              = EXCLUDED.cnae_principal,
              cnae_principal_descricao    = EXCLUDED.cnae_principal_descricao,
              cnae_secundarios            = EXCLUDED.cnae_secundarios,
              natureza_juridica_codigo    = EXCLUDED.natureza_juridica_codigo,
              natureza_juridica_descricao = EXCLUDED.natureza_juridica_descricao,
              porte_empresa               = EXCLUDED.porte_empresa,
              capital_social              = EXCLUDED.capital_social,
              opcao_simples               = EXCLUDED.opcao_simples,
              opcao_mei                   = EXCLUDED.opcao_mei,
              logradouro                  = EXCLUDED.logradouro,
              numero                      = EXCLUDED.numero,
              bairro                      = EXCLUDED.bairro,
              municipio                   = EXCLUDED.municipio,
              uf                          = EXCLUDED.uf,
              cep                         = EXCLUDED.cep,
              enriched_at                 = NOW()
            """,
            params,
        )


def replace_fornecedor_socios(conn: psycopg.Connection, cnpj: str, socios: list[dict]) -> None:
    """Remove sócios anteriores e reinsere a lista atual (idempotente)."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM fornecedor_socio WHERE fornecedor_cnpj = %s", (cnpj,))
        for s in socios:
            cur.execute(
                """
                INSERT INTO fornecedor_socio (
                  fornecedor_cnpj, nome, identificador_socio,
                  qualificacao_codigo, qualificacao_descricao,
                  data_entrada_sociedade, faixa_etaria, cpf_representante_legal
                ) VALUES (
                  %(fornecedor_cnpj)s, %(nome)s, %(identificador_socio)s,
                  %(qualificacao_codigo)s, %(qualificacao_descricao)s,
                  %(data_entrada_sociedade)s, %(faixa_etaria)s, %(cpf_representante_legal)s
                )
                """,
                s,
            )


def update_parlamentar_social(
    conn: psycopg.Connection,
    parlamentar_id: int,
    redes_sociais: list[str],
    website: str | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE parlamentar
               SET redes_sociais = %s,
                   website       = %s,
                   updated_at    = NOW()
             WHERE id = %s
            """,
            (
                json.dumps(redes_sociais, ensure_ascii=False) if redes_sociais else None,
                website,
                parlamentar_id,
            ),
        )


def replace_parlamentar_orgaos(
    conn: psycopg.Connection, parlamentar_id: int, orgaos: list[dict]
) -> None:
    """Remove todos os órgãos do parlamentar e reinsere a lista atual (idempotente)."""
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM parlamentar_orgao WHERE parlamentar_id = %s", (parlamentar_id,)
        )
        for o in orgaos:
            cur.execute(
                """
                INSERT INTO parlamentar_orgao
                  (parlamentar_id, id_orgao, fonte, nome_orgao, sigla_orgao,
                   titulo, cod_titulo, data_inicio, data_fim)
                VALUES
                  (%(parlamentar_id)s, %(id_orgao)s, %(fonte)s, %(nome_orgao)s, %(sigla_orgao)s,
                   %(titulo)s, %(cod_titulo)s, %(data_inicio)s, %(data_fim)s)
                """,
                {**o, "fonte": o.get("fonte")},
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
