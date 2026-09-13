/**
 * Applies perspective correction to an image given 4 source corner points.
 * Maps the quadrilateral defined by the corners to a rectangle (straightens AND crops).
 * The output is ONLY the selected area, transformed to be rectangular.
 */

interface Point {
    x: number;
    y: number;
}

export async function perspectiveCorrect(
    imageSrc: string,
    corners: Point[] // [topLeft, topRight, bottomRight, bottomLeft]
): Promise<File | null> {
    return new Promise((resolve) => {
        const img = new Image();
        // Only set crossOrigin for http(s) URLs, not blob URLs
        if (!imageSrc.startsWith('blob:')) {
            img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
            // Calculate output dimensions from the selected quadrilateral
            // Use the average of top/bottom edges for width, left/right edges for height
            const topWidth = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
            const bottomWidth = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
            const leftHeight = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
            const rightHeight = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

            const width = Math.round((topWidth + bottomWidth) / 2);
            const height = Math.round((leftHeight + rightHeight) / 2);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(null);
                return;
            }

            // Source points (the corners the user selected on the image)
            const srcPts = corners;
            // Destination points (output rectangle - the ONLY output area)
            const dstPts: Point[] = [
                { x: 0, y: 0 },
                { x: width, y: 0 },
                { x: width, y: height },
                { x: 0, y: height }
            ];

            // Calculate perspective transform coefficients (maps dst -> src for sampling)
            const coeffs = computePerspectiveCoeffs(srcPts, dstPts);

            // Create temporary canvas to read source pixels
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

            // Create output - this will be ONLY the cropped & straightened area
            const outData = ctx.createImageData(width, height);

            // For each output pixel, find the corresponding source pixel
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const srcPoint = applyInverseTransform(x, y, coeffs);

                    // Sample from source with bounds checking
                    if (srcPoint.x >= 0 && srcPoint.x < img.width - 1 &&
                        srcPoint.y >= 0 && srcPoint.y < img.height - 1) {
                        const color = bilinearSample(srcData, srcPoint.x, srcPoint.y, img.width);
                        const idx = (y * width + x) * 4;
                        outData.data[idx] = color.r;
                        outData.data[idx + 1] = color.g;
                        outData.data[idx + 2] = color.b;
                        outData.data[idx + 3] = 255;
                    } else {
                        // Edge pixel - use nearest valid pixel
                        const clampedX = Math.max(0, Math.min(img.width - 1, Math.round(srcPoint.x)));
                        const clampedY = Math.max(0, Math.min(img.height - 1, Math.round(srcPoint.y)));
                        const idx = (y * width + x) * 4;
                        const srcIdx = (clampedY * img.width + clampedX) * 4;
                        outData.data[idx] = srcData.data[srcIdx];
                        outData.data[idx + 1] = srcData.data[srcIdx + 1];
                        outData.data[idx + 2] = srcData.data[srcIdx + 2];
                        outData.data[idx + 3] = 255;
                    }
                }
            }

            ctx.putImageData(outData, 0, 0);

            // Output high quality JPEG
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(new File([blob], 'straightened.jpg', { type: 'image/jpeg' }));
                } else {
                    resolve(null);
                }
            }, 'image/jpeg', 0.95);
        };
        img.onerror = () => resolve(null);
        img.src = imageSrc;
    });
}

// Compute perspective transform using 8-parameter model
// Solves for coefficients that map destination coords -> source coords
function computePerspectiveCoeffs(src: Point[], dst: Point[]): number[] {
    const A: number[][] = [];
    const b: number[] = [];

    for (let i = 0; i < 4; i++) {
        const sx = src[i].x, sy = src[i].y;
        const dx = dst[i].x, dy = dst[i].y;

        A.push([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]);
        b.push(sx);
        A.push([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]);
        b.push(sy);
    }

    return solveLinear(A, b);
}

function solveLinear(A: number[][], b: number[]): number[] {
    const n = b.length;
    const aug: number[][] = A.map((row, i) => [...row, b[i]]);

    // Forward elimination with partial pivoting
    for (let col = 0; col < n; col++) {
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
                maxRow = row;
            }
        }
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

        if (Math.abs(aug[col][col]) < 1e-10) continue; // Skip near-zero pivots

        for (let row = col + 1; row < n; row++) {
            const factor = aug[row][col] / aug[col][col];
            for (let j = col; j <= n; j++) {
                aug[row][j] -= factor * aug[col][j];
            }
        }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        x[i] = aug[i][n];
        for (let j = i + 1; j < n; j++) {
            x[i] -= aug[i][j] * x[j];
        }
        if (Math.abs(aug[i][i]) > 1e-10) {
            x[i] /= aug[i][i];
        }
    }

    return x;
}

function applyInverseTransform(x: number, y: number, coeffs: number[]): Point {
    const [a, b, c, d, e, f, g, h] = coeffs;
    const denom = g * x + h * y + 1;
    if (Math.abs(denom) < 1e-10) {
        return { x: 0, y: 0 };
    }
    return {
        x: (a * x + b * y + c) / denom,
        y: (d * x + e * y + f) / denom
    };
}

function bilinearSample(
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
        return {
            r: data.data[idx],
            g: data.data[idx + 1],
            b: data.data[idx + 2]
        };
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

export default perspectiveCorrect;
