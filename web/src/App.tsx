import { useRef, useState } from "react";
import { TurnstileGate, TurnstileGateHandle } from "./TurnstileGate";
import "./App.css";

function App() {
  const gateRef = useRef<TurnstileGateHandle>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const q = question.trim();
    if (!q) return;

    if (!turnstileToken) {
      alert("Completa el Turnstile primero.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, turnstileToken }),
      });

      const text = await response.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          setAnswer(
            JSON.stringify(
              {
                error: "rate_limited",
                retry_after: retryAfter ? Number(retryAfter) : null,
                details: payload,
              },
              null,
              2
            )
          );
          return;
        }

        if (response.status === 403) {
          setAnswer(
            JSON.stringify({ error: "forbidden", details: payload }, null, 2)
          );
          return;
        }

        setAnswer(
          JSON.stringify(
            { error: "request_failed", status: response.status, details: payload },
            null,
            2
          )
        );
        return;
      }

      setAnswer(JSON.stringify(payload, null, 2));
    } catch {
      setAnswer("Error llamando a la API.");
    } finally {
      setLoading(false);

      // Fuerza token nuevo para la siguiente petición + resetea el widget
      setTurnstileToken("");
      gateRef.current?.reset();
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", textAlign: "center" }}>
      <h1>RAG Portfolio</h1>

      <textarea
        placeholder="Hazme una pregunta..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        style={{ width: "100%", height: 80 }}
      />

      <div style={{ margin: "20px 0" }}>
        <TurnstileGate
          ref={gateRef}
          onVerify={(token) => setTurnstileToken(token)}
        />
      </div>

      <button onClick={handleSend} disabled={loading}>
        {loading ? "Pensando..." : "Enviar"}
      </button>

      {answer && (
        <pre style={{ marginTop: 20, textAlign: "left", whiteSpace: "pre-wrap" }}>
          {answer}
        </pre>
      )}
    </div>
  );
}

export default App;