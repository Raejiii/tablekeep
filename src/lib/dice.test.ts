import { describe as group, expect, it } from 'vitest'
import { criticalOf, DiceError, describe, keptMask, parse, roll } from './dice'

// deterministic die that replays a fixed sequence
function sequence(...values: number[]) {
    let index = 0
    return () => values[index++ % values.length]
}

group('parse', () => {
    it('reads a single die', () => {
        expect(parse('d20')).toEqual([{ kind: 'dice', sign: 1, count: 1, sides: 20 }])
    })

    it('reads dice, modifiers and signs', () => {
        expect(parse('2d6 + 1d4 - 1')).toEqual([
            { kind: 'dice', sign: 1, count: 2, sides: 6 },
            { kind: 'dice', sign: 1, count: 1, sides: 4 },
            { kind: 'modifier', sign: -1, value: 1 },
        ])
    })

    it('reads keep highest and keep lowest', () => {
        expect(parse('4d6kh3')[0]).toMatchObject({ keep: { which: 'highest', amount: 3 } })
        expect(parse('2d20kl1')[0]).toMatchObject({ keep: { which: 'lowest', amount: 1 } })
    })

    it.each(['', 'banana', '2d', 'd1', '101d6', '2d20kh3', '1d20++2', '3d6x'])('rejects "%s"', (input) => {
        expect(() => parse(input)).toThrow(DiceError)
    })
})

group('roll', () => {
    it('adds dice and modifiers', () => {
        const result = roll('2d6+3', sequence(4, 5))
        expect(result.total).toBe(12)
    })

    it('subtracts negative terms', () => {
        expect(roll('1d8-1d4-2', sequence(8, 3)).total).toBe(3)
    })

    it('keeps the highest d20 with advantage', () => {
        const result = roll('2d20kh1+5', sequence(4, 17))
        expect(result.total).toBe(22)
    })

    it('keeps the lowest d20 with disadvantage', () => {
        expect(roll('2d20kl1', sequence(4, 17)).total).toBe(4)
    })

    it('stays within range with real randomness', () => {
        for (let i = 0; i < 500; i++) {
            const { total } = roll('3d6')
            expect(total).toBeGreaterThanOrEqual(3)
            expect(total).toBeLessThanOrEqual(18)
        }
    })
})

group('keptMask', () => {
    it('keeps the earliest die on ties', () => {
        expect(keptMask([5, 5, 2], { which: 'highest', amount: 1 })).toEqual([true, false, false])
    })
})

group('criticalOf', () => {
    it('spots a natural 20 and a natural 1', () => {
        expect(criticalOf(roll('d20+3', sequence(20)))).toBe('success')
        expect(criticalOf(roll('d20', sequence(1)))).toBe('fail')
    })

    it('uses the kept die for advantage', () => {
        expect(criticalOf(roll('2d20kh1', sequence(20, 3)))).toBe('success')
        expect(criticalOf(roll('2d20kh1', sequence(1, 9)))).toBeNull()
    })

    it('ignores rolls without exactly one d20', () => {
        expect(criticalOf(roll('2d6', sequence(6, 6)))).toBeNull()
    })
})

group('describe', () => {
    it('shows dropped dice struck through', () => {
        expect(describe(roll('2d20kh1+5', sequence(4, 17)))).toBe('2d20kh1 [~~4~~, 17] + 5')
    })
})
