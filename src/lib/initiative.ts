// Turn order helpers for the initiative tracker.

export type Combatant = {
    id: string
    name: string
    initiative: number
    hp: number
    max_hp: number
    is_npc: boolean
    created_at: string
}

export type TurnState = { activeId: string | null; round: number }

/** Highest initiative first; ties go to players, then to whoever was added first. */
export function sortByInitiative<T extends Combatant>(combatants: T[]): T[] {
    return [...combatants].sort(
        (a, b) =>
            b.initiative - a.initiative ||
            Number(a.is_npc) - Number(b.is_npc) ||
            a.created_at.localeCompare(b.created_at),
    )
}

/** Moves to the next combatant, starting a new round after the last one. */
export function nextTurn(combatants: Combatant[], state: TurnState): TurnState {
    const order = sortByInitiative(combatants)
    if (order.length === 0) return { activeId: null, round: state.round }

    const index = order.findIndex((combatant) => combatant.id === state.activeId)
    if (index === -1) return { activeId: order[0].id, round: state.round }
    if (index === order.length - 1) return { activeId: order[0].id, round: state.round + 1 }
    return { activeId: order[index + 1].id, round: state.round }
}

/** Moves back one combatant, never going below round 1. */
export function previousTurn(combatants: Combatant[], state: TurnState): TurnState {
    const order = sortByInitiative(combatants)
    if (order.length === 0) return { activeId: null, round: state.round }

    const index = order.findIndex((combatant) => combatant.id === state.activeId)
    if (index === -1) return { activeId: order[0].id, round: state.round }
    if (index === 0) {
        if (state.round === 1) return state
        return { activeId: order[order.length - 1].id, round: state.round - 1 }
    }
    return { activeId: order[index - 1].id, round: state.round }
}

/** Applies damage (positive) or healing (negative), clamped between 0 and max HP. */
export function applyHpChange(combatant: Pick<Combatant, 'hp' | 'max_hp'>, damage: number): number {
    const next = combatant.hp - damage
    const ceiling = combatant.max_hp > 0 ? combatant.max_hp : Number.POSITIVE_INFINITY
    return Math.max(0, Math.min(ceiling, next))
}

export function hpStatus(combatant: Pick<Combatant, 'hp' | 'max_hp'>): 'healthy' | 'bloodied' | 'down' | 'unknown' {
    if (combatant.max_hp <= 0) return 'unknown'
    if (combatant.hp <= 0) return 'down'
    if (combatant.hp <= combatant.max_hp / 2) return 'bloodied'
    return 'healthy'
}
