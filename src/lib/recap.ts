// Builds the request for an AI "previously on…" recap of a session's notes.

// on the Gemini API free tier
export const RECAP_MODEL = 'gemini-3.8-flash'
export const MAX_NOTES_CHARS = 20000

export const RECAP_SYSTEM_PROMPT = `You write session recaps for a Dungeons & Dragons group. The dungeon master reads your recap aloud at the start of the next session.

Write a "previously on…" recap from the notes you are given:
- 150 to 250 words, in vivid second person addressed to the party ("You arrived at…").
- Cover what happened, who the party met, what they found, and any unresolved threads or cliffhangers.
- Only use facts from the notes. Do not invent events, names, loot or outcomes. If the notes are thin, keep the recap short rather than padding it.
- Plain prose paragraphs, no headings or bullet points.
- Finish with one line that sets up the next session.`

export type RecapInput = {
    campaignName: string
    sessionTitle: string
    notes: string
    partyNames: string[]
}

export class RecapInputError extends Error {}

export function buildRecapMessage({ campaignName, sessionTitle, notes, partyNames }: RecapInput): string {
    const trimmed = notes.trim()
    if (trimmed.length < 20) {
        throw new RecapInputError('Write a few lines of notes first, then generate a recap.')
    }
    if (trimmed.length > MAX_NOTES_CHARS) {
        throw new RecapInputError(`Notes are too long for a recap (max ${MAX_NOTES_CHARS.toLocaleString()} characters).`)
    }

    const party = partyNames.filter(Boolean)
    return [
        `Campaign: ${campaignName}`,
        `Session: ${sessionTitle}`,
        party.length > 0 ? `Party: ${party.join(', ')}` : null,
        '',
        '<session_notes>',
        trimmed,
        '</session_notes>',
    ]
        .filter((line) => line !== null)
        .join('\n')
}
