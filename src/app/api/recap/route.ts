import Anthropic from '@anthropic-ai/sdk'
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

    if (!process.env.ANTHROPIC_API_KEY) {
        return textError('AI recaps are not set up yet. Add an ANTHROPIC_API_KEY to the environment.', 503)
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

    const anthropic = new Anthropic()
    const stream = anthropic.beta.messages.stream({
        model: RECAP_MODEL,
        max_tokens: 4000,
        // a short creative summary doesn't need deep reasoning
        output_config: { effort: 'low' },
        // if a safety classifier declines, retry on Anthropic's recommended fallback model
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: RECAP_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
    })

    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
        async start(controller) {
            let recap = ''
            try {
                for await (const event of stream) {
                    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                        recap += event.delta.text
                        controller.enqueue(encoder.encode(event.delta.text))
                    }
                }
                const final = await stream.finalMessage()
                if (final.stop_reason === 'refusal') {
                    controller.enqueue(encoder.encode('\n\n[The recap could not be generated for these notes.]'))
                } else if (recap.trim()) {
                    await supabase.from('sessions').update({ recap: recap.trim(), updated_at: new Date().toISOString() }).eq('id', sessionId)
                }
                controller.close()
            } catch (error) {
                const message =
                    error instanceof Anthropic.AuthenticationError
                        ? 'The Anthropic API key is invalid.'
                        : error instanceof Anthropic.RateLimitError
                          ? 'Too many recap requests right now. Try again in a minute.'
                          : error instanceof Anthropic.APIError
                            ? `The AI service returned an error (${error.status}).`
                            : 'Something went wrong while writing the recap.'
                controller.enqueue(encoder.encode(`\n\n[${message}]`))
                controller.close()
            }
        },
        cancel() {
            stream.abort()
        },
    })

    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
}
