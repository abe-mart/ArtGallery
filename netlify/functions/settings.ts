import { getSettings, saveSettings, toPublicSettings, verifyAdminAuth, hashPin, isDemoMode, demoBlockedResponse } from './_utils';

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') return new Response(null);

    if (req.method === 'GET') {
        const settings = await getSettings();
        return new Response(JSON.stringify({ ...toPublicSettings(settings), demoMode: isDemoMode() }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
            },
        });
    }

    if (req.method === 'PUT') {
        if (!(await verifyAdminAuth(req.headers))) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
        if (isDemoMode()) return demoBlockedResponse();
        try {
            const body = await req.json();
            const current = await getSettings();

            const update: Record<string, unknown> = {};
            const stringFields = [
                'siteTitle', 'artistName', 'subtitle', 'copyrightName',
                'heroHeadline', 'heroSubtext', 'quoteText',
                'aboutHeadline', 'aboutQuote', 'aboutText', 'galleryIntro', 'contactEmail',
            ];
            for (const field of stringFields) {
                if (typeof body[field] === 'string') update[field] = body[field];
            }
            if (typeof body.showPrices === 'boolean') update.showPrices = body.showPrices;
            if (typeof body.blockAiBots === 'boolean') update.blockAiBots = body.blockAiBots;

            // PIN management: `pin: string` sets/changes it, `pinEnabled: false`
            // turns off the gate without touching the stored hash, and
            // `clearPin: true` removes it entirely.
            if (typeof body.pin === 'string' && body.pin.length > 0) {
                const { hash, salt } = hashPin(body.pin);
                update.pinHash = hash;
                update.pinSalt = salt;
                update.pinVersion = (current.pinVersion || 0) + 1; // logs out existing viewers
                update.pinEnabled = true;
            } else if (body.clearPin === true) {
                update.pinHash = undefined;
                update.pinSalt = undefined;
                update.pinEnabled = false;
                update.pinVersion = (current.pinVersion || 0) + 1;
            } else if (typeof body.pinEnabled === 'boolean') {
                if (body.pinEnabled && !current.pinHash) {
                    return new Response(JSON.stringify({ error: 'Set a PIN before enabling the PIN gate.' }), { status: 400 });
                }
                update.pinEnabled = body.pinEnabled;
            }

            const saved = await saveSettings(update);
            return new Response(JSON.stringify(toPublicSettings(saved)), {
                headers: { 'Content-Type': 'application/json' },
            });
        } catch {
            return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 });
        }
    }

    return new Response('Method not allowed', { status: 405 });
}
