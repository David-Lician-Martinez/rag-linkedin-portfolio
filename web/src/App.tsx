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

type Lang = "es" | "en";
type RatingValue = 1 | 2 | 3 | 4 | 5;

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function buildHistoryForBackend(messages: ChatMsg[], maxMessages: number, maxCharsTotal: number) {
  const last = messages.slice(-maxMessages);

  let total = 0;
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (let i = last.length - 1; i >= 0; i--) {
    const m = last[i];
    const content = (m.text || "").trim();
    if (!content) continue;

    const add = content.length;
    if (total + add > maxCharsTotal) {
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

const COPY = {
  es: {
    title: "Pregunta a mi perfil (Beta)",
    subtitle: "Respondo únicamente usando documentos públicos y cito fuentes.",
    emptyBadge: "RAG",
    emptyTitle: "Haz una pregunta sobre mi perfil",
    emptyHint:
      "Ejemplos: “¿En qué proyectos he trabajado?” · “¿Qué stack uso?” · “¿Qué busco ahora?”",
    sources: "Fuentes",
    document: "Documento",
    clearChat: "Limpiar chat",
    send: "Enviar",
    thinking: "Pensando…",
    placeholder: "Escribe tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)",
    composerHint: "Historial local · Últimos 8 turnos · Respuestas con fuentes",
    completeTurnstile: "Completa el Turnstile primero.",
    tooManyRequests: (retryAfter: string) =>
      `Demasiadas peticiones. Prueba de nuevo en ${retryAfter}s.`,
    validationFailed: "Validación fallida. Completa el Turnstile e inténtalo de nuevo.",
    genericError: "Ha ocurrido un error al procesar tu petición.",
    apiError: "Error llamando a la API.",
    score: "score",
    modalTitle: "Bienvenido",
    modalLangLabel: "Idioma del chat",
    modalEsBtn: "Español",
    modalEnBtn: "English",
    introEs:
      'Hola. Soy David Licián Martínez y he creado este RAG documentado y actualizado a mi CV. Puedes utilizarlo para realizarle preguntas sobre mi formación profesional y mis intereses laborales. Si desconoce la respuesta a una pregunta, responde: "No tengo información documentada sobre eso".',
    introEn:
      'Hello. I am David Licián Martínez and I created this documented RAG, updated to match my CV. You can use it to ask questions about my professional background and my career interests. If it does not know the answer to a question, it should respond: "I do not have documented information about that".',
  },
  en: {
    title: "Ask my profile (Beta)",
    subtitle: "I answer only using public documents and I cite sources.",
    emptyBadge: "RAG",
    emptyTitle: "Ask a question about my profile",
    emptyHint:
      'Examples: "What projects have I worked on?" · "What stack do I use?" · "What am I looking for now?"',
    sources: "Sources",
    document: "Document",
    clearChat: "Clear chat",
    send: "Send",
    thinking: "Thinking…",
    placeholder: "Type your question… (Enter to send, Shift+Enter for a new line)",
    composerHint: "Local history · Last 8 turns · Answers with sources",
    completeTurnstile: "Complete the Turnstile first.",
    tooManyRequests: (retryAfter: string) =>
      `Too many requests. Try again in ${retryAfter}s.`,
    validationFailed: "Validation failed. Complete the Turnstile and try again.",
    genericError: "An error occurred while processing your request.",
    apiError: "Error calling the API.",
    score: "score",
    modalTitle: "Welcome",
    modalLangLabel: "Chat language",
    modalEsBtn: "Español",
    modalEnBtn: "English",
    introEs:
      'Hola. Soy David Licián Martínez y he creado este RAG documentado y actualizado a mi CV. Puedes utilizarlo para realizarle preguntas sobre mi formación profesional y mis intereses laborales. Si desconoce la respuesta a una pregunta, responde: "No tengo información documentada sobre eso".',
    introEn:
      'Hello. I am David Licián Martínez and I created this documented RAG, updated to match my CV. You can use it to ask questions about my professional background and my career interests. If it does not know the answer to a question, it should respond: "I do not have documented information about that".',
  },
} as const;

export default function App() {
  const gateRef = useRef<TurnstileGateHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const memoryTurns = 8;
  const maxMessagesForBackend = useMemo(() => memoryTurns * 2, []);
  const MAX_HISTORY_CHARS = 6000;

  const [question, setQuestion] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<RatingValue>(5);

  const [lang, setLang] = useState<Lang | null>(() => {
    try {
      const saved = sessionStorage.getItem("rag_ui_lang");
      return saved === "es" || saved === "en" ? saved : null;
    } catch {
      return null;
    }
  });

  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const raw = localStorage.getItem("rag_chat_messages");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const t = COPY[lang ?? "es"];
  const isLanding = messages.length === 0;
  const showLanguageModal = lang === null;

  useEffect(() => {
    try {
      localStorage.setItem("rag_chat_messages", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (!lang) return;
    try {
      sessionStorage.setItem("rag_ui_lang", lang);
    } catch {}
  }, [lang]);

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
      alert(t.completeTurnstile);
      return;
    }

    const userMsg: ChatMsg = {
      id: uid(),
      role: "user",
      text: q,
      ts: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
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
          history,
          uiLanguage: lang ?? "es",
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
            ? t.tooManyRequests(response.headers.get("Retry-After") || "a few seconds")
            : response.status === 403
            ? t.validationFailed
            : t.genericError;

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
          text: t.apiError,
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

  const chooseLanguage = (nextLang: Lang) => {
    setLang(nextLang);
  };

  const feedbackLabel = lang === "en" ? "Give me feedback" : "Dame feedback";
  const feedbackTitle = lang === "en" ? "Send feedback" : "Enviar feedback";
  const feedbackSubtitle =
    lang === "en"
      ? "Rate the experience and send me your comments by email."
      : "Valora la experiencia y envíame tus comentarios por correo.";
  const feedbackRatingLabel = lang === "en" ? "Rating" : "Calificación";
  const feedbackEmailBtn = lang === "en" ? "Send by email" : "Enviar por email";
  const feedbackCloseBtn = lang === "en" ? "Close" : "Cerrar";

  const feedbackMailHref =
    lang === "en"
      ? `mailto:davidlicianmartinez@hotmail.com?subject=${encodeURIComponent(
          "Feedback about your RAG portfolio"
        )}&body=${encodeURIComponent(
          `Hi David,\n\nI would like to share some feedback about your RAG portfolio.\n\nRating: ${feedbackRating}/5\n\nComments:\n`
        )}`
      : `mailto:davidlicianmartinez@hotmail.com?subject=${encodeURIComponent(
          "Feedback sobre tu portfolio RAG"
        )}&body=${encodeURIComponent(
          `Hola David,\n\nQuería darte el siguiente feedback sobre tu portfolio RAG.\n\nCalificación: ${feedbackRating}/5\n\nComentarios:\n`
        )}`;

  return (
    <>
      {showLanguageModal && (
        <div className="modalOverlay">
          <div className="welcomeModal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <div className="welcomeGlow" />
            <h2 id="welcome-title" className="welcomeTitle">
              {COPY.es.modalTitle} · {COPY.en.modalTitle}
            </h2>

            <div className="welcomeText">
              <p>{COPY.es.introEs}</p>
              <p className="welcomeDividerText">{COPY.en.introEn}</p>
            </div>

            <div className="welcomeLangLabel">
              {COPY.es.modalLangLabel} · {COPY.en.modalLangLabel}
            </div>

            <div className="welcomeActions">
              <button className="langBtn langBtnPrimary" onClick={() => chooseLanguage("es")}>
                {COPY.es.modalEsBtn}
              </button>
              <button className="langBtn" onClick={() => chooseLanguage("en")}>
                {COPY.en.modalEnBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <div className="modalOverlay" onClick={() => setShowFeedbackModal(false)}>
          <div
            className="feedbackModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="feedbackModalGlow" />

            <h2 id="feedback-modal-title" className="feedbackModalTitle">
              {feedbackTitle}
            </h2>

            <p className="feedbackModalSubtitle">{feedbackSubtitle}</p>

            <div className="feedbackRatingBlock">
              <div className="feedbackRatingLabel">{feedbackRatingLabel}</div>

              <div className="feedbackStars" aria-label={feedbackRatingLabel}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`feedbackStar ${star <= feedbackRating ? "active" : ""}`}
                    onClick={() => setFeedbackRating(star as RatingValue)}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                ))}
              </div>

              <div className="feedbackRatingValue">{feedbackRating}/5</div>
            </div>

            <div className="feedbackModalActions">
              <button
                type="button"
                className="ghostBtn"
                onClick={() => setShowFeedbackModal(false)}
              >
                {feedbackCloseBtn}
              </button>

              <a
                className="sendBtn feedbackEmailLink"
                href={feedbackMailHref}
                onClick={() => setShowFeedbackModal(false)}
              >
                {feedbackEmailBtn}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className={`page ${isLanding ? "pageLanding" : "pageChat"}`}>
        <div className={`shell ${isLanding ? "shellLanding" : "shellChat"}`}>
          <header className="header">
            <h1 className="title">{t.title}</h1>
            <div className="nameTag">David Licián Martínez</div>
            <p className="subtitle">{t.subtitle}</p>
          </header>

          <main className={`chat ${isLanding ? "chatLanding" : "chatChat"}`}>
            <div className="messages" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyBadge">{t.emptyBadge}</div>
                  <div className="emptyTitle">{t.emptyTitle}</div>
                  <div className="emptyHint">{t.emptyHint}</div>
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
                              {t.sources} <span className="sourcesCount">{m.sources.length}</span>
                            </summary>
                            <div className="sourcesGrid">
                              {m.sources.map((s, i) => {
                                const label = s.sid ? `[${s.sid}]` : `[${i + 1}]`;
                                const title = s.doc_title || t.document;
                                const path = s.source_path || "";
                                const score = typeof s.score === "number" ? s.score.toFixed(3) : null;

                                return (
                                  <div key={(s.id || "") + i} className="sourceCard">
                                    <div className="sourceTop">
                                      <span className="sourceTag">{label}</span>
                                      <span className="sourceTitle">{title}</span>
                                      {score && <span className="sourceScore">{t.score} {score}</span>}
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
              <div className="composerTopRow composerTopRowSingle">
                <button className="ghostBtn" onClick={clearChat} disabled={loading}>
                  {t.clearChat}
                </button>
              </div>

              <div className="turnstileWrap">
                <TurnstileGate ref={gateRef} onVerify={(token) => setTurnstileToken(token)} />
              </div>

              <div className="composerRow">
                <textarea
                  className="composerInput"
                  placeholder={t.placeholder}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={onKeyDown}
                />

                <button className="sendBtn" onClick={handleSend} disabled={loading}>
                  {loading ? t.thinking : t.send}
                </button>
              </div>

              <div className="composerHint">{t.composerHint}</div>
            </div>
          </main>

	  {/* Feedback dock */}
    	  <div className="feedbackDock">
            <button
              type="button"
              className="feedbackDockBtn"
              onClick={() => setShowFeedbackModal(true)}
            >
              {feedbackLabel}
            </button>
          </div>

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
    </>
  );
}