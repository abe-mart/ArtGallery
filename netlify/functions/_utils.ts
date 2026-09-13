import { getStore } from '@netlify/blobs';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { PublicSettings } from '../../src/types';

const CONFIG_STORE = 'gallery-config';
const DATA_STORE = 'gallery-data';
const IMAGE_STORE = 'gallery-images';
const DATA_KEY = 'paintings.json';
const SETTINGS_KEY = 'settings.json';
const SECRET_KEY = 'secret';

// Note: we intentionally do NOT pass siteID/token to getStore() - when
// running on Netlify (deployed or `netlify dev`), those are injected
// automatically. This keeps deployment down to a single required env var
// (ADMIN_PASSWORD).
export function configStore() {
    return getStore({ name: CONFIG_STORE });
}
export function dataStore() {
    return getStore({ name: DATA_STORE });
}
export function imageStore() {
    return getStore({ name: IMAGE_STORE });
}

// =============================================================================
// SECRET MANAGEMENT
// =============================================================================
// Signing secret for JWTs and viewer cookies is generated on first use and
// persisted in Blobs, so there's nothing for the site owner to configure and
// no insecure hardcoded fallback. (In the rare case of two simultaneous
// cold starts racing to create it, the loser's tokens from that instant are
// invalidated - low-stakes and self-healing on the next request.)
let cachedSecret: Uint8Array | null = null;

export async function getSecret(): Promise<Uint8Array> {
    if (cachedSecret) return cachedSecret;

    const store = configStore();
    const existing = await store.get(SECRET_KEY, { type: 'text' }).catch(() => null);
    if (existing) {
        cachedSecret = new TextEncoder().encode(existing);
        return cachedSecret;
    }

    const fresh = randomBytes(32).toString('hex');
    await store.set(SECRET_KEY, fresh);
    cachedSecret = new TextEncoder().encode(fresh);
    return cachedSecret;
}

// =============================================================================
// SETTINGS
// =============================================================================
export interface Settings extends PublicSettings {
    pinHash?: string;
    pinSalt?: string;
    pinVersion: number;
}

export const DEFAULT_SETTINGS: Settings = {
    siteTitle: 'My Art Gallery',
    artistName: 'Jane Artist',
    subtitle: 'ARTIST',
    copyrightName: 'My Art Gallery',
    heroHeadline: 'Welcome',
    heroSubtext: 'A collection of original artwork.',
    quoteText: '"Art is how we decorate space; music is how we decorate time."',
    aboutHeadline: 'The Artist',
    aboutQuote: '"Every piece begins with a blank page and an idea."',
    aboutText: 'Tell your visitors about yourself here. Edit this in the Settings tab of your admin panel.',
    galleryIntro: 'A curated selection of original works.',
    pinEnabled: false,
    blockAiBots: true,
    demoMode: false, // never actually stored/read - the settings.ts GET
                      // handler always overwrites this from isDemoMode()
    pinVersion: 0,
};

export async function getSettings(): Promise<Settings> {
    const store = configStore();
    const saved = await store.get(SETTINGS_KEY, { type: 'json' }).catch(() => null);
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
}

export async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
    const current = await getSettings();
    const updated = { ...current, ...partial };
    await configStore().setJSON(SETTINGS_KEY, updated);
    return updated;
}

// Full replace, used by backup import - unlike saveSettings(), this doesn't
// merge with what's already there.
export async function replaceSettings(settings: Settings): Promise<void> {
    await configStore().setJSON(SETTINGS_KEY, settings);
}

export function toPublicSettings(settings: Settings): PublicSettings {
    // Strip anything sensitive (pinHash, pinSalt, pinVersion) before this
    // ever reaches a client.
    const pub: Settings = { ...settings };
    delete pub.pinHash;
    delete pub.pinSalt;
    const { pinVersion, ...rest } = pub;
    void pinVersion;
    return rest;
}

// =============================================================================
// PAINTINGS DATA
// =============================================================================
export async function getDb() {
    const store = dataStore();
    const data = await store.get(DATA_KEY, { type: 'json' }).catch(() => null);
    return data;
}

export async function getDbOrSeed() {
    const db = await getDb();
    if (db) return db;
    return { paintings: [], collections: [] };
}

export async function saveDb(data: unknown) {
    await dataStore().setJSON(DATA_KEY, data);
}

// Pulls the Blobs storage key out of a `/.netlify/functions/get-image?name=KEY`
// image URL. Shared by the CRUD, export, and import handlers.
export function imageKeyFromUrl(imageUrl: string | undefined): string | null {
    if (!imageUrl) return null;
    const match = imageUrl.match(/[?&]name=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

// =============================================================================
// ADMIN AUTH (password -> JWT)
// =============================================================================
export async function verifyAdminAuth(headers: Headers): Promise<boolean> {
    const authHeader = headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    const token = authHeader.slice('Bearer '.length);
    try {
        const secret = await getSecret();
        const { payload } = await jwtVerify(token, secret);
        return payload.role === 'admin';
    } catch {
        return false;
    }
}

export async function createAdminToken(): Promise<string> {
    const secret = await getSecret();
    return new SignJWT({ role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);
}

export function verifyPassword(input: string, expected: string): boolean {
    // Constant-time compare so response timing can't leak how many
    // leading characters of the password were guessed correctly.
    const a = Buffer.from(input);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
        // Still run a comparison of equal length to avoid a length-based
        // timing signal, then report false.
        timingSafeEqual(a, a);
        return false;
    }
    return timingSafeEqual(a, b);
}

// =============================================================================
// VIEWER ACCESS (optional PIN gate)
// =============================================================================
const VIEWER_COOKIE = 'gallery_viewer';

export async function createViewerCookie(pinVersion: number): Promise<string> {
    const secret = await getSecret();
    const token = await new SignJWT({ role: 'viewer', v: pinVersion })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(secret);
    const maxAge = 60 * 60 * 24 * 30;
    return `${VIEWER_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(headers: Headers, name: string): string | null {
    const cookieHeader = headers.get('cookie');
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(';')) {
        const [k, ...rest] = part.trim().split('=');
        if (k === name) return rest.join('=');
    }
    return null;
}

// Returns true if the request may see gallery content: either the PIN gate
// is off, the visitor has a valid & current viewer cookie, or they're an
// authenticated admin (so previews work in the admin panel too).
export async function hasGalleryAccess(req: Request, settings: Settings): Promise<boolean> {
    if (!settings.pinEnabled) return true;

    if (await verifyAdminAuth(req.headers)) return true;

    const token = readCookie(req.headers, VIEWER_COOKIE);
    if (!token) return false;
    try {
        const secret = await getSecret();
        const { payload } = await jwtVerify(token, secret);
        return payload.v === settings.pinVersion;
    } catch {
        return false;
    }
}

// =============================================================================
// PIN HASHING (scrypt, salted) & LOGIN RATE LIMITING
// =============================================================================
export function hashPin(pin: string): { hash: string; salt: string } {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(pin, salt, 32).toString('hex');
    return { hash, salt };
}

export function verifyPin(pin: string, hash: string, salt: string): boolean {
    const candidate = scryptSync(pin, salt, 32);
    const expected = Buffer.from(hash, 'hex');
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
}

const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord {
    count: number;
    firstAttempt: number;
}

function clientKey(req: Request, prefix: string): string {
    const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown';
    return `${prefix}:${ip}`;
}

// Simple best-effort rate limit for PIN/password guessing, backed by Blobs.
// Not perfectly race-free across concurrent requests, but stops naive
// brute-forcing, which is the realistic threat for a 4-8 digit PIN.
export async function checkRateLimit(req: Request, prefix: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
    const store = configStore();
    const key = `attempts:${clientKey(req, prefix)}`;
    const record = await store.get(key, { type: 'json' }).catch(() => null) as AttemptRecord | null;

    if (!record) return { allowed: true };

    const elapsed = Date.now() - record.firstAttempt;
    if (elapsed > LOCKOUT_MS) return { allowed: true };
    if (record.count >= MAX_ATTEMPTS) {
        return { allowed: false, retryAfterMs: LOCKOUT_MS - elapsed };
    }
    return { allowed: true };
}

export async function recordFailedAttempt(req: Request, prefix: string): Promise<void> {
    const store = configStore();
    const key = `attempts:${clientKey(req, prefix)}`;
    const record = await store.get(key, { type: 'json' }).catch(() => null) as AttemptRecord | null;

    if (!record || Date.now() - record.firstAttempt > LOCKOUT_MS) {
        await store.setJSON(key, { count: 1, firstAttempt: Date.now() });
    } else {
        await store.setJSON(key, { count: record.count + 1, firstAttempt: record.firstAttempt });
    }
}

export async function clearAttempts(req: Request, prefix: string): Promise<void> {
    const store = configStore();
    await store.delete(`attempts:${clientKey(req, prefix)}`).catch(() => {});
}

// =============================================================================
// BOT / AI-CRAWLER BLOCKING
// =============================================================================
// Known AI-training crawlers and scrapers. Not exhaustive (a determined
// scraper can spoof any user agent), but blocks the well-behaved ones that
// identify themselves - which is most large AI companies' default crawler.
export const BLOCKED_BOT_NAMES = [
    'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
    'ClaudeBot', 'Claude-Web', 'anthropic-ai',
    'CCBot', 'Google-Extended', 'Bytespider',
    'PerplexityBot', 'PerplexityUser',
    'meta-externalagent', 'FacebookBot',
    'Applebot-Extended', 'Diffbot', 'ImagesiftBot',
    'Omgilibot', 'Omgili', 'YouBot', 'cohere-ai',
    'Amazonbot', 'Timpibot', 'Bytedance',
];

const BLOCKED_BOT_PATTERNS = BLOCKED_BOT_NAMES.map((name) => new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

export function isBlockedBot(userAgent: string | null): boolean {
    if (!userAgent) return false;
    return BLOCKED_BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

// =============================================================================
// DEMO MODE
// =============================================================================
// When DEMO_MODE=true (set by whoever deploys a public showcase site), every
// write endpoint refuses with a friendly message and the gallery always
// shows a small built-in set of public-domain paintings instead of real
// stored data - so a demo deployment can't be defaced and never needs its
// own Blob storage seeded.
export function isDemoMode(): boolean {
    return process.env.DEMO_MODE === 'true';
}

export function demoBlockedResponse(): Response {
    return new Response(
        JSON.stringify({ error: 'This is a live demo - changes are turned off. Deploy your own free copy to add your own art.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
}

// Public-domain paintings (Wikimedia Commons) used only in demo mode.
export const DEMO_PAINTINGS = [
    {
        id: 1, title: 'The Starry Night', year: 1889, dimensions: '29in x 36in',
        description: 'Vincent van Gogh, oil on canvas.',
        imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg?width=1200',
        collectionId: null, isAvailable: false, price: null, createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 2, title: 'The Great Wave off Kanagawa', year: 1831, dimensions: '10in x 15in',
        description: 'Katsushika Hokusai, woodblock print.',
        imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Great_Wave_off_Kanagawa.jpg?width=1200',
        collectionId: null, isAvailable: false, price: null, createdAt: '2024-01-02T00:00:00.000Z',
    },
    {
        id: 3, title: 'Girl with a Pearl Earring', year: 1665, dimensions: '17in x 15in',
        description: 'Johannes Vermeer, oil on canvas.',
        imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/1665_Girl_with_a_Pearl_Earring.jpg?width=1200',
        collectionId: null, isAvailable: false, price: null, createdAt: '2024-01-03T00:00:00.000Z',
    },
    {
        id: 4, title: 'Mona Lisa', year: 1503, dimensions: '30in x 21in',
        description: 'Leonardo da Vinci, oil on poplar panel.',
        imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg?width=1200',
        collectionId: null, isAvailable: false, price: null, createdAt: '2024-01-04T00:00:00.000Z',
    },
    {
        id: 5, title: 'Wanderer above the Sea of Fog', year: 1818, dimensions: '38in x 29in',
        description: 'Caspar David Friedrich, oil on canvas.',
        imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg?width=1200',
        collectionId: null, isAvailable: false, price: null, createdAt: '2024-01-05T00:00:00.000Z',
    },
    {
        id: 6, title: 'American Gothic', year: 1930, dimensions: '30in x 25in',
        description: 'Grant Wood, oil on beaverboard.',
        imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg?width=1200',
        collectionId: null, isAvailable: false, price: null, createdAt: '2024-01-06T00:00:00.000Z',
    },
];

export function tdmHeaders(blockAiBots: boolean): Record<string, string> {
    if (!blockAiBots) return {};
    // TDMRep (https://www.w3.org/community/reports/tdmrep/) opt-out signal,
    // recognized under the EU's DSM Directive text-and-data-mining exception.
    return { 'Tdm-Reservation': '1', 'Tdm-Policy': 'https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240202/#reservation-protocols' };
}
