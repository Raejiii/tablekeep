'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AuthState = { error: string | null }

// only allow redirects back into the app
function safeNext(value: FormDataEntryValue | null) {
    const next = typeof value === 'string' ? value : ''
    return next.startsWith('/') && !next.startsWith('//') ? next : '/campaigns'
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
        email: String(formData.get('email') ?? '').trim(),
        password: String(formData.get('password') ?? ''),
    })
    if (error) return { error: error.message }
    redirect(safeNext(formData.get('next')))
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
    const displayName = String(formData.get('displayName') ?? '').trim()
    if (displayName.length < 1 || displayName.length > 40) {
        return { error: 'Choose a display name between 1 and 40 characters' }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
        email: String(formData.get('email') ?? '').trim(),
        password: String(formData.get('password') ?? ''),
        options: { data: { display_name: displayName } },
    })
    if (error) return { error: error.message }
    if (!data.session) return { error: 'Check your inbox to confirm your email, then sign in.' }
    redirect(safeNext(formData.get('next')))
}

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
}
