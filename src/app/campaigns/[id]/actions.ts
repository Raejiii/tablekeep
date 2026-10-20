'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DiceError, roll } from '@/lib/dice'
import { requireUser } from '@/lib/supabase/server'

export type RollState = { error: string | null }

// Rolls happen on the server with crypto randomness, so nobody can fake a roll from the browser.
export async function rollDice(campaignId: string, expression: string): Promise<RollState> {
    const { supabase, userId } = await requireUser()

    let result
    try {
        result = roll(expression)
    } catch (error) {
        if (error instanceof DiceError) return { error: error.message }
        throw error
    }

    const [{ data: profile }, { data: member }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', userId).single(),
        supabase.from('campaign_members').select('character_name').eq('campaign_id', campaignId).eq('user_id', userId).single(),
    ])
    if (!member) return { error: "You're not in this campaign" }

    const { error } = await supabase.from('dice_rolls').insert({
        campaign_id: campaignId,
        user_id: userId,
        roller_name: member.character_name || profile?.display_name || 'Someone',
        expression: result.expression,
        detail: result.terms,
        total: result.total,
    })
    return { error: error?.message ?? null }
}

export async function createSession(campaignId: string, formData: FormData) {
    const { supabase, userId } = await requireUser()
    const title = String(formData.get('title') ?? '').trim() || 'Untitled session'

    const { data, error } = await supabase
        .from('sessions')
        .insert({ campaign_id: campaignId, title: title.slice(0, 80), created_by: userId })
        .select('id')
        .single()
    if (error) throw new Error(error.message)

    revalidatePath(`/campaigns/${campaignId}`)
    redirect(`/campaigns/${campaignId}/sessions/${data.id}`)
}
