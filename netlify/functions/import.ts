import JSZip from 'jszip';
import { verifyAdminAuth, saveDb, replaceSettings, imageStore, isDemoMode, demoBlockedResponse, DEFAULT_SETTINGS } from './_utils';

const MAX_BACKUP_BYTES = 25 * 1024 * 1024; // 25MB - see README for larger-gallery notes

// Restores a gallery from a .zip file produced by the Export button.
// This REPLACES all current paintings, collections, and settings - it's
// meant for restoring a backup or moving to a new deployment, not merging.
export default async function handler(req: Request) {
    if (!(await verifyAdminAuth(req.headers))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    if (isDemoMode()) return demoBlockedResponse();
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('backup') as File | null;
        if (!file) {
            return new Response(JSON.stringify({ error: 'No backup file provided.' }), { status: 400 });
        }
        if (file.size > MAX_BACKUP_BYTES) {
            return new Response(JSON.stringify({ error: 'That backup file is too large to import here (25MB limit).' }), { status: 400 });
        }

        const zip = await JSZip.loadAsync(await file.arrayBuffer());

        const dataEntry = zip.file('data.json');
        if (!dataEntry) {
            return new Response(JSON.stringify({ error: 'Not a valid gallery backup - missing data.json.' }), { status: 400 });
        }
        const data = JSON.parse(await dataEntry.async('string'));

        const settingsEntry = zip.file('settings.json');
        const settings = settingsEntry ? { ...DEFAULT_SETTINGS, ...JSON.parse(await settingsEntry.async('string')) } : null;

        // Restore every file under images/ using its original storage key,
        // so the imageUrl values already in data.json keep working.
        const store = imageStore();
        const imagePaths = Object.keys(zip.files).filter((path) => path.startsWith('images/') && !zip.files[path].dir);
        for (const path of imagePaths) {
            const key = path.slice('images/'.length);
            const content = await zip.files[path].async('nodebuffer');
            // Netlify Blobs accepts a Buffer at runtime; the cast works
            // around a TS lib type mismatch (Buffer vs BlobInput).
            await store.set(key, content as unknown as ArrayBuffer);
        }

        await saveDb(data);
        if (settings) await replaceSettings(settings);

        return new Response(JSON.stringify({
            success: true,
            paintings: Array.isArray(data.paintings) ? data.paintings.length : 0,
            images: imagePaths.length,
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e: unknown) {
        console.error('Import failed:', e);
        const message = e instanceof Error ? e.message : 'Failed to import backup';
        return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
}
