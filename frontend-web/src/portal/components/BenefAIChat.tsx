import { useEffect, useId, useRef, useState, type RefObject } from 'react';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api, ApiError } from '../../lib/api.ts';
import type { BenefAIChatTurn } from '../../lib/types.ts';
import { PortalIcon } from './PortalUI';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_CHARS = 12000;

type ChatMessage = BenefAIChatTurn & {
  id: string;
  tools?: string[];
};

const SUGGESTIONS = [
  '¿Cuántas visitas válidas tuvimos en los últimos 7 días?',
  '¿Cuántos clientes únicos registramos este mes?',
  '¿Cómo va el uso de mi plan?',
  '¿Qué recompensas tengo activas?',
] as const;

const TOOL_LABELS: Record<string, string> = {
  metricas: 'métricas',
  visitas: 'visitas',
  canjes: 'canjes',
  cupones: 'cupones',
  programas: 'programas',
  recompensas: 'recompensas',
  plan: 'plan',
  negocio: 'negocio',
  equipo: 'equipo',
  clientes: 'clientes',
  sucursales: 'sucursales',
  invitaciones: 'invitaciones',
  alianzas: 'alianzas',
};

let sequence = 0;
function nextId() {
  sequence += 1;
  return `benef-ai-${sequence}`;
}

function buildHistory(messages: ChatMessage[]): BenefAIChatTurn[] {
  const turns = messages.slice(-MAX_HISTORY_TURNS).map(({ role, content }) => ({
    role,
    content,
  }));
  let total = turns.reduce((sum, turn) => sum + turn.content.length, 0);
  while (turns.length && total > MAX_HISTORY_CHARS) {
    total -= turns[0].content.length;
    turns.shift();
  }
  return turns;
}

function mensajeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return 'Has alcanzado el límite de consultas a Benef AI. Intenta más tarde.';
    }
    if (error.status === 403) {
      return 'No tienes acceso a la información de este negocio.';
    }
    if (error.status === 504) {
      return 'Benef AI tardó demasiado en responder. Intenta de nuevo.';
    }
    if (error.status === 503) {
      return 'Benef AI no está disponible en este momento. Intenta más tarde.';
    }
    return error.message;
  }
  return 'No se pudo contactar a Benef AI. Revisa tu conexión e intenta de nuevo.';
}

export default function BenefAIChat({
  open,
  businessId,
  businessName,
  onClose,
  triggerRef,
}: {
  open: boolean;
  businessId: number;
  businessName: string;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement>;
}) {
  const { session, signOut } = useAuth();
  const inputId = useId();
  const helpId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lastAttempt, setLastAttempt] = useState('');
  const panel = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const sendingRef = useRef(false);

  useEffect(() => {
    requestSequence.current += 1;
    controller.current?.abort();
    controller.current = null;
    sendingRef.current = false;
    setMessages([]);
    setDraft('');
    setSending(false);
    setError('');
    setLastAttempt('');
  }, [businessId, session?.user.id]);

  useEffect(() => {
    if (!open) {
      requestSequence.current += 1;
      controller.current?.abort();
      controller.current = null;
      sendingRef.current = false;
      setSending(false);
      return;
    }
    const timer = window.setTimeout(() => input.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (panel.current) {
      (panel.current as HTMLElement & { inert: boolean }).inert = !open;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, onClose, triggerRef]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, sending, error]);

  function cerrar() {
    onClose();
    triggerRef.current?.focus();
  }

  function reiniciar() {
    requestSequence.current += 1;
    controller.current?.abort();
    controller.current = null;
    sendingRef.current = false;
    setSending(false);
    setMessages([]);
    setDraft('');
    setError('');
    setLastAttempt('');
    input.current?.focus();
  }

  async function enviar(texto = draft) {
    const content = texto.trim();
    if (!content || sendingRef.current) return;
    if (!session?.user.id) {
      setError('Tu sesión terminó. Inicia sesión nuevamente.');
      return;
    }

    const history = buildHistory(messages);
    const userMessage: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: content.slice(0, MAX_MESSAGE_LENGTH),
    };
    setMessages((actual) => [...actual, userMessage]);
    setDraft('');
    setError('');
    setLastAttempt(content.slice(0, MAX_MESSAGE_LENGTH));
    sendingRef.current = true;
    setSending(true);
    const requestId = ++requestSequence.current;
    controller.current?.abort();
    const currentController = new AbortController();
    controller.current = currentController;

    try {
      const result = await api.askBenefAI(
        businessId,
        content.slice(0, MAX_MESSAGE_LENGTH),
        history,
        currentController.signal,
      );
      if (currentController.signal.aborted || requestId !== requestSequence.current) return;
      setMessages((actual) => [...actual, {
        id: nextId(),
        role: 'assistant',
        content: result.answer,
        tools: result.tools_used,
      }]);
    } catch (err) {
      if (currentController.signal.aborted || requestId !== requestSequence.current) return;
      if (err instanceof ApiError && err.status === 401) {
        try {
          await signOut();
        } catch {
          setError('Tu sesión terminó. Inicia sesión nuevamente.');
        }
        return;
      }
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(mensajeError(err));
    } finally {
      if (requestId === requestSequence.current) {
        sendingRef.current = false;
        setSending(false);
        controller.current = null;
      }
    }
  }

  function tecla(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter'
      && !event.shiftKey
      && !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void enviar();
    }
  }

  return (
    <>
      {open ? (
        <div className="portal-ai-backdrop" onClick={cerrar} aria-hidden="true" />
      ) : null}
      <aside
        ref={panel}
        id="benef-ai-panel"
        className={`portal-ai-panel${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="benef-ai-title"
        aria-describedby={helpId}
        aria-hidden={!open}
      >
      <header className="portal-ai-head">
        <span className="portal-ai-mark" aria-hidden="true">
          <PortalIcon name="ia" />
        </span>
        <div className="portal-ai-heading">
          <h2 id="benef-ai-title">Benef AI</h2>
          <p>{businessName}</p>
        </div>
        <button
          type="button"
          className="portal-ai-icon-button"
          onClick={reiniciar}
          disabled={messages.length === 0 && !error && !sending}
          aria-label="Reiniciar conversación"
          title="Reiniciar conversación"
        >
          <span aria-hidden="true">↺</span>
        </button>
        <button
          type="button"
          className="portal-ai-icon-button"
          onClick={cerrar}
          aria-label="Cerrar Benef AI"
          title="Cerrar Benef AI"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div
        ref={log}
        className="portal-ai-log"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={sending}
      >
        {messages.length === 0 && !sending ? (
          <div className="portal-ai-empty">
            <span className="portal-ai-empty-icon" aria-hidden="true">
              <PortalIcon name="ia" />
            </span>
            <h3>Pregunta por tu negocio</h3>
            <p>
              Puedo consultar visitas, clientes, canjes, cupones, recompensas,
              plan, equipo y alianzas de <strong>{businessName}</strong>.
            </p>
            <div className="portal-ai-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void enviar(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <article
            key={message.id}
            className={`portal-ai-message is-${message.role}`}
            aria-label={message.role === 'user' ? 'Tu mensaje' : 'Respuesta de Benef AI'}
          >
            {message.role === 'assistant' ? (
              <span className="portal-ai-avatar" aria-hidden="true">AI</span>
            ) : null}
            <div className="portal-ai-bubble">
              <p>{message.content}</p>
              {message.tools && message.tools.length > 0 ? (
                <p className="portal-ai-tools">
                  Consultó: {message.tools.map((tool) => TOOL_LABELS[tool] ?? tool).join(', ')}.
                </p>
              ) : null}
            </div>
          </article>
        ))}

        {sending ? (
          <div className="portal-ai-message is-assistant" role="status">
            <span className="portal-ai-avatar" aria-hidden="true">AI</span>
            <div className="portal-ai-bubble portal-ai-typing">
              <span className="portal-sr-only">Benef AI está pensando…</span>
              <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="portal-ai-error" role="alert">
            <strong>No se pudo completar la consulta</strong>
            <p>{error}</p>
            {lastAttempt ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(lastAttempt);
                  input.current?.focus();
                }}
              >
                Editar y reintentar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <form
        className="portal-ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void enviar();
        }}
      >
        <label className="portal-sr-only" htmlFor={inputId}>Mensaje para Benef AI</label>
        <textarea
          ref={input}
          id={inputId}
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={2}
          placeholder="Ej. ¿Cuántas visitas tuvimos esta semana?"
          aria-describedby={helpId}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={tecla}
        />
        <div className="portal-ai-composer-foot">
          <span>{draft.length}/{MAX_MESSAGE_LENGTH}</span>
          <button
            type="submit"
            className="portal-ai-send"
            disabled={sending || !draft.trim()}
          >
            {sending ? 'Consultando…' : 'Enviar'}
          </button>
        </div>
        <p id={helpId} className="portal-ai-help">
          Enter para enviar. Shift + Enter para una nueva línea. Solo consulta
          información autorizada; no modifica puntos, visitas ni cupones.
        </p>
      </form>
      </aside>
    </>
  );
}
