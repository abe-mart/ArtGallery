import { getSettings, verifyPin, createViewerCookie, checkRateLimit, recordFailedAttempt, clearAttempts } from './_utils';

// Verifies a visitor-facing PIN (distinct from the admin password) and, on
// success, sets a long-lived viewer cookie so the gallery unlocks.
export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const rateLimit = await checkRateLimit(req, 'unlock');
    if (!rateLimit.allowed) {
        return new Response(JSON.stringify({ error: 'Too many attempts. Please try again later.' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await req.json();
        const pin = typeof body.pin === 'string' ? body.pin : '';
        const settings = await getSettings();

        if (!settings.pinEnabled) {
            return new Response(JSON.stringify({ error: 'A PIN is not required for this gallery.' }), { status: 400 });
        }
        if (!settings.pinHash || !settings.pinSalt) {
            return new Response(JSON.stringify({ error: 'PIN is not configured correctly.' }), { status: 500 });
        }

        if (verifyPin(pin, settings.pinHash, settings.pinSalt)) {
            await clearAttempts(req, 'unlock');
            const cookie = await createViewerCookie(settings.pinVersion);
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie },
            });
        } else {
            await recordFailedAttempt(req, 'unlock');
            return new Response(JSON.stringify({ error: 'Incorrect PIN' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    } catch {
        return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 });
    }
}
