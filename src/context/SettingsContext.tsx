import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { PublicSettings, DEFAULT_PUBLIC_SETTINGS } from '../types';
import { api } from '../lib/api';

interface SettingsContextValue {
    settings: PublicSettings;
    loading: boolean;
    refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
    settings: DEFAULT_PUBLIC_SETTINGS,
    loading: true,
    refresh: async () => {},
});

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        const data = await api.getSettings();
        setSettings(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        document.title = settings.siteTitle;
    }, [settings.siteTitle]);

    return (
        <SettingsContext.Provider value={{ settings, loading, refresh }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
