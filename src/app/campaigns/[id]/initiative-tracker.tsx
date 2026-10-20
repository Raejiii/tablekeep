'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cryptoDie } from '@/lib/dice'
import { applyHpChange, hpStatus, nextTurn, previousTurn, sortByInitiative, type TurnState } from '@/lib/initiative'
import type { CombatantRow } from '@/lib/types'

type Props = {
    campaignId: string
    initialCombatants: CombatantRow[]
    initialTurn: TurnState
}

const STATUS_STYLE = {
    healthy: 'bg-heal',
    bloodied: 'bg-gold',
    down: 'bg-blood',
    unknown: 'bg-line',
} as const

function HpControl({ combatant, onChange }: { combatant: CombatantRow; onChange: (hp: number) => void }) {
    const [amount, setAmount] = useState('')
    const value = Number(amount)

    function apply(direction: 1 | -1) {
        if (!value) return
        onChange(applyHpChange(combatant, direction * Math.abs(value)))
        setAmount('')
    }

    return (
        <div className="flex items-center gap-1">
            <input
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="HP"
                aria-label={`Damage or healing for ${combatant.name}`}
                className="input w-14 px-2 py-1 text-center text-sm"
            />
            <button onClick={() => apply(1)} className="btn btn-outline px-2 py-1 text-[0.7rem]" title="Damage">
                Hit
            </button>
            <button onClick={() => apply(-1)} className="btn btn-outline px-2 py-1 text-[0.7rem]" title="Heal">
                Heal
            </button>
        </div>
    )
}

export function InitiativeTracker({ campaignId, initialCombatants, initialTurn }: Props) {
    const supabase = useMemo(() => createClient(), [])
    const [combatants, setCombatants] = useState(initialCombatants)
    const [turn, setTurn] = useState(initialTurn)
    const [error, setError] = useState<string | null>(null)

    const [name, setName] = useState('')
    const [initiative, setInitiative] = useState('')
    const [maxHp, setMaxHp] = useState('')
    const [isNpc, setIsNpc] = useState(false)

    const ordered = useMemo(() => sortByInitiative(combatants), [combatants])

    // keep everyone's tracker in sync
    useEffect(() => {
        const channel = supabase
            .channel(`initiative:${campaignId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'combatants', filter: `campaign_id=eq.${campaignId}` },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        const removed = payload.old as Partial<CombatantRow>
                        setCombatants((current) => current.filter((c) => c.id !== removed.id))
                        return
                    }
                    const row = payload.new as CombatantRow
                    setCombatants((current) => [...current.filter((c) => c.id !== row.id), row])
                },
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
                (payload) => {
                    const row = payload.new as { round: number; active_combatant_id: string | null }
                    setTurn({ round: row.round, activeId: row.active_combatant_id })
                },
            )
            .subscribe()
        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, campaignId])

    async function saveTurn(next: TurnState) {
        setTurn(next)
        const { error } = await supabase
            .from('campaigns')
            .update({ round: next.round, active_combatant_id: next.activeId })
            .eq('id', campaignId)
        if (error) setError(error.message)
    }

    async function addCombatant(event: React.FormEvent) {
        event.preventDefault()
        setError(null)
        const hp = Math.max(0, Number(maxHp) || 0)
        const { data, error } = await supabase
            .from('combatants')
            .insert({
                campaign_id: campaignId,
                name: name.trim().slice(0, 40),
                initiative: Number(initiative) || 0,
                hp,
                max_hp: hp,
                is_npc: isNpc,
            })
            .select()
            .single()
        if (error) return setError(error.message)
        setCombatants((current) => [...current.filter((c) => c.id !== data.id), data])
        setName('')
        setInitiative('')
        setMaxHp('')
    }

    async function updateHp(combatant: CombatantRow, hp: number) {
        setCombatants((current) => current.map((c) => (c.id === combatant.id ? { ...c, hp } : c)))
        const { error } = await supabase.from('combatants').update({ hp }).eq('id', combatant.id)
        if (error) setError(error.message)
    }

    async function remove(combatant: CombatantRow) {
        setCombatants((current) => current.filter((c) => c.id !== combatant.id))
        if (turn.activeId === combatant.id) await saveTurn(nextTurn(combatants, turn))
        const { error } = await supabase.from('combatants').delete().eq('id', combatant.id)
        if (error) setError(error.message)
    }

    async function endEncounter() {
        if (!window.confirm('End the encounter and clear the tracker?')) return
        setCombatants([])
        await saveTurn({ activeId: null, round: 1 })
        const { error } = await supabase.from('combatants').delete().eq('campaign_id', campaignId)
        if (error) setError(error.message)
    }

    return (
        <section className="panel flex flex-col p-5" aria-labelledby="initiative-heading">
            <div className="flex items-center justify-between gap-3">
                <h2 id="initiative-heading" className="panel-title">
                    Initiative
                </h2>
                <span className="border border-gold/60 px-2.5 py-0.5 font-ui text-sm font-bold uppercase tracking-wider text-gold-light">
                    Round {turn.round}
                </span>
            </div>
            <div className="taper my-3" />

            <div className="flex flex-wrap gap-2">
                <button
                    className="btn btn-outline"
                    onClick={() => saveTurn(previousTurn(combatants, turn))}
                    disabled={ordered.length === 0}
                >
                    ← Previous
                </button>
                <button className="btn btn-primary" onClick={() => saveTurn(nextTurn(combatants, turn))} disabled={ordered.length === 0}>
                    {turn.activeId ? 'Next turn →' : 'Start combat →'}
                </button>
                {ordered.length > 0 && (
                    <button className="btn btn-outline ml-auto" onClick={endEncounter}>
                        End encounter
                    </button>
                )}
            </div>

            <ol className="mt-4 flex flex-col gap-1.5" aria-label="Turn order">
                {ordered.length === 0 && (
                    <li className="font-ui text-sm italic text-dust">Add the party and the monsters to start an encounter.</li>
                )}
                {ordered.map((combatant) => {
                    const active = combatant.id === turn.activeId
                    const status = hpStatus(combatant)
                    const percent = combatant.max_hp > 0 ? (combatant.hp / combatant.max_hp) * 100 : 100
                    return (
                        <li
                            key={combatant.id}
                            aria-current={active ? 'step' : undefined}
                            className={`grid grid-cols-[2.5rem_1fr] items-center gap-x-3 gap-y-2 border-l-4 px-3 py-2 transition sm:grid-cols-[2.5rem_1fr_auto] ${
                                active ? 'border-blood bg-blood/15' : 'border-line bg-ink/60'
                            } ${status === 'down' ? 'opacity-60' : ''}`}
                        >
                            <span className="text-center font-heading text-2xl font-bold text-white">{combatant.initiative}</span>
                            <div className="min-w-0">
                                <p className="truncate font-ui font-bold">
                                    {combatant.name}{' '}
                                    {combatant.is_npc && (
                                        <span className="ml-1 border border-line px-1.5 text-[0.65rem] uppercase tracking-wider text-dust">
                                            NPC
                                        </span>
                                    )}
                                    {active && <span className="ml-2 text-xs uppercase tracking-wider text-[#ff4d4d]">Their turn</span>}
                                </p>
                                {combatant.max_hp > 0 && (
                                    <div className="mt-1 flex items-center gap-2">
                                        <div className="h-1.5 w-28 overflow-hidden bg-slate-2" aria-hidden>
                                            <div className={`h-full ${STATUS_STYLE[status]}`} style={{ width: `${percent}%` }} />
                                        </div>
                                        <span className="font-ui text-xs text-dust">
                                            {combatant.hp}/{combatant.max_hp} HP{status === 'bloodied' && ' · bloodied'}
                                            {status === 'down' && ' · down'}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
                                {combatant.max_hp > 0 && <HpControl combatant={combatant} onChange={(hp) => updateHp(combatant, hp)} />}
                                <button
                                    onClick={() => remove(combatant)}
                                    className="cursor-pointer px-1.5 text-lg text-dust hover:text-white"
                                    aria-label={`Remove ${combatant.name}`}
                                >
                                    ×
                                </button>
                            </div>
                        </li>
                    )
                })}
            </ol>

            <form onSubmit={addCombatant} className="mt-4 grid grid-cols-2 gap-2 border-t border-dashed border-line pt-4 sm:grid-cols-[1.6fr_1fr_1fr_auto]">
                <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Name"
                    required
                    maxLength={40}
                    className="input col-span-2 sm:col-span-1"
                    aria-label="Combatant name"
                />
                <div className="flex gap-1">
                    <input
                        value={initiative}
                        onChange={(event) => setInitiative(event.target.value.replace(/[^\d-]/g, '').slice(0, 3))}
                        placeholder="Init"
                        inputMode="numeric"
                        className="input"
                        aria-label="Initiative"
                    />
                    <button
                        type="button"
                        onClick={() => setInitiative(String(cryptoDie(20)))}
                        className="btn btn-outline px-2 normal-case"
                        title="Roll a d20 for initiative"
                        aria-label="Roll initiative"
                    >
                        d20
                    </button>
                </div>
                <input
                    value={maxHp}
                    onChange={(event) => setMaxHp(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                    placeholder="Max HP"
                    inputMode="numeric"
                    className="input"
                    aria-label="Max HP"
                />
                <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                    <label className="flex items-center gap-1.5 font-ui text-sm text-dust">
                        <input type="checkbox" checked={isNpc} onChange={(event) => setIsNpc(event.target.checked)} className="accent-blood" />
                        NPC
                    </label>
                    <button className="btn btn-primary ml-auto">Add</button>
                </div>
            </form>
            {error && (
                <p role="alert" className="mt-2 font-ui text-sm text-[#ff4d4d]">
                    {error}
                </p>
            )}
        </section>
    )
}
