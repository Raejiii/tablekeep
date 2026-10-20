// Dice notation parser and roller.
// Supports terms like "d20", "2d6", "4d6kh3" (keep highest 3), "2d20kl1" (keep lowest 1)
// and flat modifiers, joined with + or -: "1d20+5", "2d6+1d4-1".

export type DiceTerm = {
    kind: 'dice'
    sign: 1 | -1
    count: number
    sides: number
    keep?: { which: 'highest' | 'lowest'; amount: number }
}

export type ModifierTerm = { kind: 'modifier'; sign: 1 | -1; value: number }

export type Term = DiceTerm | ModifierTerm

export type RolledTerm =
    | (DiceTerm & { rolls: number[]; kept: boolean[]; subtotal: number })
    | (ModifierTerm & { subtotal: number })

export type RollResult = { expression: string; terms: RolledTerm[]; total: number }

export const MAX_DICE = 100
export const MAX_SIDES = 1000
const MAX_TERMS = 10

export class DiceError extends Error {}

const TERM_PATTERN = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$|^(\d+)$/

/** Normalise user input: lowercase, no spaces, a leading sign is optional. */
export function normalise(expression: string): string {
    return expression.toLowerCase().replace(/\s+/g, '')
}

export function parse(expression: string): Term[] {
    const input = normalise(expression)
    if (!input) throw new DiceError('Enter a roll, like d20 or 2d6+3')
    if (input.length > 40) throw new DiceError('That roll is too long')

    // split into signed chunks: "2d6+3-1d4" -> ["2d6", "+3", "-1d4"]
    const chunks = input.match(/[+-]?[^+-]+/g)
    if (!chunks || chunks.join('') !== input) throw new DiceError(`Can't read "${expression}"`)
    if (chunks.length > MAX_TERMS) throw new DiceError(`Use at most ${MAX_TERMS} terms`)

    return chunks.map((chunk) => {
        const sign: 1 | -1 = chunk.startsWith('-') ? -1 : 1
        const body = chunk.replace(/^[+-]/, '')
        const match = body.match(TERM_PATTERN)
        if (!match) throw new DiceError(`Can't read "${body}"`)

        if (match[5] !== undefined) {
            return { kind: 'modifier', sign, value: Number(match[5]) }
        }

        const count = match[1] === '' ? 1 : Number(match[1])
        const sides = Number(match[2])
        if (count < 1 || count > MAX_DICE) throw new DiceError(`Roll between 1 and ${MAX_DICE} dice`)
        if (sides < 2 || sides > MAX_SIDES) throw new DiceError(`Dice need between 2 and ${MAX_SIDES} sides`)

        const term: DiceTerm = { kind: 'dice', sign, count, sides }
        if (match[3]) {
            const amount = Number(match[4])
            if (amount < 1 || amount > count) throw new DiceError(`Can only keep between 1 and ${count} dice`)
            term.keep = { which: match[3] === 'kh' ? 'highest' : 'lowest', amount }
        }
        return term
    })
}

/** Returns an integer from 1 to sides. Uses crypto randomness when available. */
export function cryptoDie(sides: number): number {
    const values = new Uint32Array(1)
    // rejection sampling avoids modulo bias
    const limit = Math.floor(0x100000000 / sides) * sides
    do {
        crypto.getRandomValues(values)
    } while (values[0] >= limit)
    return (values[0] % sides) + 1
}

export function roll(expression: string, die: (sides: number) => number = cryptoDie): RollResult {
    const terms = parse(expression)

    const rolled: RolledTerm[] = terms.map((term) => {
        if (term.kind === 'modifier') {
            return { ...term, subtotal: term.sign * term.value }
        }
        const rolls = Array.from({ length: term.count }, () => die(term.sides))
        const kept = keptMask(rolls, term.keep)
        const sum = rolls.reduce((total, value, index) => (kept[index] ? total + value : total), 0)
        return { ...term, rolls, kept, subtotal: term.sign * sum }
    })

    const total = rolled.reduce((sum, term) => sum + term.subtotal, 0)
    return { expression: normalise(expression), terms: rolled, total }
}

/** Marks which dice count towards the total for kh/kl rolls. Ties keep the earliest dice. */
export function keptMask(rolls: number[], keep?: DiceTerm['keep']): boolean[] {
    if (!keep) return rolls.map(() => true)
    const order = rolls
        .map((value, index) => ({ value, index }))
        .sort((a, b) => (keep.which === 'highest' ? b.value - a.value : a.value - b.value) || a.index - b.index)
    const keepIndexes = new Set(order.slice(0, keep.amount).map((entry) => entry.index))
    return rolls.map((_, index) => keepIndexes.has(index))
}

/** A natural 20 or natural 1 on a single kept d20, for celebrating in the UI. */
export function criticalOf(result: RollResult): 'success' | 'fail' | null {
    const d20s = result.terms.filter(
        (term): term is Extract<RolledTerm, { kind: 'dice' }> => term.kind === 'dice' && term.sides === 20,
    )
    if (d20s.length !== 1) return null
    const keptValues = d20s[0].rolls.filter((_, index) => d20s[0].kept[index])
    if (keptValues.length !== 1) return null
    if (keptValues[0] === 20) return 'success'
    if (keptValues[0] === 1) return 'fail'
    return null
}

/** Human-readable breakdown, e.g. "2d20kh1 [~~4~~, 17] + 5". */
export function describe(result: RollResult): string {
    return result.terms
        .map((term, index) => {
            const prefix = index === 0 ? (term.sign === -1 ? '-' : '') : term.sign === -1 ? ' - ' : ' + '
            if (term.kind === 'modifier') return `${prefix}${term.value}`
            const keep = term.keep ? `${term.keep.which === 'highest' ? 'kh' : 'kl'}${term.keep.amount}` : ''
            const values = term.rolls.map((value, i) => (term.kept[i] ? `${value}` : `~~${value}~~`)).join(', ')
            return `${prefix}${term.count}d${term.sides}${keep} [${values}]`
        })
        .join('')
}
