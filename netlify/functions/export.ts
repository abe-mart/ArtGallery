import JSZip from 'jszip';
import { verifyAdminAuth, getDbOrSeed, getSettings, imageStore, imageKeyFromUrl, isDemoMode } from './_utils';

// Downloads everything needed to restore this gallery elsewhere: the
// painting/collection data, your settings (including the PIN, if any),
// and every uploaded image - all as one .zip file.
export default async function handler(req: Request) {
    if (isDemoMode()) {
        return new Response(JSON.stringify({ error: 'Export is disabled for the live demo.' }), { status: 403 });
    }
    if (!(await verifyAdminAuth(req.headers))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const db = await getDbOrSeed();
    const settings = await getSettings();

    const zip = new JSZip();
    zip.file('data.json', JSON.stringify(db, null, 2));
    zip.file('settings.json', JSON.stringify(settings, null, 2));

    const store = imageStore();
    const imagesFolder = zip.folder('images');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const painting of db.paintings as any[]) {
        const key = imageKeyFromUrl(painting.imageUrl);
        if (!key) continue;
        try {
            const blob = await store.get(key, { type: 'blob' });
            if (blob) {
                imagesFolder?.file(key, await blob.arrayBuffer());
            }
        } catch (e) {
            console.error('Skipping image in export:', key, e);
        }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const filename = `gallery-backup-${new Date().toISOString().slice(0, 10)}.zip`;

    // Netlify's Node runtime accepts a Buffer as a Response body at runtime;
    // the cast just works around a TS lib type mismatch (Buffer vs BodyInit).
    return new Response(zipBuffer as unknown as BodyInit, {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
