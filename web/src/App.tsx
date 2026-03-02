import { useRef, useState } from "react";
import { TurnstileGate } from "./TurnstileGate";
import type { TurnstileGateHandle } from "./TurnstileGate";
import "./App.css";

type SourceItem = {
  sid?: string;          // si usas el sistema S1/S2...
  id?: string;
  doc_title?: string;
  source_path?: string;
  score?: number;
  excerpt?: string;
};

function App() {
  const gateRef = useRef<TurnstileGateHandle>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([]);
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
        // UX: mostramos error “humano” + guardamos detalles mínimos
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          setAnswer(
            `Demasiadas peticiones. Prueba de nuevo en ${retryAfter ? retryAfter : "unos segundos"}s.`
          );
          setSources([]);
          return;
        }

        if (response.status === 403) {
          setAnswer("Validación fallida. Completa el Turnstile e inténtalo de nuevo.");
          setSources([]);
          return;
        }

        setAnswer("Ha ocurrido un error al procesar tu petición.");
        setSources([]);
        return;
      }

      // OK
      setAnswer(typeof payload?.answer === "string" ? payload.answer : "");
      setSources(Array.isArray(payload?.sources) ? payload.sources : []);
    } catch {
      setAnswer("Error llamando a la API.");
      setSources([]);
    } finally {
      setLoading(false);

      // reseteo: limpia token y fuerza re-mount del widget
      setTurnstileToken("");
      gateRef.current?.reset();
    }
  };

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "60px auto",
        padding: "0 16px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.5 }}>Ask my profile</h1>
        <p style={{ margin: "10px 0 0", color: "#666", lineHeight: 1.4 }}>
          Respondo únicamente usando documentos públicos y cito fuentes.
        </p>
      </header>

      <div
        style={{
          border: "1px solid #e6e6e6",
          borderRadius: 12,
          padding: 14,
          background: "#fff",
        }}
      >
        <textarea
          placeholder="Hazme una pregunta sobre mi perfil profesional…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{
            width: "100%",
            height: 96,
            padding: 12,
            fontSize: 14,
            borderRadius: 10,
            border: "1px solid #e6e6e6",
            outline: "none",
            resize: "none",
          }}
        />

        <div style={{ margin: "14px 0" }}>
          <TurnstileGate ref={gateRef} onVerify={(token) => setTurnstileToken(token)} />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={handleSend}
            disabled={loading}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid #111",
              background: loading ? "#444" : "#111",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 14,
            }}
          >
            {loading ? "Pensando…" : "Enviar"}
          </button>
        </div>
      </div>

      {(answer || sources.length > 0) && (
        <section style={{ marginTop: 26 }}>
          {/* Respuesta */}
          {answer && (
            <div
              style={{
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                padding: 16,
                background: "#fff",
              }}
            >
              <div style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>Respuesta</div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 15 }}>
                {answer}
              </div>
            </div>
          )}

          {/* Fuentes */}
          {sources.length > 0 && (
            <div
              style={{
                marginTop: 14,
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                padding: 16,
                background: "#fff",
              }}
            >
              <div style={{ color: "#666", fontSize: 12, marginBottom: 10 }}>Fuentes</div>

              <div style={{ display: "grid", gap: 10 }}>
                {sources.map((s, i) => {
                  const label = s.sid ? `[${s.sid}]` : `[${i + 1}]`;
                  const title = s.doc_title || "Documento";
                  const path = s.source_path || "";
                  const score = typeof s.score === "number" ? s.score.toFixed(3) : null;

                  return (
                    <div
                      key={s.id || i}
                      style={{
                        border: "1px solid #f0f0f0",
                        borderRadius: 10,
                        padding: 12,
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                        <span style={{ fontWeight: 700 }}>{label}</span>
                        <span style={{ fontWeight: 600 }}>{title}</span>
                        {score && (
                          <span style={{ marginLeft: "auto", color: "#888", fontSize: 12 }}>
                            score {score}
                          </span>
                        )}
                      </div>

                      {path && (
                        <div style={{ color: "#777", fontSize: 12, marginTop: 4 }}>
                          {path}
                        </div>
                      )}

                      {s.excerpt && (
                        <div style={{ color: "#333", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                          {s.excerpt}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;