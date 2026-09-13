import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { PublicSettings, DEFAULT_PUBLIC_SETTINGS } from '../types';
import { useSettings } from '../context/SettingsContext';
import Tooltip from '../components/Tooltip';

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
        <label className="block text-xs uppercase tracking-widest text-stone mb-2">
            {label}
            {hint && <Tooltip text={hint} />}
        </label>
        {children}
    </div>
);

const inputClass = "w-full bg-[#faf9f7] border border-stone/20 p-3 rounded-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20";

const AdminSettings = ({ token, onImported }: { token: string; onImported: () => void }) => {
    const { refresh: refreshGlobalSettings, updateLocal } = useSettings();
    const [form, setForm] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const [pin, setPin] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [pinMessage, setPinMessage] = useState('');

    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [backupMessage, setBackupMessage] = useState('');

    useEffect(() => {
        api.getSettings().then(data => {
            setForm(data);
            setLoading(false);
        });
    }, []);

    const update = <K extends keyof PublicSettings>(key: K, value: PublicSettings[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');

        // Live demo: the fields are already editable and visually "stick"
        // (they're just component state) - simulate a successful save
        // without touching the server, which refuses writes here anyway.
        if (form.demoMode) {
            updateLocal(form);
            setMessage("Saved! This is a live demo, so it's only visible in this tab and won't persist.");
            setSaving(false);
            return;
        }

        try {
            const saved = await api.updateSettings({
                siteTitle: form.siteTitle,
                artistName: form.artistName,
                subtitle: form.subtitle,
                copyrightName: form.copyrightName,
                heroHeadline: form.heroHeadline,
                heroSubtext: form.heroSubtext,
                quoteText: form.quoteText,
                aboutHeadline: form.aboutHeadline,
                aboutQuote: form.aboutQuote,
                aboutText: form.aboutText,
                galleryIntro: form.galleryIntro,
                blockAiBots: form.blockAiBots,
            }, token);
            setForm(saved);
            await refreshGlobalSettings();
            setMessage('Settings saved!');
        } catch (err: unknown) {
            setMessage(err instanceof Error ? `Error: ${err.message}` : 'Failed to save settings');
        }
        setSaving(false);
    };

    const handleSetPin = async () => {
        setPinMessage('');
        if (pin.length < 4) {
            setPinMessage('PIN must be at least 4 characters.');
            return;
        }
        if (pin !== pinConfirm) {
            setPinMessage('PINs do not match.');
            return;
        }

        if (form.demoMode) {
            setForm(prev => ({ ...prev, pinEnabled: true }));
            updateLocal({ pinEnabled: true });
            setPin('');
            setPinConfirm('');
            setPinMessage("PIN set! This is a live demo, so it's only visible in this tab and won't persist. (The demo gallery itself never actually locks.)");
            return;
        }

        try {
            const saved = await api.updateSettings({ pin }, token);
            setForm(saved);
            await refreshGlobalSettings();
            setPin('');
            setPinConfirm('');
            setPinMessage('PIN set! Viewers now need it to see the gallery.');
        } catch (err: unknown) {
            setPinMessage(err instanceof Error ? err.message : 'Failed to set PIN');
        }
    };

    const handleTogglePin = async (enabled: boolean) => {
        setPinMessage('');

        if (form.demoMode) {
            setForm(prev => ({ ...prev, pinEnabled: enabled }));
            updateLocal({ pinEnabled: enabled });
            return;
        }

        try {
            const saved = await api.updateSettings({ pinEnabled: enabled }, token);
            setForm(saved);
            await refreshGlobalSettings();
        } catch (err: unknown) {
            setPinMessage(err instanceof Error ? err.message : 'Failed to update PIN gate');
        }
    };

    const handleClearPin = async () => {
        if (!confirm('Remove the PIN entirely? The gallery will become publicly viewable.')) return;
        setPinMessage('');

        if (form.demoMode) {
            setForm(prev => ({ ...prev, pinEnabled: false }));
            updateLocal({ pinEnabled: false });
            setPinMessage("PIN removed. This is a live demo, so it's only visible in this tab and won't persist.");
            return;
        }

        try {
            const saved = await api.updateSettings({ clearPin: true }, token);
            setForm(saved);
            await refreshGlobalSettings();
            setPinMessage('PIN removed.');
        } catch (err: unknown) {
            setPinMessage(err instanceof Error ? err.message : 'Failed to remove PIN');
        }
    };

    const handleExport = async () => {
        setExporting(true);
        setBackupMessage('');
        try {
            const blob = await api.exportGallery(token);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `gallery-backup-${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setBackupMessage(err instanceof Error ? `Error: ${err.message}` : 'Failed to export gallery');
        }
        setExporting(false);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file later
        if (!file) return;

        if (!confirm('This replaces everything currently in your gallery - all paintings, collections, and settings - with what\'s in this backup file. This can\'t be undone. Continue?')) {
            return;
        }

        setImporting(true);
        setBackupMessage('');
        try {
            const result = await api.importGallery(file, token);
            setBackupMessage(`Imported ${result.paintings} painting${result.paintings === 1 ? '' : 's'} and ${result.images} image${result.images === 1 ? '' : 's'}.`);
            onImported();
            const updated = await api.getSettings();
            setForm(updated);
            await refreshGlobalSettings();
        } catch (err: unknown) {
            setBackupMessage(err instanceof Error ? `Error: ${err.message}` : 'Failed to import backup');
        }
        setImporting(false);
    };

    if (loading) {
        return <div className="text-center py-20 text-stone">Loading settings...</div>;
    }

    return (
        <div className="space-y-12">
            {/* Branding */}
            <section className="bg-white p-8 shadow-lg border border-stone/10 rounded-sm">
                <h2 className="text-xl font-serif mb-6">Site & Branding</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Browser Tab Title">
                        <input className={inputClass} value={form.siteTitle} onChange={e => update('siteTitle', e.target.value)} />
                    </Field>
                    <Field label="Artist / Site Name">
                        <input className={inputClass} value={form.artistName} onChange={e => update('artistName', e.target.value)} />
                    </Field>
                    <Field label="Subtitle (under your name in the nav)">
                        <input className={inputClass} value={form.subtitle} onChange={e => update('subtitle', e.target.value)} />
                    </Field>
                    <Field label="Copyright Line (footer)">
                        <input className={inputClass} value={form.copyrightName} onChange={e => update('copyrightName', e.target.value)} />
                    </Field>
                </div>
            </section>

            {/* Homepage / About text */}
            <section className="bg-white p-8 shadow-lg border border-stone/10 rounded-sm">
                <h2 className="text-xl font-serif mb-6">Homepage & About Page</h2>
                <div className="grid grid-cols-1 gap-6">
                    <Field label="Hero Headline" hint="The large heading on your homepage.">
                        <input className={inputClass} value={form.heroHeadline} onChange={e => update('heroHeadline', e.target.value)} />
                    </Field>
                    <Field label="Hero Subtext" hint="A short line under the homepage headline.">
                        <input className={inputClass} value={form.heroSubtext} onChange={e => update('heroSubtext', e.target.value)} />
                    </Field>
                    <Field label="Featured Quote" hint="A larger quote shown further down your homepage.">
                        <input className={inputClass} value={form.quoteText} onChange={e => update('quoteText', e.target.value)} />
                    </Field>
                    <Field label="Gallery Wall Intro Text" hint="The short paragraph next to 'The Collection' on your gallery page.">
                        <textarea className={inputClass} rows={2} value={form.galleryIntro} onChange={e => update('galleryIntro', e.target.value)} />
                    </Field>
                    <Field label="About Page Headline">
                        <input className={inputClass} value={form.aboutHeadline} onChange={e => update('aboutHeadline', e.target.value)} />
                    </Field>
                    <Field label="About Page Quote (optional)">
                        <input className={inputClass} value={form.aboutQuote} onChange={e => update('aboutQuote', e.target.value)} />
                    </Field>
                    <Field label="About Page Text (blank line = new paragraph)">
                        <textarea className={inputClass} rows={6} value={form.aboutText} onChange={e => update('aboutText', e.target.value)} />
                    </Field>
                </div>
            </section>

            {/* Toggles */}
            <section className="bg-white p-8 shadow-lg border border-stone/10 rounded-sm space-y-4">
                <h2 className="text-xl font-serif mb-2">Options</h2>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.blockAiBots} onChange={e => update('blockAiBots', e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm">
                        Block known AI-training bots
                        <Tooltip text="Refuses requests from crawlers like GPTBot and CCBot, and publishes a robots.txt asking them not to scrape your art. On by default; most people should leave this on." />
                    </span>
                </label>
            </section>

            <div className="flex items-center gap-4">
                <Button onClick={handleSave} disabled={saving} className="bg-charcoal text-white hover:bg-stone min-w-[150px]">
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
                {message && <p className={`text-sm ${message.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{message}</p>}
            </div>

            {/* PIN gate */}
            <section className="bg-white p-8 shadow-lg border border-stone/10 rounded-sm space-y-6">
                <div>
                    <h2 className="text-xl font-serif mb-1">Private Gallery (PIN)</h2>
                    <p className="text-sm text-stone">
                        When turned on, visitors must enter a PIN before they can see any paintings or images.
                        {form.pinEnabled && <span className="text-green-700 font-medium"> Currently ON.</span>}
                    </p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.pinEnabled}
                        onChange={e => handleTogglePin(e.target.checked)}
                        className="w-4 h-4"
                    />
                    <span className="text-sm">Require a PIN to view the gallery</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                    <Field label="New PIN">
                        <input type="password" className={inputClass} value={pin} onChange={e => setPin(e.target.value)} placeholder="e.g. 4821" />
                    </Field>
                    <Field label="Confirm PIN">
                        <input type="password" className={inputClass} value={pinConfirm} onChange={e => setPinConfirm(e.target.value)} />
                    </Field>
                </div>
                <div className="flex items-center gap-4">
                    <Button type="button" variant="outline" onClick={handleSetPin} disabled={!pin}>
                        {form.pinEnabled ? 'Change PIN' : 'Set PIN & Enable'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={handleClearPin} className="text-red-600 hover:text-red-700">
                        Remove PIN
                    </Button>
                </div>
                {pinMessage && <p className="text-sm text-stone">{pinMessage}</p>}
                <p className="text-xs text-stone/70">
                    Changing or removing the PIN immediately signs out every visitor who had unlocked the gallery.
                    Your own admin login always has access, so you can't lock yourself out.
                </p>
            </section>

            {/* Backup */}
            <section className="bg-white p-8 shadow-lg border border-stone/10 rounded-sm space-y-6">
                <div>
                    <h2 className="text-xl font-serif mb-1">Backup</h2>
                    <p className="text-sm text-stone">
                        Download everything in your gallery - paintings, settings, and images - as one file.
                        Keep it somewhere safe, or use it to move your gallery to a new deployment.
                    </p>
                </div>

                {form.demoMode ? (
                    <p className="text-sm text-stone/70">
                        Not available on the live demo, since there's nothing real to back up here.
                    </p>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-4">
                            <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
                                {exporting ? 'Preparing...' : 'Export Gallery'}
                            </Button>

                            <label className="inline-block">
                                <span className={`inline-flex items-center px-4 py-2 text-sm border border-stone/30 rounded-sm cursor-pointer hover:bg-stone/5 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {importing ? 'Importing...' : 'Import Backup'}
                                </span>
                                <input type="file" accept=".zip" onChange={handleImport} disabled={importing} className="hidden" />
                            </label>
                        </div>

                        {backupMessage && (
                            <p className={`text-sm ${backupMessage.startsWith('Error') ? 'text-red-500' : 'text-stone'}`}>{backupMessage}</p>
                        )}
                        <p className="text-xs text-stone/70">
                            Importing a backup replaces everything currently in your gallery - it's meant for restoring a
                            backup or moving to a new site, not merging in extra paintings.
                        </p>
                    </>
                )}
            </section>
        </div>
    );
};

export default AdminSettings;
