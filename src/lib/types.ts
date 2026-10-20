import type { RolledTerm } from './dice'
import type { Tables } from './supabase/database.types'

export type Campaign = Tables<'campaigns'>
export type CombatantRow = Tables<'combatants'>
export type SessionRow = Tables<'sessions'>

// dice_rolls.detail is stored as JSON; this is the shape the roller writes
export type DiceRollRow = Omit<Tables<'dice_rolls'>, 'detail'> & { detail: RolledTerm[] }

export type Member = {
    user_id: string
    role: string
    character_name: string
    display_name: string
}
