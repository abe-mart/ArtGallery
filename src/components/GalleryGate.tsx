import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, LockedError } from '../lib/api';
import PinScreen from './PinScreen';

// Wraps the whole app: if the owner has turned on a viewing PIN and this
// visitor hasn't unlocked it yet, shows a PIN screen instead of the
// gallery. The /admin route is exempt so the owner can always log in to
// change or disable the PIN even if they're locked out themselves -
// admin login also grants gallery access (see netlify/functions/auth.ts).
const GalleryGate = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith('/admin');
    const [status, setStatus] = useState<'checking' | 'locked' | 'unlocked'>(isAdminRoute ? 'unlocked' : 'checking');

    useEffect(() => {
        if (isAdminRoute) {
            setStatus('unlocked');
            return;
        }
        let cancelled = false;
        api.getPaintings()
            .then(() => { if (!cancelled) setStatus('unlocked'); })
            .catch((err) => {
                if (cancelled) return;
                setStatus(err instanceof LockedError ? 'locked' : 'unlocked');
            });
        return () => { cancelled = true; };
    }, [isAdminRoute]);

    if (status === 'checking') {
        return <div className="min-h-screen bg-paper" />;
    }

    if (status === 'locked') {
        return <PinScreen onUnlocked={() => setStatus('unlocked')} />;
    }

    return <>{children}</>;
};

export default GalleryGate;
