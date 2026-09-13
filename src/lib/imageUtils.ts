
// Converts an image to WebP, optionally downscaling it first. Capping the
// long edge (default 2400px) keeps uploads well under the 10MB function
// limit and means the file a scraper could copy is smaller and lower-res
// than a print-quality original - the real original never leaves the
// browser.
export async function convertImageToWebP(file: File | Blob, quality = 0.8, maxDimension = 2400): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (Math.max(width, height) > maxDimension) {
                const scale = maxDimension / Math.max(width, height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Conversion failed'));
            }, 'image/webp', quality);

            // Cleanup
            URL.revokeObjectURL(img.src);
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(img.src);
            reject(e);
        };
        img.src = URL.createObjectURL(file);
    });
}
