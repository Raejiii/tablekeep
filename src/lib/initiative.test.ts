import { describe, expect, it } from 'vitest'
import { applyHpChange, hpStatus, nextTurn, previousTurn, sortByInitiative, type Combatant } from './initiative'

let clock = 0
function combatant(name: string, initiative: number, is_npc = false): Combatant {
    clock += 1
    return { id: name, name, initiative, hp: 10, max_hp: 10, is_npc, created_at: `2026-10-21T00:00:${String(clock).padStart(2, '0')}Z` }
}

const goblin = combatant('goblin', 12, true)
const rae = combatant('rae', 18)
const bard = combatant('bard', 12)
const party = [goblin, rae, bard]

describe('sortByInitiative', () => {
    it('orders highest first and lets players win ties', () => {
        expect(sortByInitiative(party).map((c) => c.id)).toEqual(['rae', 'bard', 'goblin'])
    })
})

describe('nextTurn', () => {
    it('starts with the top of the order', () => {
        expect(nextTurn(party, { activeId: null, round: 1 })).toEqual({ activeId: 'rae', round: 1 })
    })

    it('moves down the order', () => {
        expect(nextTurn(party, { activeId: 'rae', round: 1 })).toEqual({ activeId: 'bard', round: 1 })
    })

    it('wraps to a new round', () => {
        expect(nextTurn(party, { activeId: 'goblin', round: 1 })).toEqual({ activeId: 'rae', round: 2 })
    })

    it('handles an empty encounter', () => {
        expect(nextTurn([], { activeId: 'gone', round: 3 })).toEqual({ activeId: null, round: 3 })
    })
})

describe('previousTurn', () => {
    it('steps back into the previous round', () => {
        expect(previousTurn(party, { activeId: 'rae', round: 2 })).toEqual({ activeId: 'goblin', round: 1 })
    })

    it('does not go before round 1', () => {
        expect(previousTurn(party, { activeId: 'rae', round: 1 })).toEqual({ activeId: 'rae', round: 1 })
    })
})

describe('hp', () => {
    it('clamps damage and healing', () => {
        expect(applyHpChange({ hp: 5, max_hp: 10 }, 8)).toBe(0)
        expect(applyHpChange({ hp: 5, max_hp: 10 }, -20)).toBe(10)
        expect(applyHpChange({ hp: 5, max_hp: 0 }, -20)).toBe(25)
    })

    it('reports status', () => {
        expect(hpStatus({ hp: 10, max_hp: 10 })).toBe('healthy')
        expect(hpStatus({ hp: 5, max_hp: 10 })).toBe('bloodied')
        expect(hpStatus({ hp: 0, max_hp: 10 })).toBe('down')
        expect(hpStatus({ hp: 3, max_hp: 0 })).toBe('unknown')
    })
})
