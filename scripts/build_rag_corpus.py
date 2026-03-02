#!/usr/bin/env python3
"""
Build RAG corpus (offline):
- Reads docs from web/public/rag/docs/
- Chunks text
- Creates OpenAI embeddings in batches
- Writes:
  - web/public/rag/chunks.json.gz
  - web/public/rag/manifest.json

Usage:
  export OPENAI_API_KEY="..."
  python scripts/build_rag_corpus.py

Optional:
  pip install tiktoken
"""

from __future__ import annotations

import os
import re
import json
import gzip
import time
import math
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

# OpenAI Python SDK
# pip install openai
from openai import OpenAI


# -----------------------
# Config (edit if needed)
# -----------------------
DEFAULT_DOCS_DIR = Path("web/public/rag/docs")
DEFAULT_OUT_DIR = Path("web/public/rag")

EMBEDDING_MODEL = os.getenv("RAG_EMBEDDING_MODEL", "text-embedding-3-small")
BATCH_SIZE = int(os.getenv("RAG_EMBEDDING_BATCH_SIZE", "64"))

# Chunking:
# - If tiktoken is installed, we'll chunk by tokens.
# - Otherwise, chunk by characters (works fine for MVP).
CHUNK_TOKENS = int(os.getenv("RAG_CHUNK_TOKENS", "350"))
OVERLAP_TOKENS = int(os.getenv("RAG_OVERLAP_TOKENS", "60"))

CHUNK_CHARS = int(os.getenv("RAG_CHUNK_CHARS", "1400"))
OVERLAP_CHARS = int(os.getenv("RAG_OVERLAP_CHARS", "250"))

# Safety
MAX_DOC_BYTES = int(os.getenv("RAG_MAX_DOC_BYTES", str(2_000_000)))  # 2MB per file


# -----------------------
# Optional tokenization
# -----------------------
def try_get_tokenizer():
    try:
        import tiktoken  # type: ignore

        # Use a generic encoding (works well). You can swap if you want.
        enc = tiktoken.get_encoding("cl100k_base")
        return enc
    except Exception:
        return None


TOKENIZER = try_get_tokenizer()


# -----------------------
# Helpers
# -----------------------
def sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def clean_text(s: str) -> str:
    # Normalize whitespace, keep paragraphs.
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def read_text_file(path: Path) -> str:
    b = path.read_bytes()
    if len(b) > MAX_DOC_BYTES:
        raise ValueError(f"File too large: {path} ({len(b)} bytes)")
    # Try utf-8, fallback latin-1
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        return b.decode("latin-1")


def split_into_paragraphs(text: str) -> List[str]:
    # Keep meaningful paragraph boundaries
    parts = [p.strip() for p in text.split("\n\n")]
    return [p for p in parts if p]


def chunk_by_chars(text: str, chunk_chars: int, overlap_chars: int) -> List[Tuple[int, int, str]]:
    chunks: List[Tuple[int, int, str]] = []
    n = len(text)
    if n == 0:
        return chunks

    start = 0
    while start < n:
        end = min(n, start + chunk_chars)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append((start, end, chunk))
        if end >= n:
            break
        start = max(0, end - overlap_chars)

    return chunks


def chunk_by_tokens(text: str, chunk_tokens: int, overlap_tokens: int) -> List[Tuple[int, int, str]]:
    # We return (start_char, end_char, chunk_text) even when chunking by tokens.
    # We'll approximate start/end chars by searching; sufficient for citations in MVP.
    assert TOKENIZER is not None

    tokens = TOKENIZER.encode(text)
    if not tokens:
        return []

    chunks: List[Tuple[int, int, str]] = []
    step = max(1, chunk_tokens - overlap_tokens)

    for i in range(0, len(tokens), step):
        window = tokens[i : i + chunk_tokens]
        if not window:
            continue
        chunk_text = TOKENIZER.decode(window).strip()
        if not chunk_text:
            continue

        # Approximate char span (best-effort)
        # Find first occurrence after previous end
        if chunks:
            prev_end = chunks[-1][1]
            idx = text.find(chunk_text, prev_end)
            if idx == -1:
                idx = text.find(chunk_text)
        else:
            idx = text.find(chunk_text)
        if idx == -1:
            idx = 0
        start_char = idx
        end_char = min(len(text), idx + len(chunk_text))
        chunks.append((start_char, end_char, chunk_text))

        if i + chunk_tokens >= len(tokens):
            break

    return chunks


def backoff_sleep(attempt: int) -> None:
    # exponential backoff with jitter (simple)
    base = min(10.0, 0.8 * (2 ** attempt))
    jitter = 0.1 * base
    time.sleep(base + (jitter * (attempt % 3)))


@dataclass
class Doc:
    doc_id: str
    title: str
    path: str
    text: str


def load_docs(docs_dir: Path) -> List[Doc]:
    exts = {".md", ".txt"}
    docs: List[Doc] = []
    for p in sorted(docs_dir.rglob("*")):
        if not p.is_file():
            continue
        if p.suffix.lower() not in exts:
            continue

        raw = read_text_file(p)
        text = clean_text(raw)
        rel = str(p.as_posix())
        title = p.stem
        doc_id = sha1(rel)[:12]
        docs.append(Doc(doc_id=doc_id, title=title, path=rel, text=text))
    return docs


def build_chunks(docs: List[Doc]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for d in docs:
        if not d.text:
            continue

        # Optional paragraph-first: helps keep structure stable
        paragraphs = split_into_paragraphs(d.text)
        joined = "\n\n".join(paragraphs)

        if TOKENIZER is not None:
            spans = chunk_by_tokens(joined, CHUNK_TOKENS, OVERLAP_TOKENS)
            chunking = {
                "method": "tokens",
                "chunk_tokens": CHUNK_TOKENS,
                "overlap_tokens": OVERLAP_TOKENS,
            }
        else:
            spans = chunk_by_chars(joined, CHUNK_CHARS, OVERLAP_CHARS)
            chunking = {
                "method": "chars",
                "chunk_chars": CHUNK_CHARS,
                "overlap_chars": OVERLAP_CHARS,
            }

        for idx, (start, end, chunk_text) in enumerate(spans):
            chunk_id = f"{d.doc_id}-{idx:04d}"
            out.append(
                {
                    "id": chunk_id,
                    "doc_id": d.doc_id,
                    "doc_title": d.title,
                    "source_path": d.path,
                    "start": start,
                    "end": end,
                    "text": chunk_text,
                    "embedding": None,  # fill later
                    "hash": sha1(chunk_text)[:16],
                    "chunking": chunking,
                }
            )
    return out


def embed_batches(client: OpenAI, texts: List[str], model: str, batch_size: int) -> List[List[float]]:
    vectors: List[List[float]] = []
    total = len(texts)
    for i in range(0, total, batch_size):
        batch = texts[i : i + batch_size]

        # Retry on transient failures
        for attempt in range(0, 6):
            try:
                resp = client.embeddings.create(model=model, input=batch)
                # resp.data is list with .embedding in same order as inputs
                batch_vecs = [item.embedding for item in resp.data]
                vectors.extend(batch_vecs)
                break
            except Exception as e:
                if attempt >= 5:
                    raise
                backoff_sleep(attempt)

        done = min(i + batch_size, total)
        print(f"Embedded {done}/{total}")

    return vectors


def main():
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("Missing OPENAI_API_KEY env var.")

    docs_dir = Path(os.getenv("RAG_DOCS_DIR", str(DEFAULT_DOCS_DIR)))
    out_dir = Path(os.getenv("RAG_OUT_DIR", str(DEFAULT_OUT_DIR)))
    out_dir.mkdir(parents=True, exist_ok=True)

    if not docs_dir.exists():
        raise SystemExit(f"Docs dir not found: {docs_dir}")

    print(f"Docs dir: {docs_dir}")
    print(f"Out dir : {out_dir}")
    print(f"Embedding model: {EMBEDDING_MODEL}")
    print(f"Tokenizer: {'tiktoken' if TOKENIZER is not None else 'chars fallback'}")

    docs = load_docs(docs_dir)
    if not docs:
        raise SystemExit("No docs found (.md/.txt).")

    chunks = build_chunks(docs)
    if not chunks:
        raise SystemExit("No chunks created (empty docs?).")

    client = OpenAI(api_key=api_key)

    texts = [c["text"] for c in chunks]
    vectors = embed_batches(client, texts, EMBEDDING_MODEL, BATCH_SIZE)

    if len(vectors) != len(chunks):
        raise SystemExit(f"Embedding count mismatch: {len(vectors)} vs chunks {len(chunks)}")

    # Fill embeddings + infer dimension
    dim = len(vectors[0]) if vectors else 0
    for c, v in zip(chunks, vectors):
        c["embedding"] = v

    # Build manifest
    created_at = datetime.now(timezone.utc).isoformat()
    manifest = {
        "version": sha1(created_at)[:12],
        "created_at": created_at,
        "embedding_model": EMBEDDING_MODEL,
        "embedding_dim": dim,
        "docs_dir": str(docs_dir.as_posix()),
        "num_docs": len(docs),
        "num_chunks": len(chunks),
        "chunking": chunks[0].get("chunking", {}),
        "build": {
            "generator": "scripts/build_rag_corpus.py",
            "python": f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}",
        },
    }

    # Write manifest.json
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {manifest_path}")

    # Write chunks.json.gz
    chunks_path = out_dir / "chunks.json.gz"
    with gzip.open(chunks_path, "wt", encoding="utf-8") as f:
        json.dump({"chunks": chunks}, f, ensure_ascii=False)
    print(f"Wrote {chunks_path}")

    print("Done ✅")


if __name__ == "__main__":
    main()