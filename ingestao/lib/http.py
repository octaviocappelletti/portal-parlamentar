"""
Cliente HTTP com retry/backoff para as APIs do governo.
As APIs punem paralelismo agressivo — use concorrência baixa e pause entre chamadas.
"""

import hashlib
import json
import os
import time
from pathlib import Path

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

CACHE_DIR = Path(__file__).parent.parent / ".cache"
CACHE_DIR.mkdir(exist_ok=True)

_RETRY = dict(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=16),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException)),
    reraise=True,
)


def _cache_path(url: str, params: dict | None) -> Path:
    key = json.dumps({"url": url, "params": params or {}}, sort_keys=True)
    digest = hashlib.md5(key.encode()).hexdigest()
    return CACHE_DIR / f"{digest}.json"


@retry(**_RETRY)
def get_json(url: str, params: dict | None = None, pause: float = 0.15, use_cache: bool = True) -> dict | list:
    path = _cache_path(url, params)
    if use_cache and path.exists():
        return json.loads(path.read_text("utf-8"))

    with httpx.Client(timeout=40) as client:
        resp = client.get(url, params=params, headers={"Accept": "application/json"})
        resp.raise_for_status()
    time.sleep(pause)

    data = resp.json()
    if use_cache:
        path.write_text(json.dumps(data, ensure_ascii=False), "utf-8")
    return data


@retry(**_RETRY)
def get_xml(url: str, params: dict | None = None, pause: float = 0.15, use_cache: bool = True) -> bytes:
    path = _cache_path(url, params)
    if use_cache and path.exists():
        return path.read_bytes()

    with httpx.Client(timeout=40) as client:
        resp = client.get(url, params=params, headers={"Accept": "application/xml"})
        resp.raise_for_status()
    time.sleep(pause)

    if use_cache:
        path.write_bytes(resp.content)
    return resp.content
