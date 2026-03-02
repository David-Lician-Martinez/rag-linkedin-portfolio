import { useRef, useState } from "react";
import { TurnstileGate } from "./TurnstileGate";
import type { TurnstileGateHandle } from "./TurnstileGate";
import "./App.css";

type SourceItem = {
  sid?: string;
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
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          setAnswer(
            `Demasiadas peticiones. Prueba de nuevo en ${
              retryAfter ? retryAfter : "unos segundos"
            }s.`
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

      setAnswer(typeof payload?.answer === "string" ? payload.answer : "");
      setSources(Array.isArray(payload?.sources) ? payload.sources : []);

      // Limpia input después de enviar (sensación chat)
      setQuestion("");
    } catch {
      setAnswer("Error llamando a la API.");
      setSources([]);
    } finally {
      setLoading(false);
      setTurnstileToken("");
      gateRef.current?.reset();
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    // Enter envía, Shift+Enter hace salto de línea
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) handleSend();
    }
  };

  return (
    <div className="page">
      <div className="shell">
        <header className="header">
          <h1 className="title">Ask my profile</h1>

	  <div className="nameTag">
	    David Licián Martínez
          </div>

          <p className="subtitle">
            Respondo únicamente usando documentos públicos y cito fuentes.
          </p>
        </header>

        <main className="chat">
          {/* Zona “mensajes” */}
          <div className="messages">
            {!answer ? (
              <div className="emptyState">
                <div className="emptyBadge">RAG</div>
                <div className="emptyTitle">Haz una pregunta sobre mi perfil</div>
                <div className="emptyHint">
                  Ejemplos: “¿En qué proyectos he trabajado?” · “¿Qué stack uso?” · “¿Qué busco ahora?”
                </div>
              </div>
            ) : (
              <>
                <div className="bubble assistant">
                  <div className="bubbleLabel">Respuesta</div>
                  <div className="bubbleText">{answer}</div>
                </div>

                {sources.length > 0 && (
                  <details className="sources">
                    <summary className="sourcesSummary">
                      Fuentes <span className="sourcesCount">{sources.length}</span>
                    </summary>

                    <div className="sourcesGrid">
                      {sources.map((s, i) => {
                        const label = s.sid ? `[${s.sid}]` : `[${i + 1}]`;
                        const title = s.doc_title || "Documento";
                        const path = s.source_path || "";
                        const score = typeof s.score === "number" ? s.score.toFixed(3) : null;

                        return (
                          <div key={s.id || i} className="sourceCard">
                            <div className="sourceTop">
                              <span className="sourceTag">{label}</span>
                              <span className="sourceTitle">{title}</span>
                              {score && <span className="sourceScore">score {score}</span>}
                            </div>
                            {path && <div className="sourcePath">{path}</div>}
                            {s.excerpt && <div className="sourceExcerpt">{s.excerpt}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>

          {/* Barra inferior */}
          <div className="composer">
            <div className="turnstileWrap">
              <TurnstileGate ref={gateRef} onVerify={(token) => setTurnstileToken(token)} />
            </div>

            <div className="composerRow">
              <textarea
                className="composerInput"
                placeholder="Escribe tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={onKeyDown}
              />

              <button className="sendBtn" onClick={handleSend} disabled={loading}>
                {loading ? "Pensando…" : "Enviar"}
              </button>
            </div>

            <div className="composerHint">
              Minimalista · Seguro (Turnstile + rate limit) · Respuestas con fuentes
            </div>
          </div>
        </main>
	<footer className="footer">
  	  <a 
    	    href="https://github.com/David-Lician-Martinez" 
    	    target="_blank" 
            rel="noopener noreferrer"
          >
            GitHub
          </a>

          <span className="footerDivider">·</span>

          <a 
            href="https://www.linkedin.com/in/david-lician/" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
        </footer>
      </div>
    </div>
  );
}

export default App;