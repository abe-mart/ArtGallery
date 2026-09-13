import { getDb, getSettings, hasGalleryAccess, isBlockedBot, tdmHeaders, isDemoMode, DEMO_PAINTINGS } from './_utils';

export default async function handler(req: Request) {
    const settings = await getSettings();

    if (settings.blockAiBots && isBlockedBot(req.headers.get('user-agent'))) {
        return new Response('Forbidden', { status: 403 });
    }

    // Demo sites always show the same built-in paintings and are never
    // PIN-gated, regardless of what's saved in settings.
    if (isDemoMode()) {
        return new Response(JSON.stringify({ paintings: DEMO_PAINTINGS, collections: [] }), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
        });
    }

    if (!(await hasGalleryAccess(req, settings))) {
        return new Response(JSON.stringify({ error: 'locked' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const data = await getDb();
    if (!data) {
        return new Response('Not found', { status: 404 });
    }

    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
            ...tdmHeaders(settings.blockAiBots),
        },
    });
}
