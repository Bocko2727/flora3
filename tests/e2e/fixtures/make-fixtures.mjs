import sharp from 'sharp';

const dir = new URL('.', import.meta.url).pathname;
const solid = (width, height, background) =>
	sharp({ create: { width, height, channels: 3, background } });

await solid(1200, 900, '#4a7c3f').jpeg({ quality: 80 }).toFile(`${dir}leaf-a.jpg`);
await solid(1200, 900, '#c9a227').jpeg({ quality: 80 }).toFile(`${dir}leaf-b.jpg`);
// Stored landscape 400x300 with EXIF orientation 6 → displayed portrait 300x400.
await solid(400, 300, '#7a3f8c').jpeg({ quality: 80 }).withMetadata({ orientation: 6 }).toFile(`${dir}rotated.jpg`);
console.log('fixtures written');
