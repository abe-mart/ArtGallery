export interface Painting {
    id: number;
    title: string;
    slug: string;
    year: number;
    dimensions: string;
    width?: number;  // Physical width in inches
    height?: number; // Physical height in inches
    pixelWidth?: number; // Image pixel width for layout
    pixelHeight?: number; // Image pixel height for layout
    description?: string;
    price?: number;
    isAvailable: boolean;
    imageUrl: string;
    collectionId?: number;
    collection?: Collection;
    createdAt: string;
}

export interface Collection {
    id: number;
    name: string;
    slug: string;
    description?: string;
    paintings?: Painting[];
}

// Public-safe site settings. Never include pinHash/pinSalt here - those
// stay server-side only (see netlify/functions/_utils.ts Settings type).
export interface PublicSettings {
    siteTitle: string;
    artistName: string;
    subtitle: string;
    copyrightName: string;
    heroHeadline: string;
    heroSubtext: string;
    quoteText: string;
    aboutHeadline: string;
    aboutQuote: string;
    aboutText: string;
    galleryIntro: string;
    pinEnabled: boolean;
    blockAiBots: boolean;
    // True only on a live demo deployment (DEMO_MODE=true). Set by the
    // server based on an environment variable, never stored or editable.
    demoMode: boolean;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
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
    demoMode: false,
};
