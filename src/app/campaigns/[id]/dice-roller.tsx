'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { criticalOf, type RolledTerm } from '@/lib/dice'
import type { DiceRollRow } from '@/lib/types'
import { rollDice } from './actions'

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100]
const MAX_LOG = 50

function RollTerms({ terms }: { terms: RolledTerm[] }) {
    return (
        <span className="font-ui text-sm text-dust">
            {terms.map((term, index) => {
                const sign = term.sign === -1 ? ' − ' : index > 0 ? ' + ' : ''
                if (term.kind === 'modifier') {
                    return (
                        <span key={index}>
                            {sign}
                            {term.value}
                        </span>
                    )
                }
                return (
                    <span key={index}>
                        {sign}[
                        {term.rolls.map((value, i) => (
                            <span key={i} className={term.kept[i] ? 'text-bone' : 'text-dust/60 line-through'}>
                                {i > 0 ? ', ' : ''}
                                {value}
                            </span>
                        ))}
                        ]
                    </span>
                )
            })}
        </span>
    )
}

function RollEntry({ roll }: { roll: DiceRollRow }) {
    const critical = criticalOf({ expression: roll.expression, terms: roll.detail, total: roll.total })
    const time = new Date(roll.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return (
        <li
            className={`animate-roll-in grid grid-cols-[1fr_auto] items-center gap-x-3 border-l-4 px-3 py-2 ${
                critical === 'success'
                    ? 'border-gold bg-gold/10'
                    : critical === 'fail'
                      ? 'border-blood bg-blood/10'
                      : 'border-line bg-ink/60'
            }`}
        >
            <div className="min-w-0">
                <p className="truncate font-ui text-sm">
                    <span className="font-bold text-gold-light">{roll.roller_name}</span>{' '}
                    <span className="text-dust">rolled</span> <span className="font-bold">{roll.expression}</span>
                    {critical === 'success' && <span className="ml-2 font-bold text-gold-light">Natural 20!</span>}
                    {critical === 'fail' && <span className="ml-2 font-bold text-[#ff4d4d]">Natural 1</span>}
                </p>
                <RollTerms terms={roll.detail} />
            </div>
            <div className="text-right">
                <p className="font-heading text-3xl font-bold leading-none text-white">{roll.total}</p>
                <p className="font-ui text-[0.7rem] text-dust">{time}</p>
            </div>
        </li>
    )
}

export function DiceRoller({ campaignId, initialRolls }: { campaignId: string; initialRolls: DiceRollRow[] }) {
    const [rolls, setRolls] = useState(initialRolls)
    const [expression, setExpression] = useState('')
    const [modifier, setModifier] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    // new rolls from anyone at the table arrive through Supabase Realtime
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel(`rolls:${campaignId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'dice_rolls', filter: `campaign_id=eq.${campaignId}` },
                (payload) => {
                    const row = payload.new as DiceRollRow
                    setRolls((current) => (current.some((r) => r.id === row.id) ? current : [row, ...current].slice(0, MAX_LOG)))
                },
            )
            .subscribe()
        return () => {
            supabase.removeChannel(channel)
        }
    }, [campaignId])

    function send(notation: string) {
        setError(null)
        startTransition(async () => {
            const result = await rollDice(campaignId, notation)
            if (result.error) setError(result.error)
        })
    }

    const withModifier = (base: string) => (modifier === 0 ? base : `${base}${modifier > 0 ? '+' : ''}${modifier}`)

    return (
        <section className="panel flex flex-col p-5" aria-labelledby="dice-heading">
            <h2 id="dice-heading" className="panel-title">
                Dice
            </h2>
            <div className="taper my-3" />

            <div className="flex flex-wrap gap-2">
                {QUICK_DICE.map((sides) => (
                    <button
                        key={sides}
                        onClick={() => send(withModifier(`1d${sides}`))}
                        disabled={pending}
                        aria-label={`Roll a d${sides}`}
                        className="btn btn-outline min-w-14 px-3 normal-case"
                    >
                        d{sides}
                    </button>
                ))}
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-2">
                <button onClick={() => send(withModifier('2d20kh1'))} disabled={pending} className="btn btn-outline">
                    Advantage
                </button>
                <button onClick={() => send(withModifier('2d20kl1'))} disabled={pending} className="btn btn-outline">
                    Disadvantage
                </button>
                <label className="ml-auto flex items-center gap-2 font-ui text-sm text-dust">
                    Modifier
                    <input
                        type="number"
                        value={modifier}
                        onChange={(event) => setModifier(Math.max(-30, Math.min(30, Number(event.target.value) || 0)))}
                        className="input w-20 text-center"
                        aria-label="Modifier added to quick rolls"
                    />
                </label>
            </div>

            <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault()
                    if (expression.trim()) send(expression)
                }}
            >
                <input
                    value={expression}
                    onChange={(event) => setExpression(event.target.value)}
                    placeholder="Custom roll, e.g. 4d6kh3 or 1d8+1d6+3"
                    className="input"
                    aria-label="Custom dice expression"
                    maxLength={40}
                />
                <button className="btn btn-primary" disabled={pending}>
                    Roll
                </button>
            </form>
            {error && (
                <p role="alert" className="mt-2 font-ui text-sm text-[#ff4d4d]">
                    {error}
                </p>
            )}

            <h3 className="mt-5 font-ui text-xs font-bold uppercase tracking-widest text-dust">Table log</h3>
            <ol aria-live="polite" className="mt-2 flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto pr-1">
                {rolls.length === 0 ? (
                    <li className="font-ui text-sm italic text-dust">No rolls yet. Go on, roll something.</li>
                ) : (
                    rolls.map((roll) => <RollEntry key={roll.id} roll={roll} />)
                )}
            </ol>
        </section>
    )
}
