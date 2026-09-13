/**
 * Mesh-based image warping for correcting curved/warped paper edges.
 * Takes control points along each edge and maps them to a straight rectangle.
 */

interface Point {
    x: number;
    y: number;
}

interface EdgePoints {
    top: Point[];     // Left to right
    right: Point[];   // Top to bottom
    bottom: Point[];  // Left to right  
    left: Point[];    // Top to bottom
}

/**
 * Apply mesh warp to straighten curved edges.
 * @param imageSrc Source image URL
 * @param edges Control points for each edge
 * @returns Dewarped image file
 */
export async function meshWarp(
    imageSrc: string,
    edges: EdgePoints
): Promise<File | null> {
    return new Promise((resolve) => {
        const img = new Image();
        // Only set crossOrigin for http(s) URLs, not blob URLs
        if (!imageSrc.startsWith('blob:')) {
            img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
            // Calculate output dimensions from edge lengths
            const topLen = pathLength(edges.top);
            const bottomLen = pathLength(edges.bottom);
            const leftLen = pathLength(edges.left);
            const rightLen = pathLength(edges.right);

            const outputWidth = Math.round((topLen + bottomLen) / 2);
            const outputHeight = Math.round((leftLen + rightLen) / 2);

            const canvas = document.createElement('canvas');
            canvas.width = outputWidth;
            canvas.height = outputHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(null);
                return;
            }

            // Create source canvas for pixel sampling
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = img.width;
            srcCanvas.height = img.height;
            const srcCtx = srcCanvas.getContext('2d');
            if (!srcCtx) {
                resolve(null);
                return;
            }
            srcCtx.drawImage(img, 0, 0);
            const srcData = srcCtx.getImageData(0, 0, img.width, img.height);

            // Create output image data
            const outData = ctx.createImageData(outputWidth, outputHeight);

            // For each output pixel, find corresponding source pixel using bilinear interpolation
            // between the edge curves
            for (let y = 0; y < outputHeight; y++) {
                for (let x = 0; x < outputWidth; x++) {
                    // Normalize coordinates to [0, 1]
                    const u = x / (outputWidth - 1);
                    const v = y / (outputHeight - 1);

                    // Get points along each edge at normalized position
                    const topPoint = interpolateAlongPath(edges.top, u);
                    const bottomPoint = interpolateAlongPath(edges.bottom, u);
                    const leftPoint = interpolateAlongPath(edges.left, v);
                    const rightPoint = interpolateAlongPath(edges.right, v);

                    // Bilinear interpolation between the four edges
                    // Horizontal interpolation for top and bottom
                    const horizTop = topPoint;
                    const horizBottom = bottomPoint;

                    // Vertical interpolation for left and right
                    const vertLeft = leftPoint;
                    const vertRight = rightPoint;

                    // Combine using bilinear blend
                    // Standard bilinear: lerp between (top-bottom lerp) and (left-right lerp)
                    const srcX = bilinearBlend(
                        horizTop.x, horizBottom.x,
                        vertLeft.x, vertRight.x,
                        u, v
                    );
                    const srcY = bilinearBlend(
                        horizTop.y, horizBottom.y,
                        vertLeft.y, vertRight.y,
                        u, v
                    );

                    // Sample source image
                    if (srcX >= 0 && srcX < img.width - 1 && srcY >= 0 && srcY < img.height - 1) {
                        const color = sampleBilinear(srcData, srcX, srcY, img.width);
                        const idx = (y * outputWidth + x) * 4;
                        outData.data[idx] = color.r;
                        outData.data[idx + 1] = color.g;
                        outData.data[idx + 2] = color.b;
                        outData.data[idx + 3] = 255;
                    }
                }
            }

            ctx.putImageData(outData, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(new File([blob], 'dewarped.jpg', { type: 'image/jpeg' }));
                } else {
                    resolve(null);
                }
            }, 'image/jpeg', 0.95);
        };
        img.onerror = () => resolve(null);
        img.src = imageSrc;
    });
}

/**
 * Calculate total length of a path of points
 */
function pathLength(points: Point[]): number {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
        len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return len;
}

/**
 * Get a point along a path at normalized position t (0-1)
 */
function interpolateAlongPath(points: Point[], t: number): Point {
    if (points.length < 2) return points[0] || { x: 0, y: 0 };
    if (t <= 0) return points[0];
    if (t >= 1) return points[points.length - 1];

    const totalLen = pathLength(points);
    const targetLen = t * totalLen;

    let accumulated = 0;
    for (let i = 1; i < points.length; i++) {
        const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        if (accumulated + segLen >= targetLen) {
            // Interpolate within this segment
            const segT = (targetLen - accumulated) / segLen;
            return {
                x: points[i - 1].x + segT * (points[i].x - points[i - 1].x),
                y: points[i - 1].y + segT * (points[i].y - points[i - 1].y)
            };
        }
        accumulated += segLen;
    }

    return points[points.length - 1];
}

/**
 * Bilinear blend for mesh warping
 * Combines horizontal (top-bottom) and vertical (left-right) interpolations
 */
function bilinearBlend(
    topVal: number, bottomVal: number,
    leftVal: number, rightVal: number,
    u: number, v: number
): number {
    // Horizontal interpolation along top and bottom edges
    const hBlend = (1 - v) * topVal + v * bottomVal;
    // Vertical interpolation along left and right edges  
    const vBlend = (1 - u) * leftVal + u * rightVal;
    // Average the two approaches for smoother result
    return (hBlend + vBlend) / 2;
}

/**
 * Bilinear sampling from image data
 */
function sampleBilinear(
    data: ImageData,
    x: number, y: number,
    width: number
): { r: number; g: number; b: number } {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, data.height - 1);
    const xf = x - x0;
    const yf = y - y0;

    const getPixel = (px: number, py: number) => {
        const idx = (py * width + px) * 4;
        return { r: data.data[idx], g: data.data[idx + 1], b: data.data[idx + 2] };
    };

    const p00 = getPixel(x0, y0);
    const p10 = getPixel(x1, y0);
    const p01 = getPixel(x0, y1);
    const p11 = getPixel(x1, y1);

    return {
        r: Math.round((1 - xf) * (1 - yf) * p00.r + xf * (1 - yf) * p10.r + (1 - xf) * yf * p01.r + xf * yf * p11.r),
        g: Math.round((1 - xf) * (1 - yf) * p00.g + xf * (1 - yf) * p10.g + (1 - xf) * yf * p01.g + xf * yf * p11.g),
        b: Math.round((1 - xf) * (1 - yf) * p00.b + xf * (1 - yf) * p10.b + (1 - xf) * yf * p01.b + xf * yf * p11.b)
    };
}

export default meshWarp;
