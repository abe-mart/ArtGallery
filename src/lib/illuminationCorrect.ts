/**
 * Corrects uneven illumination AND white balance by sampling paper at multiple points.
 * This evens out shadows, lighting gradients, and color casts in a single pass,
 * which gives better results than applying them separately.
 */

interface Point {
    x: number;
    y: number;
}

interface ColorSample {
    r: number;
    g: number;
    b: number;
    brightness: number;
}

/**
 * Soft clip to prevent highlight blowout.
 * Uses exponential rolloff starting at 180 for gradual compression.
 */
function softClip(value: number): number {
    const kneeStart = 180;
    const maxOut = 255;
    
    if (value <= kneeStart) {
        return Math.round(value);
    } else {
        const range = maxOut - kneeStart; // 75
        const excess = value - kneeStart;
        const compressed = range * (1 - Math.exp(-excess / range));
        return Math.round(kneeStart + compressed);
    }
}

/**
 * Calculate saturation (0-1) from RGB values.
 * Higher saturation = more colorful = likely paint
 * Lower saturation = more neutral = likely paper
 */
function getSaturation(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0) return 0;
    return (max - min) / max;
}

/**
 * Apply saturation-aware correction.
 * Paper (low saturation) gets full correction.
 * Paint (high saturation) gets minimal correction to preserve color and detail.
 */
function applySaturationAwareCorrection(
    r: number, g: number, b: number,
    corrR: number, corrG: number, corrB: number
): { r: number, g: number, b: number } {
    // Get saturation of original pixel
    const saturation = getSaturation(r, g, b);
    
    // Paper typically has saturation < 0.15 (can have slight tints from lighting)
    // Light washes might be 0.15-0.35
    // Saturated paint is > 0.35
    // 
    // Be more generous with what counts as "paper" to avoid gradients
    const satThreshold = 0.25; // Midpoint (raised from 0.15)
    const satRange = 0.15;     // Transition range
    
    let correctionStrength: number;
    if (saturation <= satThreshold - satRange) {
        // Definitely paper - full correction
        correctionStrength = 1.0;
    } else if (saturation >= satThreshold + satRange) {
        // Definitely paint - minimal correction (but not zero, to avoid harsh edges)
        correctionStrength = 0.15;
    } else {
        // Smooth transition using cosine interpolation
        const t = (saturation - (satThreshold - satRange)) / (satRange * 2);
        correctionStrength = 0.15 + 0.85 * (0.5 * (1 + Math.cos(Math.PI * t)));
    }
    
    // Blend between corrected and original based on correction strength
    const correctedR = softClip(r * corrR);
    const correctedG = softClip(g * corrG);
    const correctedB = softClip(b * corrB);
    
    return {
        r: Math.round(r + (correctedR - r) * correctionStrength),
        g: Math.round(g + (correctedG - g) * correctionStrength),
        b: Math.round(b + (correctedB - b) * correctionStrength)
    };
}

/**
 * Sample the average color and brightness in a region around a point
 */
function sampleColor(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    point: Point,
    radius: number = 15
): ColorSample {
    let sumR = 0, sumG = 0, sumB = 0;
    let count = 0;

    const startX = Math.max(0, Math.floor(point.x - radius));
    const endX = Math.min(width, Math.ceil(point.x + radius));
    const startY = Math.max(0, Math.floor(point.y - radius));
    const endY = Math.min(height, Math.ceil(point.y + radius));

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const idx = (y * width + x) * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            count++;
        }
    }

    if (count === 0) {
        return { r: 255, g: 255, b: 255, brightness: 255 };
    }

    const r = sumR / count;
    const g = sumG / count;
    const b = sumB / count;
    // Luminance formula for perceived brightness
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    return { r, g, b, brightness };
}

/**
 * Bilinear interpolation between four corner values
 */
function bilinearInterpolate(
    topLeft: number,
    topRight: number,
    bottomLeft: number,
    bottomRight: number,
    u: number, // 0-1 horizontal position
    v: number  // 0-1 vertical position
): number {
    const top = topLeft + (topRight - topLeft) * u;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * u;
    return top + (bottom - top) * v;
}

/**
 * Apply illumination and white balance correction to even out lighting and color.
 * @param imageSrc Source image URL
 * @param samplePoints 4 points on the paper (corners) to sample from
 *                     Order: [topLeft, topRight, bottomRight, bottomLeft]
 * @returns Corrected image file
 */
export async function illuminationCorrect(
    imageSrc: string,
    samplePoints: Point[]
): Promise<File | null> {
    if (samplePoints.length !== 4) {
        console.error('illuminationCorrect requires exactly 4 sample points');
        return null;
    }

    return new Promise((resolve) => {
        const img = new Image();
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

            // Sample color and brightness at each corner point
            const samples = samplePoints.map(p => 
                sampleColor(data, img.width, img.height, p)
            );

            // Ideal watercolor paper color - warm cream tone
            // This ensures consistency across all images in the gallery
            const idealPaper = { r: 252, g: 248, b: 240 };
            
            const minSample = 30; // Prevent extreme corrections

            // Calculate per-channel correction factors for each corner
            // Each corner gets corrected to make its paper match the ideal
            const corrections = samples.map(s => ({
                r: idealPaper.r / Math.max(s.r, minSample),
                g: idealPaper.g / Math.max(s.g, minSample),
                b: idealPaper.b / Math.max(s.b, minSample)
            }));

            // Log for debugging
            console.debug('Paper samples:', samples.map((s, i) => ({
                corner: i,
                r: Math.round(s.r),
                g: Math.round(s.g),
                b: Math.round(s.b)
            })));
            console.debug('Target paper color:', idealPaper);
            console.debug('Correction factors:', corrections.map((c, i) => ({
                corner: i,
                r: c.r.toFixed(3),
                g: c.g.toFixed(3),
                b: c.b.toFixed(3)
            })));

            // Apply correction with bilinear interpolation
            for (let y = 0; y < img.height; y++) {
                for (let x = 0; x < img.width; x++) {
                    // Normalized position (0-1)
                    const u = x / (img.width - 1);
                    const v = y / (img.height - 1);

                    // Interpolate correction factors for this pixel (per channel)
                    const corrR = bilinearInterpolate(
                        corrections[0].r, corrections[1].r,
                        corrections[3].r, corrections[2].r,
                        u, v
                    );
                    const corrG = bilinearInterpolate(
                        corrections[0].g, corrections[1].g,
                        corrections[3].g, corrections[2].g,
                        u, v
                    );
                    const corrB = bilinearInterpolate(
                        corrections[0].b, corrections[1].b,
                        corrections[3].b, corrections[2].b,
                        u, v
                    );

                    const idx = (y * img.width + x) * 4;
                    // Use saturation-aware correction to preserve paint while correcting paper
                    const corrected = applySaturationAwareCorrection(
                        data[idx], data[idx + 1], data[idx + 2],
                        corrR, corrG, corrB
                    );
                    data[idx] = corrected.r;
                    data[idx + 1] = corrected.g;
                    data[idx + 2] = corrected.b;
                    // Alpha unchanged
                }
            }

            ctx.putImageData(imageData, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(new File([blob], 'corrected.jpg', { type: 'image/jpeg' }));
                } else {
                    resolve(null);
                }
            }, 'image/jpeg', 0.95);
        };
        img.onerror = () => resolve(null);
        img.src = imageSrc;
    });
}

export default illuminationCorrect;
