import { verifyAdminAuth, getDbOrSeed, saveDb, imageStore, imageKeyFromUrl, isDemoMode, demoBlockedResponse } from './_utils';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

async function uploadImage(file: File): Promise<string> {
    if (file.size > MAX_IMAGE_BYTES) {
        throw new Error('Image is larger than 10MB. Please choose a smaller file.');
    }
    if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed.');
    }

    const store = imageStore();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '');
    const key = `${Date.now()}-${safeName}`;
    await store.set(key, file);
    return `/.netlify/functions/get-image?name=${key}`;
}

async function deleteImage(imageUrl: string | undefined) {
    const key = imageKeyFromUrl(imageUrl);
    if (!key) return;
    try {
        await imageStore().delete(key);
    } catch (e) {
        console.error('Failed to delete image blob:', key, e);
    }
}

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') return new Response(null);

    if (!(await verifyAdminAuth(req.headers))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    if (isDemoMode()) return demoBlockedResponse();

    const url = new URL(req.url);
    const idParam = url.searchParams.get('id');

    if (req.method === 'POST') {
        try {
            const formData = await req.formData();
            const image = formData.get('image') as File;

            if (!image) return new Response(JSON.stringify({ error: 'Image required' }), { status: 400 });

            const imageUrl = await uploadImage(image);

            const newPainting = {
                id: Date.now(),
                title: formData.get('title') as string,
                year: parseInt(formData.get('year') as string),
                width: parseFloat(formData.get('width') as string || '0'),
                height: parseFloat(formData.get('height') as string || '0'),
                pixelWidth: parseFloat(formData.get('pixelWidth') as string || '0'),
                pixelHeight: parseFloat(formData.get('pixelHeight') as string || '0'),
                description: formData.get('description') as string || '',
                price: formData.get('price') ? parseFloat(formData.get('price') as string) : null,
                isAvailable: formData.get('isAvailable') === 'true',
                collectionId: formData.get('collectionId') ? parseInt(formData.get('collectionId') as string) : null,
                imageUrl: imageUrl,
                createdAt: new Date().toISOString(),
            };

            const db = await getDbOrSeed();

            db.paintings.push(newPainting);
            await saveDb(db);

            return new Response(JSON.stringify(newPainting), { headers: { 'Content-Type': 'application/json' } });
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : 'Failed to create painting';
            return new Response(JSON.stringify({ error: message }), { status: 500 });
        }
    }

    if (req.method === 'PUT') {
        if (!idParam) return new Response('Missing ID', { status: 400 });
        try {
            const formData = await req.formData();
            const db = await getDbOrSeed();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const idx = db.paintings.findIndex((p: any) => p.id == idParam);
            if (idx === -1) return new Response('Painting not found', { status: 404 });

            const existing = db.paintings[idx];

            // Handle optional image replacement - delete the old blob so
            // replaced images don't pile up in storage.
            const image = formData.get('image') as File;
            let imageUrl = existing.imageUrl;
            if (image && image.size > 0) {
                imageUrl = await uploadImage(image);
                await deleteImage(existing.imageUrl);
            }

            const updated = {
                ...existing,
                title: formData.get('title') as string || existing.title,
                year: formData.has('year') ? parseInt(formData.get('year') as string) : existing.year,
                width: formData.has('width') ? parseFloat(formData.get('width') as string) : existing.width,
                height: formData.has('height') ? parseFloat(formData.get('height') as string) : existing.height,
                pixelWidth: formData.has('pixelWidth') ? parseFloat(formData.get('pixelWidth') as string) : existing.pixelWidth,
                pixelHeight: formData.has('pixelHeight') ? parseFloat(formData.get('pixelHeight') as string) : existing.pixelHeight,
                description: formData.get('description') !== null ? formData.get('description') as string : existing.description,
                price: formData.has('price') ? (formData.get('price') ? parseFloat(formData.get('price') as string) : null) : existing.price,
                isAvailable: formData.has('isAvailable') ? formData.get('isAvailable') === 'true' : existing.isAvailable,
                collectionId: formData.get('collectionId') ? parseInt(formData.get('collectionId') as string) : existing.collectionId,
                imageUrl: imageUrl,
                updatedAt: new Date().toISOString(),
            };

            db.paintings[idx] = updated;
            await saveDb(db);

            return new Response(JSON.stringify(updated), { headers: { 'Content-Type': 'application/json' } });
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : 'Failed to update painting';
            return new Response(JSON.stringify({ error: message }), { status: 500 });
        }
    }

    if (req.method === 'DELETE') {
        if (!idParam) return new Response('Missing ID', { status: 400 });
        const db = await getDbOrSeed();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const painting = db.paintings.find((p: any) => p.id == idParam);
        if (painting) await deleteImage(painting.imageUrl);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db.paintings = db.paintings.filter((p: any) => p.id != idParam);
        await saveDb(db);

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Method not allowed', { status: 405 });
}
