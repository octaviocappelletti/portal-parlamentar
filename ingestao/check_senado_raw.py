import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from lib.http import get_xml, get_json
from lib.senado_decode import xml_to_dict
import json

cod = 70  # Renan Calheiros

print("=== /autorias XML bruto ===")
content = get_xml(f"https://legis.senado.leg.br/dadosabertos/senador/{cod}/autorias", use_cache=False)
root = xml_to_dict(content)
print(json.dumps(root, indent=2, ensure_ascii=False)[:2000])

print("\n=== /processo JSON ===")
data = get_json(
    "https://legis.senado.leg.br/dadosabertos/processo",
    {"codigoParlamentarAutor": cod, "sigla": "PL", "dataInicio": "2023-02-01"},
    use_cache=False
)
print(json.dumps(data, indent=2, ensure_ascii=False)[:2000])
