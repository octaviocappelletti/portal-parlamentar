"""
Ingestão de senadores e proposições do Senado.

Workarounds aplicados:
  §6.6  — autoria principal via campo `objetivo == "Iniciadora"` do /processo
           (/senador/{cod}/autorias foi desativado em 2026-02-01; substituto = /processo)
  §6.7  — ?autoria={nome} é ignorado: usar /processo com codigoParlamentarAutor
  §6.8  — sem CPF: chave surrogate (UF, data_nascimento)
  §6.9  — siglaSituacao/situacaoAtual não confiáveis: classificação usa tramitando +
           normaGerada + siglaTipoDeliberacao + palavras-chave em situacaoAtual (ver
           classifica_situacao_senado). Regra 1: tramitando=="Sim" => em tramitacao.
           Regra 2a: normaGerada preenchido OU "APROVADO" em siglaTipoDeliberacao OU
           KW_APROVACAO em situacaoAtual => aprovada. Regra 2b: KW_ARQUIVAMENTO => arquivada.
           Regra 2c: fallback encerrado sem match => arquivada + log de aviso.
  §6.10 — PLS -> PL (normalizar)
  §6.11 — /processo retorna duplicatas: dedup por (tipo, numero, ano)
  §6.12 — /processo/emenda sem dataInicio dá 503: buscar dataInicio do mandato
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

TIPOS_VALIDOS = {"PEC", "PL"}

# Valores do campo `objetivo` que confirmam autoria (primária ou coautoria).
# Qualquer outro valor (relator, emendador, etc.) → não é autor → ignorar.
# Expandir esta lista se o diagnóstico revelar outros valores válidos.
OBJETIVO_AUTORIA = {"iniciadora", "subscritora", "subscritor", "autor", "autora"}


def load_overrides(conn) -> tuple[dict[int, str], dict[int, str]]:
    """Carrega EXCLUIDOS e SUPLENTES_EM_EXERCICIO da tabela override_senador."""
    excluidos: dict[int, str] = {}
    suplentes: dict[int, str] = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id_externo, tipo, motivo FROM override_senador")
        for id_ext, tipo, motivo in cur.fetchall():
            if tipo == "excluido":
                excluidos[id_ext] = motivo or ""
            elif tipo == "suplente_exercicio":
                suplentes[id_ext] = motivo or ""
    print(f"-> overrides: {len(excluidos)} excluídos | {len(suplentes)} suplentes em exercício")
    return excluidos, suplentes

# "PL 372/2021", "PEC 71/2012", "PLS 990/2019" etc.
RE_IDENT = re.compile(r"^(\w+)\s+(\d+)/(\d{4})")

# Palavras-chave em situacaoAtual (upper) que indicam aprovação (§6.9 atualizado)
_KW_APROVACAO = (
    "APROVAD",
    "TRANSFORMADA EM NORMA JURÍDICA",
    "REMETIDA À SANÇÃO",
    "REMETIDA À PROMULGAÇÃO",
    "EM VIGOR",
    "VETO DERRUBADO",
    "REQUERIMENTO APROVADO",
)

# Palavras-chave em situacaoAtual (upper) que indicam arquivamento (§6.9 atualizado)
_KW_ARQUIVAMENTO = (
    "ARQUIVAD",
    "REJEITAD",
    "PREJUDICAD",
    "RETIRADA",
    "RETIRADO",
    "REVOGADA",
    "SEM EFICÁCIA",
    "VETO MANTIDO",
    "DESISTÊNCIA",
    "ANEXADA",
    "IMPUGNADA",
    "INDEFERID",
    "EXTINTA",
    "DESCONSTITUÍDO",
    "NÃO ADMISSÃO",
    "NÃO ATENDIMENTO",
)


def classifica_situacao_senado(proc: dict) -> tuple[str, bool]:
    """
    Classifica um processo legislativo em uma das 3 categorias.
    Retorna (situacao, aprovada) onde situacao é "em tramitacao" | "aprovada" | "arquivada".

    Ordem de prioridade (§6.9):
    1. tramitando == "Sim"  => em tramitacao (independe do texto de situacaoAtual)
    2. tramitando == "Não":
       a) normaGerada preenchido, OU "APROVADO" em siglaTipoDeliberacao, OU
          KW_APROVACAO em situacaoAtual => aprovada
       b) KW_ARQUIVAMENTO em situacaoAtual => arquivada
       c) fallback => arquivada + log de aviso (situação não mapeada)
    """
    tramitando = (proc.get("tramitando") or "").strip()

    # Regra 1 — ainda em andamento
    if tramitando == "Sim":
        return "em tramitacao", False

    # Regra 2 — processo encerrado (tramitando == "Não" ou campo ausente)
    situacao_upper = (proc.get("situacaoAtual") or "").upper()
    norma_gerada = proc.get("normaGerada") or ""
    sigla_delib = (proc.get("siglaTipoDeliberacao") or "").upper()

    # 2a — aprovado
    if (
        norma_gerada
        or "APROVADO" in sigla_delib
        or any(kw in situacao_upper for kw in _KW_APROVACAO)
    ):
        return "aprovada", True

    # 2b — arquivado por palavra-chave conhecida
    if any(kw in situacao_upper for kw in _KW_ARQUIVAMENTO):
        return "arquivada", False

    # 2c — fallback: encerrado sem match → arquivado + aviso para revisão manual
    print(
        f"    AVISO situacao nao mapeada [{proc.get('identificacao', '?')}]: "
        f"tramitando={tramitando!r}, situacaoAtual={proc.get('situacaoAtual')!r}, "
        f"siglaTipoDeliberacao={proc.get('siglaTipoDeliberacao')!r}"
    )
    return "arquivada", False


def parse_identificacao(ident: str) -> tuple[str, int, int] | None:
    """Extrai (tipo, numero, ano) de 'PL 372/2021'."""
    m = RE_IDENT.match((ident or "").strip())
    if not m:
        return None
    tipo = m.group(1)
    if tipo == "PLS":
        tipo = "PL"  # §6.10
    if tipo not in TIPOS_VALIDOS:
        return None
    return tipo, int(m.group(2)), int(m.group(3))


def _participacao(p: dict) -> str:
    """Extrai DescricaoParticipacao do mandato mais recente do senador."""
    mandato_raw = p.get("Mandatos", {}).get("Mandato", {})
    mandatos = ensure_list(mandato_raw)
    mandato = next(
        (m for m in mandatos if
         str(m.get("SegundaLegislaturaDoMandato", {}).get("NumeroLegislatura", "")) == str(LEG) or
         str(m.get("PrimeiraLegislaturaDoMandato", {}).get("NumeroLegislatura", "")) == str(LEG)),
        mandatos[0] if mandatos else {},
    )
    return mandato.get("DescricaoParticipacao", "")


def fetch_senadores(suplentes_em_exercicio: dict[int, str]) -> list[dict]:
    """
    Lista apenas os senadores Titulares da legislatura vigente (§6.16).
    A API retorna 3 pessoas por vaga (Titular + 1º Suplente + 2º Suplente).
    Filtramos apenas os Titulares para refletir os 81 senadores reais.
    """
    content = get_xml(f"{BASE}/senador/lista/legislatura/{LEG}")
    root = xml_to_dict(content)
    todos = ensure_list(
        root.get("ListaParlamentarLegislatura", {})
            .get("Parlamentares", {})
            .get("Parlamentar", [])
    )
    titulares = [p for p in todos if _participacao(p) == "Titular"]

    # Inclui suplentes em exercício buscando-os individualmente pelo endpoint de detalhe
    for cod, motivo in suplentes_em_exercicio.items():
        if any(int(p.get("IdentificacaoParlamentar", {}).get("CodigoParlamentar", 0)) == cod
               for p in titulares):
            continue  # já está na lista
        try:
            content = get_xml(f"{BASE}/senador/{cod}")
            root_s = xml_to_dict(content)
            parl_raw = root_s.get("DetalheParlamentar", {}).get("Parlamentar", {})
            # Adapta o formato do detalhe para o mesmo shape da listagem
            titulares.append({
                "IdentificacaoParlamentar": parl_raw.get("IdentificacaoParlamentar", {}),
                "Mandatos": parl_raw.get("Mandatos", {}),
                "_suplente_em_exercicio": True,
            })
            print(f"   + suplente em exercicio adicionado: {cod} ({motivo})")
        except Exception as exc:
            print(f"   AVISO suplente {cod}: {exc}")

    print(f"-> {len(todos)} registros na API | {len(titulares)} Titulares + suplentes em exercício")
    return titulares


def parse_senador(p: dict) -> dict:
    dados = p.get("IdentificacaoParlamentar", {})
    # UfParlamentar some de IdentificacaoParlamentar quando o senador sai do cargo
    # (nomeação ao STF, falecimento, renúncia). Fallback: Mandatos.Mandato.UfParlamentar.
    uf = dados.get("UfParlamentar")
    if not uf:
        mandato_raw = p.get("Mandatos", {}).get("Mandato", {})
        mandatos = ensure_list(mandato_raw)
        uf = next((m.get("UfParlamentar") for m in mandatos if m.get("UfParlamentar")), None)
    return {
        "casa": "senado",
        "id_externo": int(dados.get("CodigoParlamentar", 0)),
        "nome": dados.get("NomeParlamentar"),
        "nome_civil": dados.get("NomeCompletoParlamentar"),
        "partido": dados.get("SiglaPartidoParlamentar"),
        "uf": uf,
        "foto_url": dados.get("UrlFotoParlamentar"),
        "cpf": None,  # §6.8
        "data_nascimento": None,
        "situacao": "Exercício",  # já filtrado por Titulares + suplentes_em_exercicio
    }


def fetch_nascimento(cod: int) -> str | None:
    """Data de nascimento para chave surrogate (§6.8)."""
    try:
        content = get_xml(f"{BASE}/senador/{cod}")
        root = xml_to_dict(content)
        dados = (
            root.get("DetalheParlamentar", {})
                .get("Parlamentar", {})
                .get("DadosBasicosParlamentar", {})
        )
        return dados.get("DataNascimento")
    except Exception:
        return None


def fetch_mandato(cod: int) -> tuple[int, str | None]:
    """Retorna (legislatura, data_inicio) do mandato vigente (§6.12)."""
    try:
        content = get_xml(f"{BASE}/senador/{cod}/mandatos")
        root = xml_to_dict(content)
        mandatos = (
            root.get("MandatoParlamentar", {})
                .get("Parlamentar", {})
                .get("Mandatos", {})
                .get("Mandato", [])
        )
        for m in ensure_list(mandatos):
            if str(m.get("CodigoLegislatura", "")) == str(LEG):
                return LEG, m.get("DataInicio")
        return LEG, None
    except Exception:
        return LEG, None


def fetch_processos(cod: int, data_inicio: str | None) -> list[dict]:
    """
    Busca proposições via /processo com duas chamadas por sigla:
    tramitando=S (em andamento) e tramitando=N (encerrados).
    Preserva o campo `tramitando` no item para classifica_situacao_senado.
    - tipo/numero/ano extraídos de `identificacao` ("PL 372/2021")
    - autor_principal = objetivo == "Iniciadora" (§6.6)
    - dedup por (tipo, numero, ano) (§6.11)
    """
    if not data_inicio:
        data_inicio = "2019-01-01"

    seen: set[tuple] = set()
    processos = []

    for sigla in ("PEC", "PL"):
        for tramitando_param in ("S", "N"):
            try:
                data = get_json(
                    f"{BASE}/processo",
                    {
                        "codigoParlamentarAutor": cod,
                        "sigla": sigla,
                        "dataInicio": data_inicio,
                        "tramitando": tramitando_param,
                    },
                )
                items = data if isinstance(data, list) else data.get("dados", [])
                for item in items:
                    # Filtra por autoria: só mantém itens cujo `objetivo` confirma que o
                    # senador é autor (primário ou coautor). Outros papéis — relator,
                    # emendador, etc. — são descartados para evitar proposições indevidas.
                    objetivo = (item.get("objetivo") or "").strip().lower()
                    if objetivo not in OBJETIVO_AUTORIA:
                        if objetivo:
                            print(
                                f"    INFO objetivo nao-autoria ignorado: "
                                f"{item.get('identificacao', '?')} — objetivo={objetivo!r}"
                            )
                        continue

                    parsed = parse_identificacao(item.get("identificacao", ""))
                    if not parsed:
                        continue
                    tipo, numero, ano = parsed
                    key = (tipo, numero, ano)
                    if key in seen:
                        continue  # §6.11
                    seen.add(key)
                    processos.append({**item, "_tipo": tipo, "_numero": numero, "_ano": ano})
            except Exception as exc:
                print(f"    AVISO /processo {sigla} tramitando={tramitando_param}: {exc}")

    return processos


def main() -> None:
    with get_conn() as conn:
        excluidos, suplentes_em_exercicio = load_overrides(conn)

    senadores_raw = fetch_senadores(suplentes_em_exercicio)

    with get_conn() as conn:
        for p in senadores_raw:
            dados = p.get("IdentificacaoParlamentar", {})
            cod = int(dados.get("CodigoParlamentar", 0))

            if cod in excluidos:
                print(f"  IGNORADO {cod} {dados.get('NomeParlamentar', '')} — {excluidos[cod]}")
                continue

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

            processos = fetch_processos(cod, data_inicio)
            print(f"    -> {len(processos)} proposicoes")

            for proc in processos:
                situacao, aprovada = classifica_situacao_senado(proc)
                autor_principal = proc.get("objetivo", "").strip().lower() == "iniciadora"
                data_apres = proc.get("dataApresentacao", "")
                upsert_proposicao(conn, {
                    "parlamentar_id": parl_id,
                    "casa": "senado",
                    "tipo": proc["_tipo"],
                    "numero": proc["_numero"],
                    "ano": proc["_ano"],
                    "ementa": proc.get("ementa"),
                    "autor_principal": autor_principal,
                    "situacao": situacao,
                    "aprovada": aprovada,
                    "data_apresentacao": data_apres[:10] if data_apres else None,
                    "url_inteiro_teor": proc.get("urlDocumento"),
                })

            conn.commit()

    print("Senado: ingestao concluida.")


if __name__ == "__main__":
    main()
