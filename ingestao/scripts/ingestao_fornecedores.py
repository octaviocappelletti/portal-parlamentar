"""
Enriquecimento de fornecedores via dados abertos da Receita Federal.

Abordagem: reverse lookup
  1. Extrai CNPJs únicos de despesa.cnpj_normalizado (14 dígitos)
  2. Baixa os arquivos da RF e lê linha a linha — nunca carrega tudo em memória
  3. Filtra apenas os CNPJs que existem no banco
  4. Faz upsert em fornecedor e replace em fornecedor_socio

Arquivos da Receita Federal (atualização mensal):
  Tabelas de domínio (pequenas, carregadas em memória):
    Cnaes · Naturezas · Qualificacoes · Motivos · Municipios · Simples
  Transacionais (grandes, 10 partes cada):
    Estabelecimentos0..9 · Empresas0..9 · Socios0..9

Layout dos arquivos: CSV separado por ";" sem header, encoding Latin-1.
  Estabelecimentos: cnpj_basico(0) cnpj_ordem(1) cnpj_dv(2) id_mf(3)
                    nome_fantasia(4) sit_cadastral(5) data_sit(6) motivo_sit(7)
                    cidade_ext(8) pais(9) data_inicio(10) cnae_princ(11)
                    cnae_sec(12) tipo_log(13) logradouro(14) numero(15)
                    compl(16) bairro(17) cep(18) uf(19) municipio(20)
  Empresas:         cnpj_basico(0) razao_social(1) nat_juridica(2)
                    qual_responsavel(3) capital(4) porte(5) ente_fed(6)
  Socios:           cnpj_basico(0) id_socio(1) nome(2) cpf_cnpj(3)
                    qualificacao(4) data_entrada(5) pais(6) rep_legal(7)
                    nome_rep(8) qual_rep(9) faixa_etaria(10)
  Simples:          cnpj_basico(0) opcao_simples(1) data_op(2) data_ex(3)
                    opcao_mei(4) data_op_mei(5) data_ex_mei(6)
  Domínios:         codigo(0) descricao(1)

URL base: https://arquivos.receitafederal.gov.br/index.php/s/YggdBLfdninEJX9/download
  ?path=%2F{RF_MES}&files={arquivo}.zip
  RF_MES: variável de ambiente ou mês corrente no formato AAAA-MM (ex: 2026-07)
"""

import base64
import csv
import io
import os
import sys
import zipfile
from datetime import date
from pathlib import Path

import httpx
from dotenv import load_dotenv
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import get_conn, replace_fornecedor_socios, upsert_fornecedor

load_dotenv()

# Share público da Receita Federal no Nextcloud — token estável desde 2023
RF_TOKEN  = os.environ.get("RF_TOKEN", "YggdBLfdninEJX9")
RF_WEBDAV = "https://arquivos.receitafederal.gov.br/public.php/webdav"
RF_MES    = os.environ.get("RF_MES", date.today().strftime("%Y-%m"))
RF_AUTH   = base64.b64encode(f"{RF_TOKEN}:".encode()).decode()

CACHE_DIR = Path(__file__).parent.parent / ".cache" / "receita_federal"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

_RETRY = dict(
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException)),
    reraise=True,
)


# ── Download ──────────────────────────────────────────────────────────────────

def rf_url(arquivo: str) -> str:
    return f"{RF_WEBDAV}/{RF_MES}/{arquivo}.zip"


@retry(**_RETRY)
def download_zip(arquivo: str, force: bool = False) -> Path:
    dest = CACHE_DIR / f"{RF_MES}_{arquivo}.zip"
    if dest.exists() and dest.stat().st_size > 0 and not force:
        print(f"    [cache] {dest.name}")
        return dest
    url = rf_url(arquivo)
    print(f"    [GET] {url}")
    headers = {"Authorization": f"Basic {RF_AUTH}"}
    with httpx.Client(timeout=600, follow_redirects=True) as client:
        with client.stream("GET", url, headers=headers) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("content-length", 0))
            with open(dest, "wb") as f:
                baixado = 0
                for chunk in resp.iter_bytes(chunk_size=1024 * 1024):
                    f.write(chunk)
                    baixado += len(chunk)
                    if total:
                        print(
                            f"\r      {baixado * 100 // total}% "
                            f"({baixado // 1_048_576} / {total // 1_048_576} MB)   ",
                            end="",
                            flush=True,
                        )
            print()
    print(f"    [ok] {dest.name} ({dest.stat().st_size // 1_048_576} MB)")
    return dest


# ── Leitura de CSV dentro do zip ─────────────────────────────────────────────

def csv_do_zip(zip_path: Path):
    """Abre o primeiro arquivo dentro do zip e retorna um csv.reader Latin-1."""
    zf = zipfile.ZipFile(zip_path)
    raw = zf.open(zf.namelist()[0])
    return csv.reader(
        io.TextIOWrapper(raw, encoding="latin-1", errors="replace"),
        delimiter=";",
        quotechar='"',
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def nz(s: str) -> str | None:
    v = s.strip()
    return v if v else None


def parse_date(s: str) -> str | None:
    s = s.strip()
    if not s or s == "00000000" or len(s) != 8:
        return None
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}"


def load_lookup(arquivo: str) -> dict[str, str]:
    """Tabela de domínio código → descrição carregada inteiramente em memória."""
    print(f"  {arquivo}...")
    zp = download_zip(arquivo)
    result: dict[str, str] = {}
    for row in csv_do_zip(zp):
        if len(row) >= 2:
            result[row[0].strip()] = row[1].strip()
    print(f"    {len(result)} entradas")
    return result


# ── CNPJs alvo ────────────────────────────────────────────────────────────────

def get_cnpjs_alvo(conn) -> tuple[set[str], set[str]]:
    """
    Retorna (cnpjs_completos_14d, cnpj_basicos_8d).
    Considera apenas CNPJs (14 dígitos); CPFs (11 dígitos) são ignorados.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT cnpj_normalizado
            FROM despesa
            WHERE cnpj_normalizado IS NOT NULL
              AND length(cnpj_normalizado) = 14
            """
        )
        completos = {row[0] for row in cur.fetchall()}
    basicos = {c[:8] for c in completos}
    print(f"  {len(completos)} CNPJs distintos  |  {len(basicos)} empresas (cnpj_basico)")
    return completos, basicos


# ── Processamento por tipo de arquivo ────────────────────────────────────────

def proc_estabelecimentos(
    cnpjs: set[str],
    municipios: dict[str, str],
    motivos: dict[str, str],
    cnaes: dict[str, str],
) -> dict[str, dict]:
    """Lê Estabelecimentos0..9, retorna {cnpj_completo: dados}."""
    registros: dict[str, dict] = {}

    for i in range(10):
        print(f"  Estabelecimentos{i}...", end=" ", flush=True)
        zp = download_zip(f"Estabelecimentos{i}")
        n = 0
        for row in csv_do_zip(zp):
            if len(row) < 21:
                continue
            cnpj = row[0].strip() + row[1].strip() + row[2].strip()
            if cnpj not in cnpjs:
                continue
            n += 1

            # CNAE secundário: lista de códigos separados por vírgula
            cnae_sec_raw = row[12].strip() if len(row) > 12 else ""
            cnae_sec = [
                {"codigo": cod, "descricao": cnaes.get(cod, "")}
                for cod in (c.strip() for c in cnae_sec_raw.split(","))
                if cod
            ]

            tipo_log = nz(row[13]) if len(row) > 13 else None
            log      = nz(row[14]) if len(row) > 14 else None
            logradouro = " ".join(filter(None, [tipo_log, log])) or None

            municipio_cod = row[20].strip() if len(row) > 20 else ""

            registros[cnpj] = {
                "cnpj":                      cnpj,
                "nome_fantasia":             nz(row[4]),
                "situacao_cadastral":        nz(row[5]),
                "data_situacao_cadastral":   parse_date(row[6]),
                "motivo_situacao_cadastral": motivos.get(row[7].strip() if len(row) > 7 else ""),
                "data_inicio_atividade":     parse_date(row[10]),
                "cnae_principal":            nz(row[11]),
                "cnae_principal_descricao":  cnaes.get(row[11].strip() if len(row) > 11 else ""),
                "cnae_secundarios":          cnae_sec or None,
                "logradouro":                logradouro,
                "numero":                    nz(row[15]) if len(row) > 15 else None,
                "bairro":                    nz(row[17]) if len(row) > 17 else None,
                "cep":                       nz(row[18]) if len(row) > 18 else None,
                "uf":                        nz(row[19]) if len(row) > 19 else None,
                "municipio":                 municipios.get(municipio_cod),
            }
        print(f"{n} encontrados")

    return registros


def proc_empresas(
    cnpj_basicos: set[str],
    naturezas: dict[str, str],
) -> dict[str, dict]:
    """Lê Empresas0..9, retorna {cnpj_basico: dados}."""
    registros: dict[str, dict] = {}

    for i in range(10):
        print(f"  Empresas{i}...", end=" ", flush=True)
        zp = download_zip(f"Empresas{i}")
        n = 0
        for row in csv_do_zip(zp):
            if len(row) < 5:
                continue
            basico = row[0].strip()
            if basico not in cnpj_basicos:
                continue
            n += 1
            nat_cod = nz(row[2]) if len(row) > 2 else None
            registros[basico] = {
                "razao_social":                nz(row[1]) if len(row) > 1 else None,
                "natureza_juridica_codigo":    nat_cod,
                "natureza_juridica_descricao": naturezas.get(nat_cod or ""),
                "capital_social":              nz(row[4]) if len(row) > 4 else None,
                "porte_empresa":               nz(row[5]) if len(row) > 5 else None,
            }
        print(f"{n} encontrados")

    return registros


def proc_simples(cnpj_basicos: set[str]) -> dict[str, dict]:
    """Lê Simples.zip (arquivo único), retorna {cnpj_basico: {opcao_simples, opcao_mei}}."""
    print("  Simples...", end=" ", flush=True)
    zp = download_zip("Simples")
    result: dict[str, dict] = {}
    n = 0
    for row in csv_do_zip(zp):
        if len(row) < 5:
            continue
        basico = row[0].strip()
        if basico not in cnpj_basicos:
            continue
        n += 1
        result[basico] = {
            "opcao_simples": row[1].strip().upper() == "S",
            "opcao_mei":     row[4].strip().upper() == "S",
        }
    print(f"{n} encontrados")
    return result


def proc_socios(
    cnpj_basicos: set[str],
    qualificacoes: dict[str, str],
) -> dict[str, list]:
    """Lê Socios0..9, retorna {cnpj_basico: [lista de socios]}."""
    resultado: dict[str, list] = {}

    for i in range(10):
        print(f"  Socios{i}...", end=" ", flush=True)
        zp = download_zip(f"Socios{i}")
        n = 0
        for row in csv_do_zip(zp):
            if len(row) < 6:
                continue
            basico = row[0].strip()
            if basico not in cnpj_basicos:
                continue
            n += 1
            qual_cod = nz(row[4]) if len(row) > 4 else None
            resultado.setdefault(basico, []).append({
                "identificador_socio":     nz(row[1]) if len(row) > 1 else None,
                "nome":                    nz(row[2]) if len(row) > 2 else None,
                "cpf_representante_legal": nz(row[3]) if len(row) > 3 else None,
                "qualificacao_codigo":     qual_cod,
                "qualificacao_descricao":  qualificacoes.get(qual_cod or ""),
                "data_entrada_sociedade":  parse_date(row[5]) if len(row) > 5 else None,
                "faixa_etaria":            nz(row[10]) if len(row) > 10 else None,
            })
        print(f"{n} encontrados")

    return resultado


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print(f"==> Ingestao Receita Federal  [{RF_MES}]")
    print(f"    cache: {CACHE_DIR}")

    with get_conn() as conn:

        print("\n[1/6] CNPJs alvo...")
        cnpjs, basicos = get_cnpjs_alvo(conn)
        if not cnpjs:
            print("Nenhum CNPJ em despesa. Execute a ingestao de despesas primeiro.")
            return

        print("\n[2/6] Tabelas de dominio...")
        cnaes         = load_lookup("Cnaes")
        naturezas     = load_lookup("Naturezas")
        qualificacoes = load_lookup("Qualificacoes")
        motivos       = load_lookup("Motivos")
        municipios    = load_lookup("Municipios")

        print("\n[3/6] Estabelecimentos...")
        estab = proc_estabelecimentos(cnpjs, municipios, motivos, cnaes)
        print(f"  Total: {len(estab)} estabelecimentos")

        print("\n[4/6] Empresas...")
        empresas = proc_empresas(basicos, naturezas)
        print(f"  Total: {len(empresas)} empresas")

        print("\n[5/6] Simples Nacional...")
        simples = proc_simples(basicos)
        print(f"  Total: {len(simples)} registros")

        print("\n[6/6] Socios...")
        socios = proc_socios(basicos, qualificacoes)
        n_socios_total = sum(len(v) for v in socios.values())
        print(f"  Total: {n_socios_total} socios para {len(socios)} empresas")

        # ── Upsert ───────────────────────────────────────────────────────────
        print("\n==> Gravando no banco...")

        cnpjs_nao_encontrados = cnpjs - estab.keys()
        if cnpjs_nao_encontrados:
            print(
                f"  AVISO: {len(cnpjs_nao_encontrados)} CNPJ(s) nao encontrados nos arquivos da RF "
                f"(CNPJ invalido ou empresa removida do cadastro)"
            )

        n_forn = n_soc = 0
        for cnpj, est in estab.items():
            basico = cnpj[:8]
            emp    = empresas.get(basico, {})
            simp   = simples.get(basico, {})

            upsert_fornecedor(conn, {
                **est,
                "razao_social":                emp.get("razao_social"),
                "natureza_juridica_codigo":    emp.get("natureza_juridica_codigo"),
                "natureza_juridica_descricao": emp.get("natureza_juridica_descricao"),
                "capital_social":              emp.get("capital_social"),
                "porte_empresa":               emp.get("porte_empresa"),
                "opcao_simples":               simp.get("opcao_simples"),
                "opcao_mei":                   simp.get("opcao_mei"),
            })
            n_forn += 1

            lista = socios.get(basico, [])
            replace_fornecedor_socios(
                conn,
                cnpj,
                [{"fornecedor_cnpj": cnpj, **s} for s in lista],
            )
            n_soc += len(lista)

        conn.commit()
        print(f"  {n_forn} fornecedores  |  {n_soc} socios")

    print("\nReceita Federal: ingestao concluida.")


if __name__ == "__main__":
    main()
