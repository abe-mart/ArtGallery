/**
 * Applies white balance correction based on a reference point that should be white.
 * Samples a small area around the clicked point and adjusts colors to make it neutral.
 */

interface Point {
    x: number;
    y: number;
}

/**
 * Soft clip function to prevent harsh highlight blowout.
 * Uses a smooth rolloff curve that compresses values approaching 255.
 * Starts compression at 180 for more gradual highlight preservation.
 */
function softClip(value: number): number {
    const kneeStart = 180;  // Start compression earlier
    const maxOut = 255;
    
    if (value <= kneeStart) {
        // Linear region - pass through unchanged
        return Math.round(value);
    } else {
        // Soft rolloff region using smooth shoulder curve
        // Maps kneeStart-infinity input to kneeStart-255 output
        const range = maxOut - kneeStart; // 75
        const excess = value - kneeStart;
        // Attempt to fit within the remaining headroom using logarithmic-style compression
        // This gives more gradual highlight rolloff
        const compressed = range * (1 - Math.exp(-excess / range));
        return Math.round(kneeStart + compressed);
    }
}

export async function applyWhiteBalance(
    imageSrc: string,
    referencePoint: Point,
    sampleRadius?: number
): Promise<File | null> {
    return new Promise((resolve) => {
        const img = new Image();
        // Only set crossOrigin for http(s) URLs, not blob URLs
        if (!imageSrc.startsWith('blob:')) {
            img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(null);
                return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;

            // Auto-calculate sample radius based on image size if not provided
            // Use ~0.5% of the smaller dimension, with min 5px and max 30px
            const autoRadius = Math.max(5, Math.min(30, Math.floor(Math.min(img.width, img.height) * 0.005)));
            const radius = sampleRadius ?? autoRadius;

            // Sample the reference area to get average RGB
            let sumR = 0, sumG = 0, sumB = 0, count = 0;

            // Clamp reference point to valid image coordinates
            const refX = Math.max(0, Math.min(img.width - 1, Math.round(referencePoint.x)));
            const refY = Math.max(0, Math.min(img.height - 1, Math.round(referencePoint.y)));

            const startX = Math.max(0, refX - radius);
            const endX = Math.min(img.width, refX + radius);
            const startY = Math.max(0, refY - radius);
            const endY = Math.min(img.height, refY + radius);

            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const idx = (y * img.width + x) * 4;
                    sumR += data[idx];
                    sumG += data[idx + 1];
                    sumB += data[idx + 2];
                    count++;
                }
            }

            if (count === 0) {
                resolve(null);
                return;
            }

            // Calculate average color of reference area
            const avgR = sumR / count;
            const avgG = sumG / count;
            const avgB = sumB / count;

            // Debugging info to help verify white balance sampling in the browser
            try {
                console.debug('WB sample avg', { 
                    avgR: Math.round(avgR), 
                    avgG: Math.round(avgG), 
                    avgB: Math.round(avgB), 
                    sampleRadius: radius, 
                    count,
                    refPoint: { x: refX, y: refY },
                    imageSize: { w: img.width, h: img.height }
                });
            } catch {
                // ignore
            }

            // Calculate correction factors to make this color the ideal paper tone
            // Target: warm cream paper (252, 248, 240) - matches illumination correction
            const targetPaper = { r: 252, g: 248, b: 240 };
            
            // Calculate how much we need to scale to make the reference point match ideal paper
            const avgBrightness = (avgR + avgG + avgB) / 3;
            
            // Avoid extreme corrections for very dark references (likely user clicked wrong spot)
            const minBrightness = 50;
            if (avgBrightness < minBrightness) {
                console.warn('WB: Reference point too dark, may not be white paper. Brightness:', avgBrightness);
            }
            
            // Calculate per-channel scales to make reference match ideal paper
            const safeAvgR = Math.max(avgR, minBrightness);
            const safeAvgG = Math.max(avgG, minBrightness);
            const safeAvgB = Math.max(avgB, minBrightness);
            
            const scaleR = targetPaper.r / safeAvgR;
            const scaleG = targetPaper.g / safeAvgG;
            const scaleB = targetPaper.b / safeAvgB;

            try {
                console.debug('WB scales', { 
                    scaleR: Number(scaleR.toFixed(3)), 
                    scaleG: Number(scaleG.toFixed(3)), 
                    scaleB: Number(scaleB.toFixed(3)), 
                    targetPaper,
                    avgBrightness: Math.round(avgBrightness)
                });
            } catch {
                // ignore
            }

            // Apply correction to all pixels with highlight protection
            for (let i = 0; i < data.length; i += 4) {
                data[i] = softClip(data[i] * scaleR);
                data[i + 1] = softClip(data[i + 1] * scaleG);
                data[i + 2] = softClip(data[i + 2] * scaleB);
                // Alpha stays the same
            }

            ctx.putImageData(imageData, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(new File([blob], 'white-balanced.jpg', { type: 'image/jpeg' }));
                } else {
                    resolve(null);
                }
            }, 'image/jpeg', 0.95);
        };
        img.onerror = () => resolve(null);
        img.src = imageSrc;
    });
}

export default applyWhiteBalance;
