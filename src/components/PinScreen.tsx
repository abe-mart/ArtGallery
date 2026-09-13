import React, { useState } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { useSettings } from '../context/SettingsContext';

const PinScreen = ({ onUnlocked }: { onUnlocked: () => void }) => {
    const { settings } = useSettings();
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await api.unlock(pin);
            onUnlocked();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Incorrect PIN');
        }
        setSubmitting(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-paper px-4">
            <div className="max-w-sm w-full text-center">
                <h1 className="text-3xl font-serif text-charcoal mb-2">{settings.artistName}</h1>
                <p className="text-stone text-xs uppercase tracking-widest mb-10">{settings.subtitle}</p>
                <p className="text-stone mb-6">This gallery is private. Enter the PIN to view it.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        inputMode="numeric"
                        autoFocus
                        placeholder="PIN"
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        className="w-full text-center tracking-[0.5em] p-3 border border-stone/30 rounded focus:outline-none focus:ring-2 focus:ring-charcoal/50"
                    />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <Button type="submit" className="w-full" disabled={submitting || !pin}>
                        {submitting ? 'Checking...' : 'Enter'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default PinScreen;
