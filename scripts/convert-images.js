import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const dataFile = path.join(publicDir, 'data', 'paintings.json');

async function migrate() {
    console.log('Starting image migration to WebP...');
    
    if (!fs.existsSync(dataFile)) {
        console.error('paintings.json not found at ' + dataFile);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    let paintings = data.paintings;
    let modifiedCount = 0;
    
    // Ensure we process array
    if (!Array.isArray(paintings)) {
         console.error('paintings.json structure is invalid (expected array under "paintings" key)');
         process.exit(1);
    }

    for (const p of paintings) {
        if (p.imageUrl && !p.imageUrl.toLowerCase().endsWith('.webp')) {
            // Assume format /images/filename.ext
            // p.imageUrl usually starts with /
            const relativePath = p.imageUrl.startsWith('/') ? p.imageUrl.slice(1) : p.imageUrl;
            const absolutePath = path.join(publicDir, relativePath);

            if (fs.existsSync(absolutePath)) {
                const parsed = path.parse(absolutePath);
                const newFileName = parsed.name + '.webp';
                // Construct new relative path using forward slashes for URL
                const dir = path.dirname(relativePath);
                const newRelativePath = (dir === '.' ? '' : dir + '/') + newFileName;
                
                const newAbsolutePath = path.join(path.dirname(absolutePath), newFileName);

                console.log(`Converting ${p.title} (${relativePath}) -> ${newFileName}`);

                try {
                    await sharp(absolutePath)
                        .webp({ quality: 80 })
                        .toFile(newAbsolutePath);
                    
                    p.imageUrl = '/' + newRelativePath;
                    modifiedCount++;

                    // Delete old file to save space and avoid confusion
                    try {
                        fs.unlinkSync(absolutePath);
                        console.log('Deleted old file:', relativePath);
                    } catch (err) {
                        console.warn('Could not delete old file:', err);
                    }

                } catch (e) {
                    console.error(`Failed to convert ${relativePath}:`, e);
                }
            } else {
                console.warn(`File not found for painting "${p.title}": ${absolutePath}`);
            }
        }
    }

    if (modifiedCount > 0) {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        console.log(`\nSuccess! Updated ${modifiedCount} paintings. Saved to paintings.json.`);
    } else {
        console.log('\nNo images needed conversion.');
    }
}

migrate();
