import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from lib.http import get_xml
from lib.senado_decode import xml_to_dict, ensure_list

# Inspeciona a estrutura de um senador sem UF (Flávio Dino = 4605)
# e um com UF (Renan Calheiros = 70) para comparar
for cod, nome in [(4605, "Flávio Dino"), (70, "Renan Calheiros")]:
    content = get_xml(f"https://legis.senado.leg.br/dadosabertos/senador/{cod}", use_cache=False)
    root = xml_to_dict(content)
    dados = root.get("DetalheParlamentar", {}).get("Parlamentar", {})
    identif = dados.get("IdentificacaoParlamentar", {})
    print(f"\n=== {nome} ({cod}) ===")
    print(f"  UfParlamentar (IdentificacaoParlamentar): {identif.get('UfParlamentar')}")
    print(f"  Campos de IdentificacaoParlamentar: {list(identif.keys())}")
