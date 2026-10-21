'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MAX_NOTES_CHARS } from '@/lib/recap'
import type { SessionRow } from '@/lib/types'

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'

export function SessionEditor({ session, recapEnabled }: { session: SessionRow; recapEnabled: boolean }) {
    const supabase = useMemo(() => createClient(), [])
    const [title, setTitle] = useState(session.title)
    const [playedOn, setPlayedOn] = useState(session.played_on)
    const [notes, setNotes] = useState(session.notes)
    const [saveState, setSaveState] = useState<SaveState>('saved')

    const [recap, setRecap] = useState(session.recap)
    const [generating, setGenerating] = useState(false)
    const [recapError, setRecapError] = useState<string | null>(null)
    const firstRender = useRef(true)

    // autosave a moment after typing stops
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false
            return
        }
        setSaveState('unsaved')
        const timer = setTimeout(async () => {
            setSaveState('saving')
            const { error } = await supabase
                .from('sessions')
                .update({
                    title: title.trim().slice(0, 80) || 'Untitled session',
                    played_on: playedOn,
                    notes,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', session.id)
            setSaveState(error ? 'error' : 'saved')
        }, 800)
        return () => clearTimeout(timer)
    }, [supabase, session.id, title, playedOn, notes])

    async function generateRecap() {
        setRecapError(null)
        setGenerating(true)
        setRecap('')
        try {
            const response = await fetch('/api/recap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: session.id }),
            })
            if (!response.ok || !response.body) {
                setRecapError(await response.text())
                setRecap(session.recap)
                return
            }
            // read the streamed recap as it's written
            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            for (;;) {
                const { done, value } = await reader.read()
                if (done) break
                setRecap((current) => current + decoder.decode(value, { stream: true }))
            }
        } catch {
            setRecapError('Could not reach the recap service.')
        } finally {
            setGenerating(false)
        }
    }

    const saveLabel = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved changes', error: "Couldn't save" }[saveState]

    return (
        <div className="mt-3 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <section className="panel flex flex-col p-5" aria-label="Session notes">
                <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={80}
                    aria-label="Session title"
                    className="w-full bg-transparent font-heading text-4xl font-bold text-white outline-none focus:underline focus:decoration-gold"
                />
                <div className="mt-2 flex flex-wrap items-center gap-3 font-ui text-sm text-dust">
                    <label className="flex items-center gap-2">
                        Played on
                        <input
                            type="date"
                            value={playedOn}
                            onChange={(event) => setPlayedOn(event.target.value)}
                            className="input w-auto py-1"
                        />
                    </label>
                    <span className={`ml-auto ${saveState === 'error' ? 'text-[#ff4d4d]' : ''}`} aria-live="polite">
                        {saveLabel}
                    </span>
                </div>
                <div className="taper my-3" />
                <label htmlFor="notes" className="label">
                    Notes
                </label>
                <textarea
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value.slice(0, MAX_NOTES_CHARS))}
                    rows={18}
                    placeholder={'- Arrived in Vallaki during the Feast of St. Andral\n- Met Ireena\'s brother Izek…\n- Found the stolen bones in the coffin maker\'s shop'}
                    className="input min-h-80 resize-y font-body text-base leading-relaxed"
                />
                <p className="mt-1 text-right font-ui text-xs text-dust">
                    {notes.length.toLocaleString()} / {MAX_NOTES_CHARS.toLocaleString()}
                </p>
            </section>

            <section className="panel flex flex-col p-5" aria-labelledby="recap-heading">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="recap-heading" className="panel-title">
                        Previously on…
                    </h2>
                    <button onClick={generateRecap} disabled={generating || !recapEnabled} className="btn btn-primary">
                        {generating ? 'Writing…' : recap ? 'Rewrite recap' : 'Generate recap'}
                    </button>
                </div>
                <div className="taper my-3" />
                {!recapEnabled && (
                    <p className="border-l-4 border-gold bg-gold/10 px-3 py-2 font-ui text-sm">
                        Recaps are switched off right now.
                    </p>
                )}
                {recapError && (
                    <p role="alert" className="border-l-4 border-blood bg-blood/10 px-3 py-2 font-ui text-sm">
                        {recapError}
                    </p>
                )}
                <div aria-live="polite" className="mt-2 whitespace-pre-wrap text-lg leading-relaxed">
                    {recap ? (
                        <>
                            {recap}
                            {generating && <span className="ml-0.5 inline-block w-2 animate-pulse bg-gold-light">&nbsp;</span>}
                        </>
                    ) : (
                        <p className="font-ui text-sm italic text-dust">
                            {generating ? 'Gathering the threads… this can take up to 30 seconds.' : 'Write your notes, then generate a recap to read out next session.'}
                        </p>
                    )}
                </div>
            </section>
        </div>
    )
}
