"""
Diagnóstico: inspeciona o campo 'objetivo' retornado pelo endpoint /processo
para um senador específico, ajudando a entender quais valores indicam autoria.

Uso:
    python check_objetivo_senado.py
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from lib.http import get_json

BASE = "https://legis.senado.leg.br/dadosabertos"

# Daniella Ribeiro (5998) — senadora cujo card mostrou proposição errada
# Damares Alves (6335) — autora real da PEC 10/2026
SENADORES = [
    (5998, "Daniella Ribeiro"),
    (6335, "Damares Alves"),
]

for cod, nome in SENADORES:
    print(f"\n{'='*60}")
    print(f"Senador: {nome} (cod={cod})")
    print(f"{'='*60}")

    objetivos_vistos: dict[str, list[str]] = {}

    for sigla in ("PEC", "PL"):
        for tramitando in ("S", "N"):
            data = get_json(
                f"{BASE}/processo",
                {"codigoParlamentarAutor": cod, "sigla": sigla, "tramitando": tramitando},
                use_cache=False,
            )
            items = data if isinstance(data, list) else data.get("dados", [])
            for item in items:
                obj = item.get("objetivo") or ""
                ident = item.get("identificacao", "?")
                objetivos_vistos.setdefault(obj, []).append(ident)

    print(f"\nValores únicos de 'objetivo' encontrados ({len(objetivos_vistos)} tipos):")
    for obj, idents in sorted(objetivos_vistos.items()):
        print(f"  {obj!r:30s} → {len(idents)} proposições  ex: {idents[0]}")

    # Verifica especificamente a PEC 10/2026
    print(f"\nBusca específica por PEC 10/2026:")
    for sigla in ("PEC",):
        for tramitando in ("S", "N"):
            data = get_json(
                f"{BASE}/processo",
                {"codigoParlamentarAutor": cod, "sigla": sigla, "tramitando": tramitando},
                use_cache=False,
            )
            items = data if isinstance(data, list) else data.get("dados", [])
            for item in items:
                ident = item.get("identificacao", "")
                if "10/2026" in ident and "PEC" in ident:
                    print(f"  ENCONTRADO! objetivo={item.get('objetivo')!r}")
                    print(f"  Campos relevantes:")
                    for k in ("identificacao", "objetivo", "tramitando", "situacaoAtual",
                              "normaGerada", "siglaTipoDeliberacao", "ementa"):
                        print(f"    {k}: {item.get(k)!r}")
