import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from lib.http import get_xml
from lib.senado_decode import xml_to_dict, ensure_list

# Testa autorias para 3 senadores conhecidos
TESTES = [
    (5012, "Randolfe Rodrigues"),
    (70,   "Renan Calheiros"),
    (5894, "Flávio Bolsonaro"),
]

for cod, nome in TESTES:
    try:
        content = get_xml(f"https://legis.senado.leg.br/dadosabertos/senador/{cod}/autorias", use_cache=False)
        root = xml_to_dict(content)
        autorias = (
            root.get("AutoriasParlamentar", {})
                .get("Parlamentar", {})
                .get("Autorias", {})
                .get("Autoria", [])
        )
        autorias = ensure_list(autorias)
        print(f"{nome} ({cod}): {len(autorias)} autorias")
        if autorias:
            a = autorias[0]
            print(f"  ex: {a.get('SiglaTipoMateria')} {a.get('NumeroMateria')}/{a.get('AnoMateria')} | autor principal: {a.get('IndicadorAutorPrincipal')}")
    except Exception as e:
        print(f"{nome} ({cod}): ERRO - {e}")
