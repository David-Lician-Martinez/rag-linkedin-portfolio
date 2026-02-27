// web/functions/api/chat.ts
const BUILD_TAG = "OPENAI_V1_2026-02-25";

// Ajusta estos límites a tu gusto (recomendación MVP)
const PER_MINUTE_LIMIT = 8; // req/min por IP
const PER_DAY_LIMIT = 80; // req/día por IP (evita goteo infinito)
const MAX_BODY_BYTES = 10_000; // 10KB
const MAX_QUESTION_CHARS = 800;

type ChatRequest = {
  question?: string;
  turnstileToken?: string;
};

type Env = {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  TURNSTILE_SECRET_KEY: string; // <-- asegúrate de tenerlo en Cloudflare Pages (Secret)
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
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
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

async function enforceRateLimit(request: Request): Promise<{ ok: true } | { ok: false; res: Response }> {
  const cache = caches.default;
  const ip = getClientIP(request);

  const minKey = `ip:${ip}:min:${epochMinute()}`;
  const minCount = await bumpCounter(cache, minKey, 60);
  if (minCount > PER_MINUTE_LIMIT) {
    return {
      ok: false,
      res: jsonResponse(request, 429, {
        error: "rate_limited",
        scope: "minute",
        retry_after: 60,
        build: BUILD_TAG,
      }, { "Retry-After": "60" }),
    };
  }

  const dayKey = `ip:${ip}:day:${epochDayUTC()}`;
  const dayCount = await bumpCounter(cache, dayKey, 86400);
  if (dayCount > PER_DAY_LIMIT) {
    return {
      ok: false,
      res: jsonResponse(request, 429, {
        error: "rate_limited",
        scope: "day",
        retry_after: 86400,
        build: BUILD_TAG,
      }, { "Retry-After": "86400" }),
    };
  }

  return { ok: true };
}

async function verifyTurnstile(secret: string, token: string, request: Request): Promise<boolean> {
  // Opcional: pasar IP del usuario al verify (Cloudflare lo soporta)
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

export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  // Preflight CORS
  if (request.method === "OPTIONS") return corsPreflight(request);

  // Solo POST
  if (request.method !== "POST") {
    return jsonResponse(request, 405, { error: "method_not_allowed", build: BUILD_TAG });
  }

  // Content-Type JSON
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return jsonResponse(request, 415, { error: "invalid_content_type", build: BUILD_TAG });
  }

  // Body size guard (si Content-Length viene)
  const len = Number(request.headers.get("Content-Length") || "0");
  if (len && len > MAX_BODY_BYTES) {
    return jsonResponse(request, 413, { error: "payload_too_large", build: BUILD_TAG });
  }

  // Rate limit (barato) ANTES de cualquier cosa cara
  const rl = await enforceRateLimit(request);
  if (!rl.ok) return rl.res;

  // Parse body
  const body: ChatRequest = await request.json().catch(() => ({}));
  const question = (body.question ?? "").toString().trim();
  const turnstileToken = (body.turnstileToken ?? "").toString().trim();

  if (!question) {
    return jsonResponse(request, 400, { error: "missing_question", build: BUILD_TAG });
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return jsonResponse(request, 400, { error: "question_too_long", max: MAX_QUESTION_CHARS, build: BUILD_TAG });
  }

  // Turnstile token obligatorio
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

  // OpenAI env
  if (!env.OPENAI_API_KEY) {
    return jsonResponse(request, 500, {
      error: "missing_openai_api_key",
      details: "Missing OPENAI_API_KEY in Cloudflare environment variables.",
      build: BUILD_TAG,
    });
  }

  const model = env.OPENAI_MODEL || "gpt-4o-mini";

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
        {
          role: "system",
          content: "Eres un asistente profesional. Responde en español, breve y claro.",
        },
        { role: "user", content: question },
      ],
    }),
  });

  if (!resp.ok) {
    const errTxt = await resp.text();
    return jsonResponse(request, 502, { error: "openai_error", details: errTxt, build: BUILD_TAG });
  }

  const data = (await resp.json()) as any;
  const answer = data?.choices?.[0]?.message?.content ?? "";

  return jsonResponse(request, 200, { answer, sources: [], build: BUILD_TAG });
};