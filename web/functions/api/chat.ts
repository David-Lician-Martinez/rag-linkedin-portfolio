// web/functions/api/chat.ts
const BUILD_TAG = "OPENAI_V1_2026-02-25";

// Seguridad / límites
const PER_MINUTE_LIMIT = 8;
const PER_DAY_LIMIT = 80;
const MAX_BODY_BYTES = 10_000;
const MAX_QUESTION_CHARS = 800;

// RAG config
const RAG_CHUNKS_PATH = "/rag/chunks.json.gz";
const RAG_TOP_K = 6;
const RAG_MIN_SCORE = 0.20; // umbral conservador para “hay evidencia”

type ChatRequest = {
  question?: string;
  turnstileToken?: string;
};

type Env = {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  TURNSTILE_SECRET_KEY: string;

  // opcional (si no existen, usamos defaults)
  OPENAI_EMBEDDING_MODEL?: string; // ej: "text-embedding-3-small"
};

const ALLOWED_ORIGINS = new Set([
  "https://rag-linkedin-portfolio.pages.dev",
  "http://localhost:5173",
]);

function jsonResponse(
  request: Request,
  status: number,
  payload: unknown,
  extraHeaders: Record<string, string> = {}
) {
  const origin = request.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return new Response(JSON.stringify(payload), { status, headers });
}

function corsPreflight(request: Request) {
  const origin = request.headers.get("Origin") || "";
  const headers: Record<string, string> = {};

  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type";
  headers["Access-Control-Max-Age"] = "86400";

  return new Response(null, { status: 204, headers });
}

function getClientIP(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function epochMinute(): number {
  return Math.floor(Date.now() / 60000);
}

function epochDayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function bumpCounter(cache: Cache, key: string, ttlSeconds: number): Promise<number> {
  const cacheKey = new Request(`https://rate.limit.local/${encodeURIComponent(key)}`);

  const hit = await cache.match(cacheKey);
  let count = 0;

  if (hit) {
    const txt = await hit.text();
    const parsed = Number(txt);
    count = Number.isFinite(parsed) ? parsed : 0;
  }

  count += 1;

  const res = new Response(String(count), {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": `public, max-age=${ttlSeconds}`,
    },
  });

  await cache.put(cacheKey, res);
  return count;
}

async function enforceRateLimit(
  request: Request
): Promise<{ ok: true } | { ok: false; res: Response }> {
  const cache = caches.default;
  const ip = getClientIP(request);

  const minKey = `ip:${ip}:min:${epochMinute()}`;
  const minCount = await bumpCounter(cache, minKey, 60);
  if (minCount > PER_MINUTE_LIMIT) {
    return {
      ok: false,
      res: jsonResponse(
        request,
        429,
        { error: "rate_limited", scope: "minute", retry_after: 60, build: BUILD_TAG },
        { "Retry-After": "60" }
      ),
    };
  }

  const dayKey = `ip:${ip}:day:${epochDayUTC()}`;
  const dayCount = await bumpCounter(cache, dayKey, 86400);
  if (dayCount > PER_DAY_LIMIT) {
    return {
      ok: false,
      res: jsonResponse(
        request,
        429,
        { error: "rate_limited", scope: "day", retry_after: 86400, build: BUILD_TAG },
        { "Retry-After": "86400" }
      ),
    };
  }

  return { ok: true };
}

async function verifyTurnstile(secret: string, token: string, request: Request): Promise<boolean> {
  const ip = getClientIP(request);

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip !== "unknown") form.append("remoteip", ip);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  if (!resp.ok) return false;

  const data = (await resp.json()) as any;
  return Boolean(data?.success);
}

/* ---------------------------
   RAG: load + cosine retrieval
---------------------------- */

type RagChunk = {
  id: string;
  doc_id?: string;
  doc_title?: string;
  source_path?: string;
  start?: number;
  end?: number;
  text: string;
  embedding: number[];
  hash?: string;
};

type RagStore = {
  chunks: RagChunk[];
  norms: Float32Array; // precomputed L2 norms for chunk embeddings
  dim: number;
  loadedAt: number;
};

let RAG_CACHE: RagStore | null = null;

async function gunzipToText(resp: Response): Promise<string> {
  // Cloudflare Workers supports DecompressionStream in most runtimes
  const ds = new DecompressionStream("gzip");
  const decompressed = resp.body?.pipeThrough(ds);
  if (!decompressed) throw new Error("Missing response body for gzip stream.");

  const ab = await new Response(decompressed).arrayBuffer();
  return new TextDecoder("utf-8").decode(ab);
}

function l2Norm(vec: number[]): number {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i];
  return Math.sqrt(s) || 1e-12;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

async function loadRagStore(requestUrl: string): Promise<RagStore> {
  if (RAG_CACHE) return RAG_CACHE;

  // Fetch static asset from same origin
  const url = new URL(RAG_CHUNKS_PATH, requestUrl);
  const resp = await fetch(url.toString(), { method: "GET" });

  if (!resp.ok) {
    throw new Error(`Failed to load RAG chunks: ${resp.status} ${await resp.text()}`);
  }

  const text = await gunzipToText(resp);
  const json = JSON.parse(text) as { chunks: RagChunk[] };

  const chunks = json?.chunks ?? [];
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error("RAG chunks file is empty or invalid.");
  }

  const dim = chunks[0]?.embedding?.length ?? 0;
  if (!dim) throw new Error("RAG chunks have missing embeddings.");

  const norms = new Float32Array(chunks.length);
  for (let i = 0; i < chunks.length; i++) {
    const e = chunks[i]?.embedding;
    if (!e || e.length !== dim) {
      throw new Error(`Embedding dim mismatch at chunk index ${i}.`);
    }
    norms[i] = l2Norm(e);
  }

  RAG_CACHE = {
    chunks,
    norms,
    dim,
    loadedAt: Date.now(),
  };

  return RAG_CACHE;
}

async function embedQuery(question: string, env: Env): Promise<number[]> {
  const embeddingModel = env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: question,
    }),
  });

  if (!resp.ok) {
    const errTxt = await resp.text();
    throw new Error(`OpenAI embeddings error: ${errTxt}`);
  }

  const data = (await resp.json()) as any;
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("Invalid embeddings response.");
  return vec as number[];
}

function topKCosine(
  queryVec: number[],
  store: RagStore,
  k: number
): Array<{ idx: number; score: number }> {
  const qNorm = l2Norm(queryVec);
  const out: Array<{ idx: number; score: number }> = [];

  for (let i = 0; i < store.chunks.length; i++) {
    const c = store.chunks[i];
    const score = dot(queryVec, c.embedding) / (qNorm * store.norms[i]);
    // Insert into top-k list (small k -> simple insertion is fine)
    if (out.length < k) {
      out.push({ idx: i, score });
      out.sort((a, b) => b.score - a.score);
    } else if (score > out[out.length - 1].score) {
      out[out.length - 1] = { idx: i, score };
      out.sort((a, b) => b.score - a.score);
    }
  }

  return out;
}

function buildContextAndSources(
  store: RagStore,
  picks: Array<{ idx: number; score: number }>
): { context: string; sources: any[] } {
  const sources = picks.map(({ idx, score }) => {
    const c = store.chunks[idx];
    const excerpt = c.text.length > 240 ? c.text.slice(0, 240) + "…" : c.text;
    return {
      id: c.id,
      doc_title: c.doc_title || "",
      source_path: c.source_path || "",
      score: Number(score.toFixed(4)),
      excerpt,
    };
  });

  // Context to pass to the model; include stable citation keys
  const context = picks
    .map(({ idx }) => {
      const c = store.chunks[idx];
      const cite = c.source_path || c.doc_title || c.id;
      return `SOURCE: [${cite}]\n${c.text}`;
    })
    .join("\n\n---\n\n");

  return { context, sources };
}

/* ---------------------------
   Main handler
---------------------------- */

export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  if (request.method === "OPTIONS") return corsPreflight(request);

  if (request.method !== "POST") {
    return jsonResponse(request, 405, { error: "method_not_allowed", build: BUILD_TAG });
  }

  const ct = request.headers.get("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return jsonResponse(request, 415, { error: "invalid_content_type", build: BUILD_TAG });
  }

  const len = Number(request.headers.get("Content-Length") || "0");
  if (len && len > MAX_BODY_BYTES) {
    return jsonResponse(request, 413, { error: "payload_too_large", build: BUILD_TAG });
  }

  const rl = await enforceRateLimit(request);
  if (!rl.ok) return rl.res;

  const body: ChatRequest = await request.json().catch(() => ({}));
  const question = (body.question ?? "").toString().trim();
  const turnstileToken = (body.turnstileToken ?? "").toString().trim();

  if (!question) {
    return jsonResponse(request, 400, { error: "missing_question", build: BUILD_TAG });
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return jsonResponse(request, 400, {
      error: "question_too_long",
      max: MAX_QUESTION_CHARS,
      build: BUILD_TAG,
    });
  }

  if (!turnstileToken) {
    return jsonResponse(request, 403, { error: "turnstile_missing", build: BUILD_TAG });
  }
  if (!env.TURNSTILE_SECRET_KEY) {
    return jsonResponse(request, 500, { error: "missing_turnstile_secret", build: BUILD_TAG });
  }
  const okTurnstile = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, turnstileToken, request);
  if (!okTurnstile) {
    return jsonResponse(request, 403, { error: "turnstile_invalid", build: BUILD_TAG });
  }

  if (!env.OPENAI_API_KEY) {
    return jsonResponse(request, 500, {
      error: "missing_openai_api_key",
      details: "Missing OPENAI_API_KEY in Cloudflare environment variables.",
      build: BUILD_TAG,
    });
  }

  // ---------- RAG retrieval ----------
  let store: RagStore;
  try {
    store = await loadRagStore(request.url);
  } catch (e: any) {
    return jsonResponse(request, 500, {
      error: "rag_load_failed",
      details: String(e?.message || e),
      build: BUILD_TAG,
    });
  }

  let qVec: number[];
  try {
    qVec = await embedQuery(question, env);
  } catch (e: any) {
    return jsonResponse(request, 502, {
      error: "embedding_failed",
      details: String(e?.message || e),
      build: BUILD_TAG,
    });
  }

  const picks = topKCosine(qVec, store, RAG_TOP_K);
  const bestScore = picks[0]?.score ?? 0;

  const { context, sources } = buildContextAndSources(store, picks);

  // Si no hay evidencia suficiente, no llamamos al LLM (ahorras € y evitas alucinación)
  if (bestScore < RAG_MIN_SCORE) {
    return jsonResponse(request, 200, {
      answer:
        "No tengo información documentada suficiente en mis documentos públicos para responder con confianza a esa pregunta.",
      sources,
      build: BUILD_TAG,
      retrieval: { top_k: RAG_TOP_K, best_score: Number(bestScore.toFixed(4)) },
    });
  }

  // ---------- LLM answer with strict grounding ----------
  const model = env.OPENAI_MODEL || "gpt-4o-mini";

  const systemPrompt = `Eres un asistente profesional del portfolio.
Reglas obligatorias:
- Responde SOLO usando la información del CONTEXTO proporcionado.
- Si el contexto no contiene la respuesta, di exactamente: "No tengo información documentada sobre eso."
- No inventes datos, fechas ni detalles.
- Escribe en español, breve y claro.
- Incluye 1-3 citas en el texto usando el formato [source_path] exactamente como aparece en SOURCE: [..].`;

  const userPrompt = `PREGUNTA:
${question}

CONTEXTO:
${context}

Tarea: Responde a la pregunta.`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const errTxt = await resp.text();
    return jsonResponse(request, 502, { error: "openai_error", details: errTxt, build: BUILD_TAG });
  }

  const data = (await resp.json()) as any;
  const answer = data?.choices?.[0]?.message?.content ?? "";

  return jsonResponse(request, 200, {
    answer,
    sources,
    build: BUILD_TAG,
    retrieval: { top_k: RAG_TOP_K, best_score: Number(bestScore.toFixed(4)) },
  });
};