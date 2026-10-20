'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'

export type FormState = { error: string | null }

export async function createCampaign(_: FormState, formData: FormData): Promise<FormState> {
    const { supabase, userId } = await requireUser()
    const name = String(formData.get('name') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    if (!name) return { error: 'Give your campaign a name' }

    const { data, error } = await supabase
        .from('campaigns')
        .insert({ name: name.slice(0, 80), description: description.slice(0, 500), owner_id: userId })
        .select('id')
        .single()
    if (error) return { error: error.message }

    revalidatePath('/campaigns')
    redirect(`/campaigns/${data.id}`)
}

export async function joinCampaign(_: FormState, formData: FormData): Promise<FormState> {
    const { supabase } = await requireUser()
    const code = String(formData.get('code') ?? '').trim()
    const characterName = String(formData.get('characterName') ?? '').trim()
    if (!code) return { error: 'Enter the invite code your DM shared' }

    const { data, error } = await supabase.rpc('join_campaign', { code, character_name: characterName })
    if (error) {
        return { error: error.message.includes('invalid invite code') ? "That invite code doesn't match a campaign" : error.message }
    }

    revalidatePath('/campaigns')
    redirect(`/campaigns/${data}`)
}
