const BUILD_TAG = "OPENAI_V1_2026-02-25";

type ChatRequest = { question?: string };

type Env = {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
};

export const onRequestPost = async (
  { request, env }: { request: Request; env: Env }
) => {
  const body: ChatRequest = await request.json().catch(() => ({}));
  const question = (body.question ?? "").toString().trim();

  if (!question) {
    return new Response(JSON.stringify({ error: "Missing 'question'." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Missing OPENAI_API_KEY in Cloudflare environment variables.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
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
          content:
            "Eres un asistente profesional. Responde en español, breve y claro.",
        },
        { role: "user", content: question },
      ],
    }),
  });

  if (!resp.ok) {
    const errTxt = await resp.text();
    return new Response(
      JSON.stringify({ error: "OpenAI error", details: errTxt }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = (await resp.json()) as any;
  const answer = data?.choices?.[0]?.message?.content ?? "";

  return new Response(JSON.stringify({ answer, sources: [], build: BUILD_TAG }), {
    headers: { "Content-Type": "application/json" },
  });
};