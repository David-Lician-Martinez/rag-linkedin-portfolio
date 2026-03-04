import { useEffect, useMemo, useRef, useState } from "react";
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

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: SourceItem[];
  ts: number;
};

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

/**
 * Construye el historial que mandamos al backend:
 * - Tomamos los últimos N mensajes
 * - Recortamos tamaño total para controlar tokens
 */
function buildHistoryForBackend(messages: ChatMsg[], maxMessages: number, maxCharsTotal: number) {
  const last = messages.slice(-maxMessages);

  // Recorte por caracteres total (desde el final hacia atrás)
  let total = 0;
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (let i = last.length - 1; i >= 0; i--) {
    const m = last[i];
    const content = (m.text || "").trim();
    if (!content) continue;

    const add = content.length;
    if (total + add > maxCharsTotal) {
      // Si no cabe, metemos un recorte de este mensaje (al principio) y paramos
      const remaining = Math.max(0, maxCharsTotal - total);
      if (remaining > 200) {
        out.unshift({ role: m.role, content: content.slice(-remaining) });
      }
      break;
    }

    out.unshift({ role: m.role, content });
    total += add;
  }

  return out;
}

export default function App() {
  const gateRef = useRef<TurnstileGateHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Memoria (ajustable)
  const [memoryTurns, setMemoryTurns] = useState<number>(4); // 1..8 turnos
  const maxMessagesForBackend = useMemo(() => Math.max(2, memoryTurns * 2), [memoryTurns]);

  // Control de coste: ~6.000 chars de historial máximo (≈ 1k–1.5k tokens aprox, depende idioma)
  const MAX_HISTORY_CHARS = 6000;

  const [question, setQuestion] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    // opcional: persistencia en localStorage
    try {
      const raw = localStorage.getItem("rag_chat_messages");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const isLanding = messages.length === 0;

  // Persistencia local
  useEffect(() => {
    try {
      localStorage.setItem("rag_chat_messages", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Auto-scroll al final cuando llegan mensajes (solo en modo chat)
  useEffect(() => {
    if (isLanding) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, isLanding]);

  const handleSend = async () => {
    const q = question.trim();
    if (!q) return;

    if (!turnstileToken) {
      alert("Completa el Turnstile primero.");
      return;
    }

    const userMsg: ChatMsg = {
      id: uid(),
      role: "user",
      text: q,
      ts: Date.now(),
    };

    // Añadimos mensaje de usuario instantáneo
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
      // Historial para backend (incluye el userMsg recién añadido)
      const history = buildHistoryForBackend(
        [...messages, userMsg],
        maxMessagesForBackend,
        MAX_HISTORY_CHARS
      );

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          turnstileToken,
          history, // 👈 memoria
        }),
      });

      const text = await response.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }

      if (!response.ok) {
        const errText =
          response.status === 429
            ? `Demasiadas peticiones. Prueba de nuevo en ${
                response.headers.get("Retry-After") || "unos segundos"
              }s.`
            : response.status === 403
            ? "Validación fallida. Completa el Turnstile e inténtalo de nuevo."
            : "Ha ocurrido un error al procesar tu petición.";

        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            text: errText,
            ts: Date.now(),
          },
        ]);
        return;
      }

      const assistantMsg: ChatMsg = {
        id: uid(),
        role: "assistant",
        text: typeof payload?.answer === "string" ? payload.answer : "",
        sources: Array.isArray(payload?.sources) ? payload.sources : [],
        ts: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          text: "Error llamando a la API.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      setTurnstileToken("");
      gateRef.current?.reset();
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    try {
      localStorage.removeItem("rag_chat_messages");
    } catch {}
  };

  return (
    <div className={`page ${isLanding ? "pageLanding" : "pageChat"}`}>
      <div className={`shell ${isLanding ? "shellLanding" : "shellChat"}`}>
        <header className="header">
          <h1 className="title">Ask my profile</h1>
          <div className="nameTag">David Licián Martínez</div>
          <p className="subtitle">Respondo únicamente usando documentos públicos y cito fuentes.</p>
        </header>

        <main className={`chat ${isLanding ? "chatLanding" : "chatChat"}`}>
          <div className="messages" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="emptyState">
                <div className="emptyBadge">RAG</div>
                <div className="emptyTitle">Haz una pregunta sobre mi perfil</div>
                <div className="emptyHint">
                  Ejemplos: “¿En qué proyectos he trabajado?” · “¿Qué stack uso?” · “¿Qué busco ahora?”
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`msgRow ${m.role === "user" ? "msgUser" : "msgAssistant"}`}
                  >
                    <div className={`msgBubble ${m.role}`}>
                      <div className="msgText">{m.text}</div>

                      {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                        <details className="msgSources">
                          <summary className="msgSourcesSummary">
                            Fuentes <span className="sourcesCount">{m.sources.length}</span>
                          </summary>
                          <div className="sourcesGrid">
                            {m.sources.map((s, i) => {
                              const label = s.sid ? `[${s.sid}]` : `[${i + 1}]`;
                              const title = s.doc_title || "Documento";
                              const path = s.source_path || "";
                              const score = typeof s.score === "number" ? s.score.toFixed(3) : null;

                              return (
                                <div key={(s.id || "") + i} className="sourceCard">
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
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="msgRow msgAssistant">
                    <div className="msgBubble assistant typing">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="composer">
            <div className="composerTopRow">
              <div className="memoryCtl">
                <div className="memoryLabel">
                  Memoria: <strong>{memoryTurns}</strong> turnos
                </div>
                <input
                  className="memorySlider"
                  type="range"
                  min={1}
                  max={8}
                  value={memoryTurns}
                  onChange={(e) => setMemoryTurns(Number(e.target.value))}
                />
              </div>

              <button className="ghostBtn" onClick={clearChat} disabled={loading}>
                Limpiar chat
              </button>
            </div>

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
              Historial local · Contexto limitado · Respuestas con fuentes
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