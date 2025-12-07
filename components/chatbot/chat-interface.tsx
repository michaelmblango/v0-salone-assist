"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Mic, X, Copy, Check, Loader2, MessageCircle, Globe, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { CHATBOT_CONFIG, type ServiceContext } from "@/lib/chatbot/config"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  suggestions?: string[]
}

interface ChatInterfaceProps {
  serviceContext?: ServiceContext
  initialMessage?: string
  className?: string
  embedded?: boolean
}

export function ChatInterface({
  serviceContext = "general",
  initialMessage,
  className,
  embedded = false,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [language, setLanguage] = useState<"en" | "krio">("en")
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: "welcome",
      role: "assistant",
      content: initialMessage || CHATBOT_CONFIG.greetings[serviceContext],
      timestamp: new Date(),
      suggestions: CHATBOT_CONFIG.quickActions[serviceContext],
    }
    setMessages([welcomeMessage])
  }, [serviceContext, initialMessage])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Handle sending messages
  const handleSend = async (content?: string) => {
    const messageText = content || input.trim()
    if (!messageText || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          conversationHistory: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          language,
          serviceContext,
          sessionId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json()

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        suggestions: data.suggestions,
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("[v0] Chat error:", error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "I'm sorry, I encountered an error processing your request. Please try again or contact support if the problem persists.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion)
  }

  // Handle copy message
  const handleCopy = async (messageId: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(messageId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!embedded && !isOpen) {
    return (
      <Button
        size="lg"
        className="fixed bottom-4 right-4 z-50 h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-r from-[#1EB53A] to-[#0072C6] shadow-2xl hover:scale-110 transition-transform"
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
      </Button>
    )
  }

  return (
    <Card
      className={cn(
        "flex flex-col shadow-2xl border-2",
        embedded
          ? "h-[600px]"
          : "fixed z-50 inset-x-0 bottom-0 h-[100dvh] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[600px] sm:w-[400px] sm:rounded-2xl",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b bg-gradient-to-r from-[#1EB53A] to-[#0072C6] p-4 sm:rounded-t-2xl text-white">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-white shrink-0">
            <AvatarFallback className="bg-white text-[#1EB53A]">
              <Shield className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm sm:text-base truncate">Salone Assist AI</h3>
            <div className="flex items-center gap-1 text-xs text-white/90">
              <div className="h-2 w-2 rounded-full bg-green-300 animate-pulse" />
              <span>Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white hover:bg-white/20"
            onClick={() => setLanguage((prev) => (prev === "en" ? "krio" : "en"))}
            title="Toggle language"
          >
            <Globe className="h-4 w-4" />
          </Button>
          {!embedded && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/20"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id}>
              <div className={cn("flex gap-2 sm:gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                {message.role === "assistant" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-[#1EB53A] text-white text-xs">
                      <Shield className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3",
                    message.role === "user"
                      ? "bg-[#0072C6] text-white rounded-br-sm"
                      : "bg-muted text-foreground shadow-sm rounded-bl-sm",
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed break-words">{message.content}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={cn("text-xs", message.role === "user" ? "text-white/70" : "text-muted-foreground")}
                    >
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {message.role === "assistant" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleCopy(message.id, message.content)}
                      >
                        {copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                </div>
                {message.role === "user" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-[#0072C6] text-white text-xs">U</AvatarFallback>
                  </Avatar>
                )}
              </div>

              {message.role === "assistant" && message.suggestions && message.suggestions.length > 0 && (
                <div className="ml-10 sm:ml-11 mt-2 flex flex-wrap gap-2">
                  {message.suggestions.map((suggestion, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="cursor-pointer text-xs hover:bg-[#1EB53A] hover:text-white hover:border-[#1EB53A] transition-colors"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2 sm:gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-[#1EB53A] text-white text-xs">
                  <Shield className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-2xl bg-muted px-4 py-3 rounded-bl-sm">
                <div className="flex gap-1">
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-foreground/40"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-foreground/40"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-foreground/40"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-3 sm:p-4 safe-area-inset-bottom">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 h-11 w-11 bg-transparent"
            disabled
            title="Voice input (coming soon)"
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={language === "krio" ? "Rayt yu mɛsej ya..." : "Type your message..."}
            className="min-h-[44px] max-h-32 resize-none text-base"
            disabled={isLoading}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="shrink-0 h-11 w-11 bg-[#1EB53A] hover:bg-[#1EB53A]/90"
            size="icon"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </Card>
  )
}
