"""Inspeciona os dados da suplente em exercício e do titular afastado."""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from lib.http import get_xml, get_json
from lib.senado_decode import xml_to_dict, ensure_list

LEG = 57
BASE = "https://legis.senado.leg.br/dadosabertos"

for cod, nome in [(5016, "Wellington Dias"), (6369, "Jussara Lima")]:
    content = get_xml(f"{BASE}/senador/{cod}", use_cache=False)
    root = xml_to_dict(content)
    parl = root.get("DetalheParlamentar", {}).get("Parlamentar", {})
    identif = parl.get("IdentificacaoParlamentar", {})
    print(f"\n=== {nome} ({cod}) ===")
    print(f"  UF:      {identif.get('UfParlamentar')}")
    print(f"  Partido: {identif.get('SiglaPartidoParlamentar')}")
    print(f"  Foto:    {identif.get('UrlFotoParlamentar', '')[:60]}")
