import { imageStore, getSettings, hasGalleryAccess, isBlockedBot, tdmHeaders } from './_utils';

export default async function handler(req: Request) {
    const url = new URL(req.url);
    const name = url.searchParams.get('name');

    if (!name) return new Response('Missing name', { status: 400 });

    const settings = await getSettings();

    if (settings.blockAiBots && isBlockedBot(req.headers.get('user-agent'))) {
        return new Response('Forbidden', { status: 403 });
    }

    if (!(await hasGalleryAccess(req, settings))) {
        return new Response('Locked', { status: 401 });
    }

    const store = imageStore();
    const blob = await store.get(name, { type: 'blob' });

    if (!blob) return new Response('Not found', { status: 404 });

    return new Response(blob, {
        headers: {
            'Content-Type': blob.type || 'image/webp',
            'Cache-Control': 'private, max-age=31536000, immutable',
            'Referrer-Policy': 'same-origin',
            ...tdmHeaders(settings.blockAiBots),
        },
    });
}
