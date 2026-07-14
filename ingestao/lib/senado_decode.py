"""
Parsing de respostas do Senado (XML/JSON misturados) e correção de encoding.

§6.15 — dois bugs de encoding:
1. normaGerada vem em Windows-1252 mas o header declara UTF-8 → tenta utf-8, cai para cp1252.
2. Terminal Windows (cp1252) → force PYTHONIOENCODING=utf-8 antes de rodar.
"""

import xmltodict


def decode_bytes(content: bytes) -> str:
    """Decodifica resposta tentando UTF-8 e caindo para Windows-1252 (§6.15)."""
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("windows-1252")


def xml_to_dict(content: bytes) -> dict:
    text = decode_bytes(content)
    return xmltodict.parse(text)


def ensure_list(value) -> list:
    """xmltodict retorna dict quando há 1 item e lista quando há vários — normaliza."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]
