import { useState } from "react";
import { TurnstileGate } from "./TurnstileGate";
import "./App.css";

function App() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!question) return;
    if (!turnstileToken) {
      alert("Completa el Turnstile primero.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, turnstileToken }),
      });

      const data = await response.json();
      setAnswer(JSON.stringify(data, null, 2));
    } catch (err) {
      setAnswer("Error llamando a la API.");
    }

    setLoading(false);
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
        <TurnstileGate onVerify={(token) => setTurnstileToken(token)} />
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