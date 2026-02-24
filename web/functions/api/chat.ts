type ChatRequest = {
  question?: string;
};

export const onRequestPost = async ({ request }: { request: Request }) => {
  let body: ChatRequest = {};
  try {
    body = await request.json();
  } catch {}

  const question = (body.question ?? "").toString().trim();

  return new Response(
    JSON.stringify({
      answer: question
        ? `✅ API OK. Me preguntaste: "${question}"`
        : "✅ API OK. Pero no me enviaste 'question'.",
      sources: [],
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};