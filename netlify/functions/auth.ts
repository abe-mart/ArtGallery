import { createAdminToken, verifyPassword, createViewerCookie, getSettings, checkRateLimit, recordFailedAttempt, clearAttempts } from './_utils';

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const rateLimit = await checkRateLimit(req, 'login');
    if (!rateLimit.allowed) {
        return new Response(JSON.stringify({ error: 'Too many attempts. Please try again later.' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await req.json();
        const password = typeof body.password === 'string' ? body.password : '';
        const expected = process.env.ADMIN_PASSWORD;

        if (!expected) {
            console.error('ADMIN_PASSWORD is not set - admin login is disabled until it is configured.');
            return new Response(JSON.stringify({ error: 'Admin login is not configured yet.' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (verifyPassword(password, expected)) {
            await clearAttempts(req, 'login');
            const token = await createAdminToken();
            // Admins also get a viewer cookie, so a PIN gate (if enabled)
            // doesn't block them from previewing images in the admin panel.
            const settings = await getSettings();
            const viewerCookie = await createViewerCookie(settings.pinVersion);
            return new Response(JSON.stringify({ token }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': viewerCookie,
                },
            });
        } else {
            await recordFailedAttempt(req, 'login');
            return new Response(JSON.stringify({ error: 'Invalid password' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    } catch {
        return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 });
    }
}
