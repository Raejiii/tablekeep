import { ApiError, FinishReason, GoogleGenAI } from '@google/genai'
import { buildRecapMessage, RECAP_MODEL, RECAP_SYSTEM_PROMPT, RecapInputError } from '@/lib/recap'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

function textError(message: string, status: number) {
    return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

// Streams an AI recap of a session's notes as plain text, then saves it to the session.
export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: claims } = await supabase.auth.getClaims()
    if (!claims?.claims?.sub) return textError('Sign in to generate recaps.', 401)

    const { sessionId } = (await request.json().catch(() => ({}))) as { sessionId?: string }
    if (!sessionId) return textError('Missing session.', 400)

    // RLS makes this return nothing unless the user is in the campaign
    const { data: session } = await supabase
        .from('sessions')
        .select('id, title, notes, campaign_id, campaigns (name)')
        .eq('id', sessionId)
        .maybeSingle()
    if (!session) return textError('Session not found.', 404)

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        return textError('AI recaps are not set up yet. Add a GEMINI_API_KEY to the environment.', 503)
    }

    const { data: members } = await supabase
        .from('campaign_members')
        .select('character_name, profiles (display_name)')
        .eq('campaign_id', session.campaign_id)

    let userMessage: string
    try {
        userMessage = buildRecapMessage({
            campaignName: session.campaigns?.name ?? 'Campaign',
            sessionTitle: session.title,
            notes: session.notes,
            partyNames: (members ?? []).map((m) => m.character_name || m.profiles?.display_name || ''),
        })
    } catch (error) {
        if (error instanceof RecapInputError) return textError(error.message, 422)
        throw error
    }

    const ai = new GoogleGenAI({ apiKey })
    const abort = new AbortController()

    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
        async start(controller) {
            let recap = ''
            let blocked = false
            try {
                const stream = await ai.models.generateContentStream({
                    model: RECAP_MODEL,
                    contents: userMessage,
                    config: {
                        systemInstruction: RECAP_SYSTEM_PROMPT,
                        maxOutputTokens: 4000,
                        abortSignal: abort.signal,
                    },
                })
                for await (const chunk of stream) {
                    const finish = chunk.candidates?.[0]?.finishReason
                    if (chunk.promptFeedback?.blockReason || finish === FinishReason.SAFETY || finish === FinishReason.PROHIBITED_CONTENT) {
                        blocked = true
                    }
                    if (chunk.text) {
                        recap += chunk.text
                        controller.enqueue(encoder.encode(chunk.text))
                    }
                }
                if (blocked) {
                    controller.enqueue(encoder.encode('\n\n[The recap could not be generated for these notes.]'))
                } else if (recap.trim()) {
                    await supabase.from('sessions').update({ recap: recap.trim(), updated_at: new Date().toISOString() }).eq('id', sessionId)
                }
                controller.close()
            } catch (error) {
                if (abort.signal.aborted) return
                const message =
                    error instanceof ApiError && error.status === 429
                        ? 'Too many recap requests right now. Try again in a minute.'
                        : error instanceof ApiError && (error.status === 400 || error.status === 403) && /api key/i.test(error.message)
                          ? 'The Gemini API key is invalid.'
                          : error instanceof ApiError
                            ? `The AI service returned an error (${error.status}).`
                            : 'Something went wrong while writing the recap.'
                controller.enqueue(encoder.encode(`\n\n[${message}]`))
                controller.close()
            }
        },
        cancel() {
            abort.abort()
        },
    })

    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
}
