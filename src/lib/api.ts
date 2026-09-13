import { Painting, Collection, PublicSettings, DEFAULT_PUBLIC_SETTINGS } from '../types';

const FUNCS_URL = '/.netlify/functions';

export class LockedError extends Error {
    constructor() {
        super('Gallery is locked');
        this.name = 'LockedError';
    }
}

async function fetchData() {
    const res = await fetch(`${FUNCS_URL}/get-data`);
    if (res.status === 401) throw new LockedError();
    if (!res.ok) return { paintings: [], collections: [] };
    return res.json();
}

export const api = {
    async getPaintings(): Promise<Painting[]> {
        const data = await fetchData();
        const paintings: Painting[] = data.paintings || [];
        const collections: Collection[] = data.collections || [];

        return paintings.map(p => {
             // Normalize year to number to prevent duplicate groups in sorting
             const pNormalized = { ...p, year: Number(p.year) };

             if (pNormalized.collectionId) {
                 // loose comparison for string/number id
                 const collection = collections.find(c => c.id == pNormalized.collectionId);
                 if (collection) {
                     return { ...pNormalized, collection };
                 }
             }
             return pNormalized;
        });
    },

    async getCollections(): Promise<Collection[]> {
        const data = await fetchData();
        return data.collections || [];
    },

    async getPainting(id: number | string): Promise<Painting | null> {
        const paintings = await this.getPaintings();
        // Loose comparison for string/number id mismatch
        return paintings.find(p => p.id == id) || null;
    },

    async getSettings(): Promise<PublicSettings> {
        try {
            const res = await fetch(`${FUNCS_URL}/settings`);
            if (!res.ok) return DEFAULT_PUBLIC_SETTINGS;
            const data = await res.json();
            return { ...DEFAULT_PUBLIC_SETTINGS, ...data };
        } catch {
            return DEFAULT_PUBLIC_SETTINGS;
        }
    },

    async updateSettings(update: Record<string, unknown>, token: string): Promise<PublicSettings> {
        const res = await fetch(`${FUNCS_URL}/settings`, {
            method: 'PUT',
            body: JSON.stringify(update),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to update settings');
        }
        return res.json();
    },

    // Admin functions
    async login(password: string): Promise<string> {
        const res = await fetch(`${FUNCS_URL}/auth`, {
            method: 'POST',
            body: JSON.stringify({ password }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Login failed');
        }
        const data = await res.json();
        return data.token;
    },

    async unlock(pin: string): Promise<void> {
        const res = await fetch(`${FUNCS_URL}/unlock`, {
            method: 'POST',
            body: JSON.stringify({ pin }),
            headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Incorrect PIN');
        }
    },

    async createPainting(formData: FormData, token: string): Promise<Painting> {
        const res = await fetch(`${FUNCS_URL}/paintings`, {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) {
           const err = await res.json().catch(() => ({}));
           throw new Error(err.error || 'Failed to create painting');
        }
        return res.json();
    },

    async updatePainting(id: number | string, formData: FormData, token: string): Promise<Painting> {
        const res = await fetch(`${FUNCS_URL}/paintings?id=${id}`, {
            method: 'PUT',
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to update painting');
        }
        return res.json();
    },

    async deletePainting(id: number | string, token: string): Promise<void> {
        const res = await fetch(`${FUNCS_URL}/paintings?id=${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error('Failed to delete painting');
    },

    async createCollection(name: string, token: string): Promise<Collection> {
         const res = await fetch(`${FUNCS_URL}/collections`, {
            method: 'POST',
            body: JSON.stringify({ name }),
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
         });
         if (!res.ok) throw new Error('Failed to create collection');
         return res.json();
    },

    async exportGallery(token: string): Promise<Blob> {
        const res = await fetch(`${FUNCS_URL}/export`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to export gallery');
        }
        return res.blob();
    },

    async importGallery(file: File, token: string): Promise<{ paintings: number; images: number }> {
        const formData = new FormData();
        formData.append('backup', file);
        const res = await fetch(`${FUNCS_URL}/import`, {
            method: 'POST',
            body: formData,
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to import backup');
        }
        return res.json();
    }
};
