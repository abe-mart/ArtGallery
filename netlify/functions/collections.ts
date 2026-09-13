import { verifyAdminAuth, getDbOrSeed, saveDb, getSettings, hasGalleryAccess } from './_utils';

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') return new Response(null);

    const isAdmin = await verifyAdminAuth(req.headers);
    if (req.method !== 'GET' && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (req.method === 'POST') {
        try {
            const body = await req.json();
            const name = body.name;
            if (!name) return new Response('Name required', { status: 400 });

            const db = await getDbOrSeed();

            const newCollection = {
                id: Date.now(),
                name,
                slug: name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, ''),
            };

            db.collections.push(newCollection);
            await saveDb(db);

            return new Response(JSON.stringify(newCollection), { headers: { 'Content-Type': 'application/json' } });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to create collection';
            return new Response(JSON.stringify({ error: message }), { status: 500 });
        }
    }

    if (req.method === 'GET') {
        const settings = await getSettings();
        if (!(await hasGalleryAccess(req, settings))) {
            return new Response(JSON.stringify({ error: 'locked' }), { status: 401 });
        }
        const db = await getDbOrSeed();
        return new Response(JSON.stringify(db.collections), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Method not allowed', { status: 405 });
}
