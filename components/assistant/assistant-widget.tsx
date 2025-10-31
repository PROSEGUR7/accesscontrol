"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { MessageCircle, Send, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ChatRole = "user" | "assistant"

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
}

type AssistantWidgetProps = {
  userInitial?: string | null
}

const ASSISTANT_INITIAL = "S"

const BUSINESS_CONTEXT = `Eres SoftdatAI, el asistente virtual oficial del sistema de control de acceso RFID.
Tu función es apoyar únicamente en temas del negocio: estructura de datos de control de accesos, personas, llaves, puertas, ubicaciones, reportes, métricas, procesos de registro, asignaciones, lectores RFID y flujos de seguridad.
Utiliza cualquier contexto estructurado que recibas (tablas resumidas, conteos, listados) como fuente principal. Si la información exacta no aparece ahí, indica que no está disponible y sugiere consultar los módulos correspondientes.
Si te preguntan algo fuera de ese dominio (por ejemplo, programación general, definiciones ajenas, temas personales u otros negocios), responde con amabilidad que sólo puedes ayudar con información del sistema de control de acceso y ofrece sugerencias dentro del negocio.
No puedes ejecutar acciones sobre el sistema (no creas, editas ni eliminas registros, ni llamas APIs). Si el usuario solicita un cambio, dilo explícitamente, ofrécele los pasos manuales o la ruta en la plataforma y nunca confirmes como realizada una acción.
Si el usuario insiste en crear, registrar, actualizar o eliminar un dato, recuerda que solo puedes describir el proceso manual paso a paso y recomendar que lo haga alguien con acceso.
Cuando no tengas certeza o falte contexto, pide más detalles o indica claramente que no cuentas con ese dato.
Cuando enumeres elementos, preséntalos con listas numeradas o viñetas y separa las ideas en párrafos cortos.`

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hola, soy SoftdatAI. ¿En qué puedo ayudarte?",
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

export function AssistantWidget({ userInitial }: AssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typingMessage, setTypingMessage] = useState<ChatMessage | null>(null)
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false)

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)
  const typingTimerRef = useRef<number | null>(null)

  const animateAssistantResponse = useCallback(
    (content: string) => {
      return new Promise<void>((resolve) => {
        if (typingTimerRef.current !== null) {
          window.clearTimeout(typingTimerRef.current)
          typingTimerRef.current = null
        }

        const messageId = createId("assistant")
        setTypingMessage({ id: messageId, role: "assistant", content: "" })
        setIsAwaitingResponse(false)

        const segments = splitIntoSegments(content)
        if (segments.length === 0) {
          setMessages((prev) => [...prev, { id: messageId, role: "assistant", content }])
          setTypingMessage(null)
          resolve()
          return
        }

        let index = 0

        const pushSegment = () => {
          const segment = segments[index]
          setTypingMessage((previous) =>
            previous && previous.id === messageId
              ? { ...previous, content: previous.content + segment }
              : previous,
          )

          index += 1

          if (index >= segments.length) {
            setMessages((prev) => [...prev, { id: messageId, role: "assistant", content }])
            setTypingMessage(null)
            typingTimerRef.current = null
            resolve()
            return
          }

          typingTimerRef.current = window.setTimeout(pushSegment, getSegmentDelay(segment))
        }

        typingTimerRef.current = window.setTimeout(pushSegment, 40)
      })
    },
    [setIsAwaitingResponse],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typingMessage, isOpen])

  useEffect(() => {
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current)
        typingTimerRef.current = null
      }
    }
  }, [])

  const toggleWidget = useCallback(() => {
    setIsOpen((previous) => !previous)
    setError(null)
  }, [])

  const submitMessage = useCallback(async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || isLoading) {
      return
    }

    const userMessage: ChatMessage = {
      id: createId("user"),
      role: "user",
      content: trimmed,
    }

    const pendingMessages = [...messages, userMessage]
    setMessages(pendingMessages)
    setInputValue("")
    setIsLoading(true)
    setIsAwaitingResponse(true)
    setError(null)

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: BUSINESS_CONTEXT,
          messages: pendingMessages.map(({ role, content }) => ({ role, content })),
        }),
      })

      const rawBody = await response.text()
      let parsedBody: unknown

      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : null
      } catch (parseError) {
        console.warn("AssistantWidget no pudo parsear la respuesta", parseError)
      }

      if (!response.ok) {
        const parsedMessage =
          typeof (parsedBody as { error?: string })?.error === "string"
            ? (parsedBody as { error: string }).error
            : null

        const parsedDetails = (parsedBody as { details?: unknown })?.details
        const detailedMessage =
          typeof parsedDetails === "string"
            ? parsedDetails
            : typeof parsedDetails === "object" && parsedDetails
              ? JSON.stringify(parsedDetails)
              : null

        const combinedMessage = [parsedMessage, detailedMessage]
          .filter(Boolean)
          .join(" · ")

        throw new Error(
          combinedMessage || `Solicitud rechazada con estado ${response.status}`,
        )
      }

      const result = parsedBody as { message?: { content?: string } | string } | null
      const contentFromApi: string =
        typeof result?.message === "string"
          ? result.message
          : result?.message?.content ?? ""

      if (!contentFromApi) {
        throw new Error("Respuesta vacía del asistente")
      }

      await animateAssistantResponse(contentFromApi.trim())
    } catch (apiError) {
      console.error("AssistantWidget submit error", apiError)
      const fallbackError =
        apiError instanceof Error ? apiError.message : "Error desconocido al consultar al asistente"

      setError(
        `No pude obtener una respuesta del asistente. ${fallbackError}. Verifica Ollama y vuelve a intentar.`,
      )
    } finally {
      setIsAwaitingResponse(false)
      setIsLoading(false)
    }
  }, [animateAssistantResponse, inputValue, isLoading, messages])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      await submitMessage()
    },
    [submitMessage],
  )

  const handleKeyDown = useCallback(
    async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        await submitMessage()
      }
    },
    [submitMessage],
  )

  const displayedMessages = useMemo(
    () => (typingMessage ? [...messages, typingMessage] : messages),
    [messages, typingMessage],
  )

  const resolvedUserInitial = useMemo(() => {
    const fromProp = typeof userInitial === "string" ? userInitial.trim() : ""
    const normalized = fromProp ? fromProp.toUpperCase() : ""
    return normalized || "T"
  }, [userInitial])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen ? (
        <div
          className={cn(
            "w-96 max-w-[calc(100vw-3rem)] rounded-2xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/80",
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">SoftdatAI</p>
              <p className="text-xs text-muted-foreground">
                Inteligencia artificial para ayudarte con información del sistema.
              </p>
            </div>
            <Button
              aria-label="Cerrar asistente"
              size="icon"
              variant="ghost"
              onClick={toggleWidget}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="mb-3 h-64 space-y-3 overflow-y-auto pr-1 text-sm">
            {displayedMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex w-full items-end gap-2",
                  message.role === "assistant" ? "justify-start" : "justify-end",
                )}
              >
                {message.role === "assistant" ? (
                  <MessageInitialBadge initial={ASSISTANT_INITIAL} variant="assistant" />
                ) : null}
                <div
                  className={cn(
                    "max-w-[82%] rounded-xl px-3 py-2 leading-relaxed",
                    message.role === "assistant"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {renderMessageContent(message.content)}
                </div>
                {message.role === "user" ? (
                  <MessageInitialBadge initial={resolvedUserInitial} variant="user" />
                ) : null}
              </div>
            ))}
            {isAwaitingResponse ? (
              <div className="flex w-full items-end gap-2 justify-start">
                <MessageInitialBadge initial={ASSISTANT_INITIAL} variant="assistant" />
                <div className="max-w-[82%] rounded-xl bg-muted px-3 py-2 text-muted-foreground">
                  <span className="flex min-w-[1.5rem] justify-center font-semibold tracking-[0.35em] text-base">
                    <span className="animate-pulse">...</span>
                  </span>
                </div>
              </div>
            ) : null}
            <div ref={scrollAnchorRef} />
          </div>

          {error ? (
            <p className="mb-2 text-xs text-destructive">{error}</p>
          ) : null}

          <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
            <Textarea
              aria-label="Escribe tu mensaje para SoftdatAI"
              placeholder="Escribe tu pregunta..."
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <div className="flex items-center justify-end text-xs text-muted-foreground">
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !inputValue.trim()}
                className="gap-2"
              >
                {isLoading ? "Enviando" : "Enviar"}
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <Button
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg"
        onClick={toggleWidget}
        aria-label={isOpen ? "Cerrar asistente" : "Abrir asistente"}
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
      </Button>
    </div>
  )
}

function renderMessageContent(content: string) {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  if (blocks.length === 0) {
    return <span className="whitespace-pre-wrap">{content}</span>
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean)
        const isOrdered = lines.length > 0 && lines.every((line) => /^\d+[\).]\s+/.test(line))
        const isUnordered = lines.length > 0 && lines.every((line) => /^[-*•]\s+/.test(line))

        if (isOrdered) {
          return (
            <ol key={`ordered-${index}`} className="list-decimal space-y-1 pl-4">
              {lines.map((line, lineIndex) => (
                <li key={`ordered-${index}-${lineIndex}`} className="whitespace-pre-wrap">
                  {renderInlineElements(line.replace(/^\d+[\).]\s+/, ""), `ordered-${index}-${lineIndex}`)}
                </li>
              ))}
            </ol>
          )
        }

        if (isUnordered) {
          return (
            <ul key={`unordered-${index}`} className="list-disc space-y-1 pl-4">
              {lines.map((line, lineIndex) => (
                <li key={`unordered-${index}-${lineIndex}`} className="whitespace-pre-wrap">
                  {renderInlineElements(line.replace(/^[-*•]\s+/, ""), `unordered-${index}-${lineIndex}`)}
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={`paragraph-${index}`} className="whitespace-pre-wrap">
            {lines.map((line, lineIndex) => (
              <Fragment key={`paragraph-${index}-${lineIndex}`}>
                {renderInlineElements(line, `paragraph-${index}-${lineIndex}`)}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function splitIntoSegments(value: string) {
  return value.match(/(\s+|\S+)/g) ?? []
}

function getSegmentDelay(segment: string) {
  if (segment.includes("\n")) {
    return 160
  }

  if (!segment.trim()) {
    return 28
  }

  if (/[.?!]$/.test(segment.trim())) {
    return 150
  }

  if (segment.length > 12) {
    return 65
  }

  return 42
}

type MessageInitialBadgeProps = {
  initial: string
  variant: "assistant" | "user"
}

function MessageInitialBadge({ initial, variant }: MessageInitialBadgeProps) {
  const baseClasses = "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
  const appearance =
    variant === "assistant"
      ? "bg-secondary text-secondary-foreground"
      : "bg-primary text-primary-foreground"

  return (
    <div className={cn(baseClasses, appearance)} aria-hidden="true">
      {initial}
    </div>
  )
}

function renderInlineElements(text: string, keyPrefix: string) {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let tokenIndex = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={`${keyPrefix}-text-${tokenIndex}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>,
      )
    }

    const token = match[0]
    const inner = token.slice(token.startsWith("**") ? 2 : 1, token.endsWith("**") ? -2 : -1)

    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${tokenIndex}`} className="font-semibold">
          {inner}
        </strong>,
      )
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={`${keyPrefix}-em-${tokenIndex}`} className="italic">
          {inner}
        </em>,
      )
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={`${keyPrefix}-code-${tokenIndex}`} className="rounded bg-muted px-1 py-[1px] font-mono text-xs">
          {inner}
        </code>,
      )
    }

    lastIndex = match.index + token.length
    tokenIndex += 1
  }

  if (lastIndex < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-tail`}>{text.slice(lastIndex)}</Fragment>,
    )
  }

  if (nodes.length === 0) {
    return text
  }

  return nodes
}
