// Integration tests for the row level security policies.
// Needs a local Supabase stack: `supabase start`, then `npm run test:integration`.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../src/lib/supabase/database.types'

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''

async function newPlayer(name: string) {
    const client = createClient<Database>(url, key, { auth: { persistSession: false } })
    const email = `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`
    const { data, error } = await client.auth.signUp({
        email,
        password: 'correct-horse-battery',
        options: { data: { display_name: name } },
    })
    if (error || !data.user) throw error ?? new Error('sign up failed')
    return { client, id: data.user.id }
}

describe.skipIf(!key)('row level security', () => {
    let dm: { client: SupabaseClient<Database>; id: string }
    let player: { client: SupabaseClient<Database>; id: string }
    let outsider: { client: SupabaseClient<Database>; id: string }
    let campaignId: string
    let inviteCode: string

    beforeAll(async () => {
        ;[dm, player, outsider] = await Promise.all([newPlayer('Dm'), newPlayer('Player'), newPlayer('Outsider')])
        const { data, error } = await dm.client
            .from('campaigns')
            .insert({ name: 'Test campaign', owner_id: dm.id })
            .select('id, invite_code')
            .single()
        if (error) throw error
        campaignId = data.id
        inviteCode = data.invite_code
    })

    it('makes the creator the DM', async () => {
        const { data } = await dm.client.from('campaign_members').select('role').eq('campaign_id', campaignId).single()
        expect(data?.role).toBe('dm')
    })

    it('hides the campaign from people who are not members', async () => {
        const { data } = await outsider.client.from('campaigns').select('id').eq('id', campaignId)
        expect(data).toEqual([])
    })

    it('rejects a wrong invite code and accepts the right one', async () => {
        const wrong = await player.client.rpc('join_campaign', { code: 'NOPE00' })
        expect(wrong.error?.message).toContain('invalid invite code')

        const right = await player.client.rpc('join_campaign', { code: inviteCode.toLowerCase(), character_name: 'Thalia' })
        expect(right.data).toBe(campaignId)

        const { data } = await player.client.from('campaigns').select('name').eq('id', campaignId).single()
        expect(data?.name).toBe('Test campaign')
    })

    it('lets members see rolls but not post them as someone else', async () => {
        const roll = { campaign_id: campaignId, roller_name: 'Thalia', expression: 'd20', detail: [], total: 12 }

        const own = await player.client.from('dice_rolls').insert({ ...roll, user_id: player.id })
        expect(own.error).toBeNull()

        const forged = await player.client.from('dice_rolls').insert({ ...roll, user_id: dm.id })
        expect(forged.error).not.toBeNull()

        const { data } = await dm.client.from('dice_rolls').select('total').eq('campaign_id', campaignId)
        expect(data).toEqual([{ total: 12 }])
    })

    it('keeps outsiders out of rolls and combat', async () => {
        const rolls = await outsider.client.from('dice_rolls').select('id').eq('campaign_id', campaignId)
        expect(rolls.data).toEqual([])

        const combatant = await outsider.client.from('combatants').insert({ campaign_id: campaignId, name: 'Intruder' })
        expect(combatant.error).not.toBeNull()
    })

    it('only lets the owner delete the campaign', async () => {
        await player.client.from('campaigns').delete().eq('id', campaignId)
        const stillThere = await dm.client.from('campaigns').select('id').eq('id', campaignId)
        expect(stillThere.data).toHaveLength(1)

        await dm.client.from('campaigns').delete().eq('id', campaignId)
        const gone = await dm.client.from('campaigns').select('id').eq('id', campaignId)
        expect(gone.data).toEqual([])
    })
})
