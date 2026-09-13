import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const dataFile = path.join(publicDir, 'data', 'paintings.json');

async function optimize() {
    console.log('Starting data optimization (adding dimensions)...');
    
    if (!fs.existsSync(dataFile)) {
        console.error('paintings.json not found');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    let modified = 0;

    for (const p of data.paintings) {
        if (p.imageUrl) { //  && (!p.width || !p.height) - update all to be safe and accurate with new webp
            const relativePath = p.imageUrl.startsWith('/') ? p.imageUrl.slice(1) : p.imageUrl;
            const absolutePath = path.join(publicDir, relativePath);

            if (fs.existsSync(absolutePath)) {
                try {
                    const metadata = await sharp(absolutePath).metadata();
                    if (metadata.width && metadata.height) {
                        // We store the PIXEL dimensions for layout calculation
                        if (p.width !== metadata.width || p.height !== metadata.height) {
                            p.width = metadata.width;
                            p.height = metadata.height;
                            
                            // Also update 'dimensions' string if it's "Unknown" or empty, purely as a fallback/display
                            // Actually, let's keep 'dimensions' as the physical inches (user entered)
                            // and use width/height as the pixel source for the gallery layout logic.
                            // But wait, Admin currently maps width/height to inches input.
                            // We have a conflict of interest here.
                            // 1. Admin treats width/height as PHYSICAL INCHES.
                            // 2. Gallery needs PIXEL ASPECT RATIO.
                            
                            // SOLUTION: 
                            // Store 'pixelWidth' and 'pixelHeight' for layout?
                            // OR, just store 'width' and 'height' as pixels if they are large integers, 
                            // and 'widthInches'/'heightInches' (which we don't have schema for) separately?
                            
                            // Looking at paintings.ts: 
                            // width: parseFloat(formData.get('width') as string || '0'),
                            
                            // Admin inputs are "Width (in)" and "Height (in)".
                            // So 'p.width' and 'p.height' in the DB are currently intended for INCHES.
                            
                            // However, strictly for the "Gallery Salon Layout", we just need the RATIO.
                            // If we have accurate pixel dimensions, we can calculate ratio.
                            // Adding specific 'pixelWidth' and 'pixelHeight' is safer to avoid confusing inches with pixels.
                            
                            p.pixelWidth = metadata.width;
                            p.pixelHeight = metadata.height;
                            modified++;
                            process.stdout.write('.');
                        }
                    }
                } catch (e) {
                    console.warn(`\nError reading ${relativePath}: ${e.message}`);
                }
            }
        }
    }

    if (modified > 0) {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        console.log(`\nUpdated dimensions for ${modified} paintings.`);
    } else {
        console.log('\nNo changes needed.');
    }
}

optimize();
