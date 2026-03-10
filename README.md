# RAG LinkedIn Portfolio

A Retrieval-Augmented Generation (RAG) system that answers questions about my professional profile using only documented sources.

The assistant is grounded in structured documents derived from my CV and project portfolio, ensuring answers are traceable and verifiable.

## Live Demo
Ask questions about my experience, projects, or skills.
[Try it yourself](https://rag.davidlician.com/)

Examples:
- "What projects has David worked on?"
- "What technologies does he use?"
- "What is his professional background?"

---

# Architecture

This project implements a lightweight RAG architecture composed of three layers:

1. **Document Corpus**
2. **Vector Retrieval System**
3. **LLM Answer Generation**

Documents are converted into embeddings offline and served as a static vector store.

# Repository Structure

```
rag-linkedin-portfolio
│
├─ scripts
│   └─ build_rag_corpus.py
│
├─ web
│   ├─ functions
│   │   └─ api
│   │       ├─ chat.ts
│   │       └─ health.ts
│   │
│   ├─ public
│   │   └─ rag
│   │       ├─ docs
│   │       │   ├─ about.md
│   │       │   ├─ cv_public.md
│   │       │   ├─ project_cases.md
│   │       │   └─ faq.md
│   │       │
│   │       ├─ chunks.json.gz
│   │       └─ manifest.json
│   │
│   └─ src
│       ├─ App.tsx
│       ├─ TurnstileGate.tsx
│       └─ main.tsx
│
└─ README.md
```

# How it works

## 1. Document ingestion

Portfolio documents are written as Markdown files:
web/public/rag/docs/

These include:
- CV
- project case studies
- skills matrix
- FAQ

## 2. Offline vectorization

The script:
scripts/build_rag_corpus.py

performs:
- text cleaning
- chunking
- OpenAI embeddings generation
- vector store creation

Output:
chunks.json.gz
manifest.json

## 3. Retrieval pipeline

When a user asks a question:
1. Question is embedded
2. Cosine similarity search retrieves top-k chunks
3. Context is assembled
4. LLM generates the final grounded answer

## 4. Response generation

The system enforces strict grounding rules:
- Answer only using provided context
- If information is missing → say so
- Cite sources used for the answer

# Security & robustness

The system includes:
- Rate limiting
- Cloudflare Turnstile bot protection
- CORS origin restrictions
- Context length controls
- Retrieval confidence thresholds

# Stack

Frontend
- React
- TypeScript
- Vite

Backend
- Cloudflare Functions
- OpenAI API

Retrieval
- Cosine similarity search
- Static vector store

# Why this project

This project explores how a personal portfolio can become a queryable knowledge base.

Instead of browsing static pages, visitors can interactively ask questions about experience, projects, and skills.
