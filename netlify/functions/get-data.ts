import { getDb, getSettings, hasGalleryAccess, isBlockedBot, tdmHeaders } from './_utils';

export default async function handler(req: Request) {
    const settings = await getSettings();

    if (settings.blockAiBots && isBlockedBot(req.headers.get('user-agent'))) {
        return new Response('Forbidden', { status: 403 });
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
