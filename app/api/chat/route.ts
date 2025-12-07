import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@/lib/supabase/server"
import { CHATBOT_CONFIG, type ServiceContext, type Intent } from "@/lib/chatbot/config"

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

interface ChatRequest {
  message: string
  conversationHistory?: Array<{ role: string; content: string }>
  language?: "en" | "krio"
  serviceContext?: ServiceContext
  sessionId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const { message, conversationHistory = [], language = "en", serviceContext = "general", sessionId } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Initialize Supabase client
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Detect intent from message
    const intent = detectIntent(message)

    // Fetch contextual data based on intent
    const contextData = await fetchContextualData(supabase, intent, message)

    // Build system prompt
    const systemPrompt = buildSystemPrompt(serviceContext, language, contextData)

    // Generate AI response
    const model = genAI.getGenerativeModel({
      model: CHATBOT_CONFIG.model.name,
      systemInstruction: systemPrompt,
    })

    const chatHistory = conversationHistory
      .filter((msg) => msg.content && msg.role) // Filter out empty messages
      .map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user", // Map 'assistant' to 'model'
        parts: [{ text: msg.content }],
      }))

    if (chatHistory.length > 0 && chatHistory[0].role !== "user") {
      // If first message is not user, prepend a user greeting
      chatHistory.unshift({
        role: "user",
        parts: [{ text: "Hello" }],
      })
    }

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: CHATBOT_CONFIG.model.temperature,
        maxOutputTokens: CHATBOT_CONFIG.model.maxTokens,
        topP: CHATBOT_CONFIG.model.topP,
      },
    })

    const result = await chat.sendMessage(message)
    const aiResponse = result.response.text()

    // Generate suggestions based on intent and context
    const suggestions = generateSuggestions(intent, serviceContext)

    if (user && sessionId) {
      await saveConversation(supabase, {
        userId: user.id,
        sessionId,
        userMessage: message,
        aiResponse,
        intent,
        serviceContext,
        language,
      })
    }

    return NextResponse.json({
      response: aiResponse,
      suggestions,
      intent,
      context: serviceContext,
    })
  } catch (error) {
    console.error("[v0] Chat API error:", error)

    // Handle rate limiting
    if (error instanceof Error && error.message.includes("quota")) {
      return NextResponse.json(
        {
          error: "AI service temporarily unavailable due to high demand. Please try again in a few minutes.",
          fallback: true,
        },
        { status: 429 },
      )
    }

    return NextResponse.json(
      {
        error: "Sorry, I encountered an error processing your request. Please try again.",
        fallback: true,
      },
      { status: 500 },
    )
  }
}

// Detect user intent from message
function detectIntent(message: string): Intent {
  const lowerMessage = message.toLowerCase()

  for (const [intent, keywords] of Object.entries(CHATBOT_CONFIG.intentKeywords)) {
    if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
      return intent as Intent
    }
  }

  return "general_inquiry"
}

// Fetch contextual data from Supabase based on intent
async function fetchContextualData(supabase: any, intent: Intent, message: string): Promise<string> {
  try {
    const lowerMessage = message.toLowerCase()

    switch (intent) {
      case "business_verification": {
        const { data: businesses } = await supabase
          .from("businesses")
          .select("name, district, category, phone, is_verified")
          .or(`name.ilike.%${lowerMessage.split(" ").slice(0, 3).join("%")}%`)
          .limit(5)

        if (businesses && businesses.length > 0) {
          return `\n\nRelevant businesses found:\n${businesses.map((b: any) => `- ${b.name} (${b.district}, ${b.category})${b.is_verified ? " ✓ Verified" : ""}`).join("\n")}`
        }
        break
      }

      case "job_search": {
        // Extract location from message
        const districts = ["freetown", "bo", "kenema", "makeni", "koidu", "port loko", "waterloo", "kabala", "kailahun"]
        const mentionedDistrict = districts.find((d) => lowerMessage.includes(d))

        let query = supabase.from("jobs").select("title, company, location, type, salary_range").eq("is_active", true)

        if (mentionedDistrict) {
          query = query.ilike("location", `%${mentionedDistrict}%`)
        }

        const { data: jobs } = await query.limit(5)

        if (jobs && jobs.length > 0) {
          return `\n\nCurrent job openings${mentionedDistrict ? ` in ${mentionedDistrict}` : ""}:\n${jobs.map((j: any) => `- ${j.title} at ${j.company} (${j.location}) - ${j.salary_range || "Competitive salary"}`).join("\n")}`
        }
        break
      }

      case "healthcare": {
        const { data: facilities } = await supabase
          .from("health_facilities")
          .select("name, type, district, services, emergency_services")
          .limit(5)

        if (facilities && facilities.length > 0) {
          return `\n\nNearby health facilities:\n${facilities.map((f: any) => `- ${f.name} (${f.type}, ${f.district})${f.emergency_services ? " - Emergency 24/7" : ""}`).join("\n")}`
        }
        break
      }

      default:
        return ""
    }

    return ""
  } catch (error) {
    console.error("[v0] Error fetching contextual data:", error)
    return ""
  }
}

// Build system prompt based on service context
function buildSystemPrompt(serviceContext: ServiceContext, language: string, contextData: string): string {
  const basePrompt = `You are Salone Assist AI Helper, a friendly and knowledgeable assistant for Sierra Leone's digital public services platform.

Your role:
- Provide accurate information about businesses, jobs, healthcare, career guidance, and government services in Sierra Leone
- Maintain a warm, professional, and culturally appropriate tone
- Understand both English and Krio languages
- Offer to guide users to specific platform features when relevant
- Be concise but comprehensive in your responses

Current service context: ${serviceContext}
Language preference: ${language === "krio" ? "Krio (include Krio greetings when appropriate)" : "English"}

${contextData ? `Context from database:${contextData}` : ""}

Important guidelines:
- For medical questions, always remind users to consult healthcare professionals for emergencies
- For legal/official matters, direct users to official government offices
- For job applications, encourage users to use the CV builder and application tools
- Always be honest if you don't have specific information
- Provide actionable next steps when possible`

  return basePrompt
}

// Generate contextual suggestions based on intent
function generateSuggestions(intent: Intent, serviceContext: ServiceContext): string[] {
  const contextSuggestions = CHATBOT_CONFIG.quickActions[serviceContext] || CHATBOT_CONFIG.quickActions.general

  // Add intent-specific suggestions
  const intentSuggestions: Record<Intent, string[]> = {
    business_verification: ["Search for verified businesses", "Learn about business registration", "Contact business"],
    job_search: ["View all jobs", "Build my CV", "Set up job alerts"],
    healthcare: ["Find nearest clinic", "Emergency contacts", "Health tips"],
    career_guidance: ["Check my eligibility", "Compare universities", "Find scholarships"],
    government_services: ["Apply for NIN", "Passport requirements", "Government offices"],
    scam_verification: ["Report this scam", "Learn about common scams", "Verify sender"],
    general_inquiry: contextSuggestions.slice(0, 3),
  }

  return intentSuggestions[intent] || contextSuggestions.slice(0, 3)
}

// Save conversation to database
async function saveConversation(
  supabase: any,
  data: {
    userId: string
    sessionId: string
    userMessage: string
    aiResponse: string
    intent: Intent
    serviceContext: ServiceContext
    language: string
  },
) {
  try {
    // Get or create session
    let { data: session } = await supabase.from("chat_sessions").select("id").eq("id", data.sessionId).single()

    if (!session) {
      const { data: newSession } = await supabase
        .from("chat_sessions")
        .insert({
          id: data.sessionId,
          user_id: data.userId,
          context_type: data.serviceContext,
          title: data.userMessage.slice(0, 50) + (data.userMessage.length > 50 ? "..." : ""),
        })
        .select("id")
        .single()

      session = newSession
    }

    if (session) {
      // Save messages
      await supabase.from("chat_messages").insert([
        {
          session_id: session.id,
          role: "user",
          content: data.userMessage,
          language: data.language,
          intent: data.intent,
        },
        {
          session_id: session.id,
          role: "assistant",
          content: data.aiResponse,
          language: data.language,
          intent: data.intent,
          context_data: { service_context: data.serviceContext },
        },
      ])
    }
  } catch (error) {
    console.error("[v0] Error saving conversation:", error)
    // Don't throw - conversation saving is optional
  }
}

// CORS headers for cross-origin requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
