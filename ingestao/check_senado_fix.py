import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from scripts.ingestao_senadores import fetch_processos

# Testa Renan Calheiros com data de início de mandato real
processos = fetch_processos(70, "2023-02-01")
print(f"Renan Calheiros: {len(processos)} proposicoes")
for p in processos[:5]:
    print(f"  {p['_tipo']} {p['_numero']}/{p['_ano']} | autor_principal={p.get('objetivo')} | aprovada={bool(p.get('normaGerada'))}")
    print(f"  ementa: {(p.get('ementa') or '')[:80]}")
