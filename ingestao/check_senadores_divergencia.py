import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from lib.http import get_xml
from lib.senado_decode import xml_to_dict, ensure_list

LEG = 57
content = get_xml(f"https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/{LEG}", use_cache=False)
root = xml_to_dict(content)
parlamentares = ensure_list(
    root.get("ListaParlamentarLegislatura", {})
        .get("Parlamentares", {})
        .get("Parlamentar", [])
)

tipos = {}
exemplos = {}
for p in parlamentares:
    mandato_raw = p.get("Mandatos", {}).get("Mandato", {})
    # Pode ser lista (múltiplos mandatos) ou dict (mandato único)
    mandatos_list = ensure_list(mandato_raw)
    # Pega o mandato da legislatura 57
    mandato = next((m for m in mandatos_list if
                    str(m.get("SegundaLegislaturaDoMandato", {}).get("NumeroLegislatura", "")) == str(LEG) or
                    str(m.get("PrimeiraLegislaturaDoMandato", {}).get("NumeroLegislatura", "")) == str(LEG)),
                   mandatos_list[0] if mandatos_list else {})
    participacao = mandato.get("DescricaoParticipacao", "N/A")
    tipos[participacao] = tipos.get(participacao, 0) + 1
    if participacao not in exemplos:
        nome = p.get("IdentificacaoParlamentar", {}).get("NomeParlamentar", "?")
        titular = mandato.get("Titular", {})
        exemplos[participacao] = f"{nome} (titular: {titular.get('NomeParlamentar', 'si mesmo')})"

print(f"Total retornado pela API: {len(parlamentares)}")
print()
print("Distribuição por DescricaoParticipacao (dentro de Mandatos.Mandato):")
for t, qtd in sorted(tipos.items(), key=lambda x: -x[1]):
    print(f"  '{t}': {qtd}  — ex: {exemplos[t]}")

print()
titulares = [p for p in parlamentares
             if ensure_list(p.get("Mandatos", {}).get("Mandato", {}))[0].get("DescricaoParticipacao") == "Titular"
             if ensure_list(p.get("Mandatos", {}).get("Mandato", {}))]
print(f"Senadores Titulares: {len(titulares)}")
