import { describe, expect, it } from 'vitest'
import { buildRecapMessage, MAX_NOTES_CHARS, RecapInputError } from './recap'

const base = {
    campaignName: 'Curse of Strahd',
    sessionTitle: 'Session 4',
    notes: 'The party reached the Amber Temple and fought a flameskull in the library.',
    partyNames: ['Thalia', '', 'Rae'],
}

describe('buildRecapMessage', () => {
    it('includes the campaign, session, party and wrapped notes', () => {
        const message = buildRecapMessage(base)
        expect(message).toContain('Campaign: Curse of Strahd')
        expect(message).toContain('Session: Session 4')
        expect(message).toContain('Party: Thalia, Rae')
        expect(message).toMatch(/<session_notes>\nThe party reached[\s\S]*<\/session_notes>$/)
    })

    it('omits the party line when there are no names', () => {
        expect(buildRecapMessage({ ...base, partyNames: [] })).not.toContain('Party:')
    })

    it('rejects notes that are too short or too long', () => {
        expect(() => buildRecapMessage({ ...base, notes: 'too short' })).toThrow(RecapInputError)
        expect(() => buildRecapMessage({ ...base, notes: 'x'.repeat(MAX_NOTES_CHARS + 1) })).toThrow(RecapInputError)
    })
})
