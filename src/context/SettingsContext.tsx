import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { PublicSettings, DEFAULT_PUBLIC_SETTINGS } from '../types';
import { api } from '../lib/api';

interface SettingsContextValue {
    settings: PublicSettings;
    loading: boolean;
    refresh: () => Promise<void>;
    // Applies a change to the rest of the site (nav, hero text, etc.)
    // without a server round-trip - used by the live demo, where edits are
    // real within the tab but never saved.
    updateLocal: (partial: Partial<PublicSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
    settings: DEFAULT_PUBLIC_SETTINGS,
    loading: true,
    refresh: async () => {},
    updateLocal: () => {},
});

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        const data = await api.getSettings();
        setSettings(data);
        setLoading(false);
    }, []);

    const updateLocal = useCallback((partial: Partial<PublicSettings>) => {
        setSettings(prev => ({ ...prev, ...partial }));
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        document.title = settings.siteTitle;
    }, [settings.siteTitle]);

    return (
        <SettingsContext.Provider value={{ settings, loading, refresh, updateLocal }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
