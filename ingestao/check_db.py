import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
import psycopg

conn = psycopg.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

print("=== PARLAMENTARES ===")
cur.execute("SELECT casa, COUNT(*) FROM parlamentar GROUP BY casa ORDER BY casa")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

print("\n=== MANDATOS ===")
cur.execute("SELECT COUNT(*) FROM mandato")
print(f"  total: {cur.fetchone()[0]}")

print("\n=== PROPOSICOES ===")
cur.execute("""
    SELECT casa, COUNT(*),
           COUNT(*) FILTER (WHERE aprovada) as aprovadas,
           COUNT(*) FILTER (WHERE autor_principal) as autor_principal
    FROM proposicao GROUP BY casa ORDER BY casa
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} total | {row[2]} aprovadas | {row[3]} como autor principal")

print("\n=== DESPESAS ===")
cur.execute("""
    SELECT p.casa, COUNT(d.id), ROUND(SUM(d.valor_liquido)::numeric, 2)
    FROM despesa d
    JOIN parlamentar p ON p.id = d.parlamentar_id
    GROUP BY p.casa ORDER BY p.casa
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} registros | R$ {row[2]:,.2f}")

print("\n=== SENADORES — top 5 por gasto CEAP ===")
cur.execute("""
    SELECT p.nome, ROUND(SUM(d.valor_liquido)::numeric, 2) as total
    FROM despesa d
    JOIN parlamentar p ON p.id = d.parlamentar_id
    WHERE p.casa = 'senado'
    GROUP BY p.nome ORDER BY total DESC LIMIT 5
""")
for row in cur.fetchall():
    print(f"  {row[0]}: R$ {row[1]:,.2f}")

conn.close()
