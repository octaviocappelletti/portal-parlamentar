"""
Ingestão de senadores e proposições do Senado.

Workarounds aplicados:
  §6.6  — IndicadorAutorPrincipal já vem em /senador/{cod}/autorias: usar direto
  §6.7  — ?autoria={nome} é ignorado: usar /senador/{cod}/autorias
  §6.8  — sem CPF: chave surrogate (UF, data_nascimento)
  §6.9  — siglaSituacao/situacaoAtual não confiáveis: aprovada = normaGerada preenchido
  §6.10 — PLS -> PL (normalizar)
  §6.11 — /processo retorna duplicatas: dedup por (numero, ano)
  §6.12 — /processo/emenda sem dataInicio dá 503: buscar dataInicio do mandato
  §6.13 — emendas MPV: coletar mas não marcar como exibíveis
  §6.15 — encoding: decode via senado_decode
  §6.16 — legislaturas cruzadas: usar legislatura vigente para parlamentares atuais
"""

import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn, upsert_mandato, upsert_parlamentar, upsert_proposicao
from lib.http import get_json, get_xml
from lib.senado_decode import ensure_list, xml_to_dict

BASE = "https://legis.senado.leg.br/dadosabertos"
LEG = int(os.environ.get("LEGISLATURA_SENADO", "57"))

TIPOS_VALIDOS = {"PEC", "PL", "PLS"}
RE_MPV = re.compile(r"\bMPV\b")


def fetch_senadores() -> list[dict]:
    """Lista de senadores da legislatura vigente (§6.16)."""
    content = get_xml(f"{BASE}/senador/lista/legislatura/{LEG}")
    root = xml_to_dict(content)
    parlamentares = root.get("ListaParlamentarLegislatura", {}).get("Parlamentares", {}).get("Parlamentar", [])
    parlamentares = ensure_list(parlamentares)
    print(f"-> {len(parlamentares)} senadores na legislatura {LEG}")
    return parlamentares


def parse_senador(p: dict) -> dict:
    dados = p.get("IdentificacaoParlamentar", {})
    return {
        "casa": "senado",
        "id_externo": int(dados.get("CodigoParlamentar", 0)),
        "nome": dados.get("NomeParlamentar"),
        "nome_civil": dados.get("NomeCompletoParlamentar"),
        "partido": dados.get("SiglaPartidoParlamentar"),
        "uf": dados.get("UfParlamentar"),
        "foto_url": dados.get("UrlFotoParlamentar"),
        "cpf": None,  # §6.8 — sem CPF disponível
        "data_nascimento": None,
    }


def fetch_nascimento(cod: int) -> str | None:
    """Busca data de nascimento para chave surrogate (§6.8)."""
    try:
        content = get_xml(f"{BASE}/senador/{cod}")
        root = xml_to_dict(content)
        dados = root.get("DetalheParlamentar", {}).get("Parlamentar", {}).get("DadosBasicosParlamentar", {})
        return dados.get("DataNascimento")
    except Exception:
        return None


def fetch_mandato(cod: int) -> tuple[int, str | None]:
    """Retorna (legislatura, data_inicio) do mandato vigente (§6.12)."""
    try:
        content = get_xml(f"{BASE}/senador/{cod}/mandatos")
        root = xml_to_dict(content)
        mandatos = root.get("MandatoParlamentar", {}).get("Parlamentar", {}).get("Mandatos", {}).get("Mandato", [])
        mandatos = ensure_list(mandatos)
        for m in mandatos:
            if str(m.get("CodigoLegislatura", "")) == str(LEG):
                return LEG, m.get("DataInicio")
        return LEG, None
    except Exception:
        return LEG, None


def fetch_autorias(cod: int) -> list[dict]:
    """Busca autorias com indicador de autor principal (§6.6)."""
    try:
        content = get_xml(f"{BASE}/senador/{cod}/autorias")
        root = xml_to_dict(content)
        autorias = (
            root.get("AutoriasParlamentar", {})
            .get("Parlamentar", {})
            .get("Autorias", {})
            .get("Autoria", [])
        )
        return ensure_list(autorias)
    except Exception:
        return []


def fetch_processos(cod: int, data_inicio: str | None) -> list[dict]:
    """Busca proposições via /processo (§6.9, §6.11, dedup por numero+ano)."""
    if not data_inicio:
        data_inicio = "2019-01-01"

    seen = set()
    processos = []
    for sigla in ("PEC", "PL"):
        try:
            data = get_json(
                f"{BASE}/processo",
                {"codigoParlamentarAutor": cod, "sigla": sigla, "dataInicio": data_inicio},
            )
            items = data if isinstance(data, list) else data.get("dados", [])
            for item in items:
                numero = item.get("numero")
                ano = item.get("ano")
                key = (numero, ano)
                if key in seen or not numero or not ano:
                    continue
                seen.add(key)
                processos.append(item)
        except Exception as exc:
            print(f"    AVISO processo {sigla}: {exc}")
    return processos


def main() -> None:
    senadores_raw = fetch_senadores()

    with get_conn() as conn:
        for p in senadores_raw:
            dados = p.get("IdentificacaoParlamentar", {})
            cod = int(dados.get("CodigoParlamentar", 0))
            print(f"  senador {cod} {dados.get('NomeParlamentar', '')}")

            senador = parse_senador(p)
            senador["data_nascimento"] = fetch_nascimento(cod)
            parl_id = upsert_parlamentar(conn, senador)

            leg, data_inicio = fetch_mandato(cod)
            upsert_mandato(conn, {
                "parlamentar_id": parl_id,
                "legislatura": leg,
                "data_inicio": data_inicio,
                "data_fim": None,
            })

            # Autorias com IndicadorAutorPrincipal (§6.6)
            autorias = fetch_autorias(cod)
            for autoria in autorias:
                sigla = autoria.get("SiglaSubtipoMateria") or autoria.get("SiglaTipoMateria", "")
                # Normaliza PLS -> PL (§6.10)
                if sigla == "PLS":
                    sigla = "PL"
                if sigla not in TIPOS_VALIDOS:
                    continue
                autor_principal = autoria.get("IndicadorAutorPrincipal", "Nao") == "Sim"
                numero = autoria.get("NumeroMateria")
                ano = autoria.get("AnoMateria")
                if not numero or not ano:
                    continue
                upsert_proposicao(conn, {
                    "parlamentar_id": parl_id,
                    "casa": "senado",
                    "tipo": sigla,
                    "numero": int(numero),
                    "ano": int(ano),
                    "ementa": autoria.get("EmentaMateria"),
                    "autor_principal": autor_principal,
                    "situacao": None,
                    "aprovada": bool(autoria.get("NormaGerada")),  # §6.9
                    "data_apresentacao": autoria.get("DataApresentacao", "")[:10] if autoria.get("DataApresentacao") else None,
                    "url_inteiro_teor": autoria.get("UrlTexto"),
                })

            # Processos como complemento (§6.9 — aprovada = normaGerada preenchido)
            processos = fetch_processos(cod, data_inicio)
            for proc in processos:
                sigla = proc.get("sigla", "")
                if sigla == "PLS":
                    sigla = "PL"
                if sigla not in TIPOS_VALIDOS:
                    continue
                aprovada = bool(proc.get("normaGerada"))
                upsert_proposicao(conn, {
                    "parlamentar_id": parl_id,
                    "casa": "senado",
                    "tipo": sigla,
                    "numero": int(proc.get("numero", 0)),
                    "ano": int(proc.get("ano", 0)),
                    "ementa": proc.get("ementa"),
                    "autor_principal": None,
                    "situacao": "aprovada" if aprovada else None,
                    "aprovada": aprovada,
                    "data_apresentacao": proc.get("dataApresentacao", "")[:10] if proc.get("dataApresentacao") else None,
                    "url_inteiro_teor": proc.get("urlTexto"),
                })

            conn.commit()

    print("Senado: ingestao concluida.")


if __name__ == "__main__":
    main()
