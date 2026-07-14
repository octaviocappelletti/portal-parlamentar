"""
Remove um parlamentar e todos os seus dados do banco (despesas, proposições, mandatos).
Uso: python remover_parlamentar.py <casa> <id_externo>
Ex:  python remover_parlamentar.py senado 5929
"""

import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
import psycopg

if len(sys.argv) != 3:
    print("Uso: python remover_parlamentar.py <casa> <id_externo>")
    sys.exit(1)

casa = sys.argv[1]
id_externo = int(sys.argv[2])

conn = psycopg.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

# Confirma quem será removido antes de deletar
cur.execute(
    "SELECT id, nome, partido, uf FROM parlamentar WHERE casa = %s AND id_externo = %s",
    (casa, id_externo),
)
row = cur.fetchone()
if not row:
    print(f"Parlamentar não encontrado: casa={casa} id_externo={id_externo}")
    sys.exit(1)

parl_id, nome, partido, uf = row
print(f"Removendo: {nome} ({partido}/{uf}) — id interno: {parl_id}")

# Contagem antes
cur.execute("SELECT COUNT(*) FROM proposicao WHERE parlamentar_id = %s", (parl_id,))
n_prop = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM despesa WHERE parlamentar_id = %s", (parl_id,))
n_desp = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM mandato WHERE parlamentar_id = %s", (parl_id,))
n_mand = cur.fetchone()[0]
print(f"  proposições: {n_prop} | despesas: {n_desp} | mandatos: {n_mand}")

confirmacao = input("Confirmar remoção? [s/N] ").strip().lower()
if confirmacao != "s":
    print("Cancelado.")
    sys.exit(0)

# Remove em ordem por causa das FK
cur.execute("DELETE FROM despesa     WHERE parlamentar_id = %s", (parl_id,))
cur.execute("DELETE FROM proposicao  WHERE parlamentar_id = %s", (parl_id,))
cur.execute("DELETE FROM mandato     WHERE parlamentar_id = %s", (parl_id,))
cur.execute("DELETE FROM parlamentar WHERE id = %s", (parl_id,))
conn.commit()

print(f"Removido com sucesso: {nome}")
conn.close()
