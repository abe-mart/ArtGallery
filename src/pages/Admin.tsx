import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Painting, Collection } from '../types';
import { Trash2, Edit2, Plus, X, Move, Sun, Maximize, Check, Lightbulb, ArrowRight } from 'lucide-react';
import { perspectiveCorrect } from '../lib/perspectiveCorrect';
import { applyWhiteBalance } from '../lib/whiteBalance';
import { meshWarp } from '../lib/meshWarp';
import { illuminationCorrect } from '../lib/illuminationCorrect';
import CornerPicker from '../components/CornerPicker';
import WhiteBalancePicker from '../components/WhiteBalancePicker';
import DewarpPicker from '../components/DewarpPicker';
import IlluminationPicker from '../components/IlluminationPicker';
import { convertImageToWebP } from '../lib/imageUtils';
import { api } from '../lib/api';
import AdminSettings from './AdminSettings';
import { useSettings } from '../context/SettingsContext';
import Tooltip from '../components/Tooltip';

interface Point {
    x: number;
    y: number;
}

interface EdgePoints {
    top: Point[];
    right: Point[];
    bottom: Point[];
    left: Point[];
}

// Guided steps a new photo walks through: crop/straighten it, then
// optionally even out lighting, then optionally fix colors, then review.
type WizardStep = 'crop' | 'lighting' | 'color' | 'review';

const getImageDimensions = (file: File | Blob): Promise<{w: number, h: number}> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
             resolve({ w: img.width, h: img.height });
             URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
    });
};

const Admin = () => {
    const { settings } = useSettings();

    // Auth State
    const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    const [paintings, setPaintings] = useState<Painting[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);

    const [isEditing, setIsEditing] = useState<number | string | null>(null);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
    const [showForm, setShowForm] = useState(false);

    const [title, setTitle] = useState('');
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
    const [isAddingCollection, setIsAddingCollection] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');

    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);

    // Editing modes: 'none' | 'perspective' | 'dewarp' | 'whiteBalance' | 'illumination'
    const [editMode, setEditMode] = useState<'none' | 'perspective' | 'dewarp' | 'whiteBalance' | 'illumination'>('none');
    // A newly-selected photo walks through crop -> lighting -> color -> review.
    // Editing an existing painting's details (without replacing the photo)
    // starts straight at 'review' - no need to re-walk an already-good photo.
    const [wizardStep, setWizardStep] = useState<WizardStep>('review');

    const [message, setMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const [activeTab, setActiveTab] = useState<'paintings' | 'settings'>('paintings');

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const fetchData = () => {
        api.getPaintings().then(setPaintings).catch(console.error);
        api.getCollections().then(setCollections).catch(console.error);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        try {
            const t = await api.login(password);
            setToken(t);
            localStorage.setItem('adminToken', t);
        } catch (err: unknown) {
            setAuthError(err instanceof Error ? err.message : 'Invalid password');
        }
    };

    const handleLogout = () => {
        setToken(null);
        localStorage.removeItem('adminToken');
    };

    const resetForm = () => {
        setTitle('');
        setYear(new Date().getFullYear().toString());
        setSelectedCollectionId('');
        setIsAddingCollection(false);
        setNewCollectionName('');
        setImage(null);
        setPreviewUrl(null);
        setOriginalUrl(null);
        setIsEditing(null);
        setFormMode('add');
        setShowForm(false);
        setMessage('');
        setEditMode('none');
        setWizardStep('review');
        setIsProcessing(false);
    };

    const handleEdit = (painting: Painting) => {
        setIsEditing(painting.id);
        setFormMode('edit');
        setTitle(painting.title);
        setYear(painting.year.toString());
        setSelectedCollectionId(painting.collectionId ? painting.collectionId.toString() : '');
        setImage(null);
        const imgUrl = `${painting.imageUrl}`;
        setPreviewUrl(imgUrl);
        setOriginalUrl(imgUrl);
        setShowForm(true);
        setWizardStep('review');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setOriginalUrl(url);
            setImage(file);
            setEditMode('none');
            setWizardStep('crop');
            setMessage('');
        }
    };

    const handleCreateCollection = async () => {
        if (!newCollectionName.trim() || !token) return;
        setIsProcessing(true);
        try {
            await api.createCollection(newCollectionName, token);
            setNewCollectionName('');
            setIsAddingCollection(false);
            fetchData();
            setMessage('Category created!');
        } catch (err) {
            console.error(err);
            setMessage('Failed to create category.');
        }
        setIsProcessing(false);
    };

    const handleDownload = () => {
        if (previewUrl) {
            const link = document.createElement('a');
            link.href = previewUrl;
            link.download = `processed_${new Date().toISOString().slice(0,10)}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    /* --- Image Processing Wrappers --- */

    const handlePerspectiveComplete = async (corners: Point[]) => {
        const sourceUrl = originalUrl || previewUrl;
        if (!sourceUrl) return;

        setIsProcessing(true);
        setMessage('Straightening & cropping...');

        try {
             const correctedImage = await perspectiveCorrect(sourceUrl, corners);
            if (correctedImage) {
                setImage(correctedImage);
                const newPreview = URL.createObjectURL(correctedImage);
                setPreviewUrl(newPreview);
                setEditMode('none');
                setWizardStep('lighting');
                setMessage('Straightened!');
            } else {
                setMessage('Correction failed - try adjusting corners.');
            }

        } catch (e) {
            console.error(e);
            setMessage('Error during correction.');
        }
        setIsProcessing(false);
    };

    const handleDewarpComplete = async (edges: EdgePoints) => {
        const sourceUrl = originalUrl || previewUrl;
        if (!sourceUrl) return;

        setIsProcessing(true);
        setMessage('Fixing curved edges...');

        try {
            const dewarpedImage = await meshWarp(sourceUrl, edges);
            if (dewarpedImage) {
                setImage(dewarpedImage);
                const newPreview = URL.createObjectURL(dewarpedImage);
                setPreviewUrl(newPreview);
                setEditMode('none');
                setWizardStep('lighting');
                setMessage('Fixed!');
            } else {
                setMessage('Fix failed - try adjusting the points.');
            }
        } catch (e) {
            console.error(e);
            setMessage('Error fixing curved edges.');
        }
        setIsProcessing(false);
    };

    const handleWhiteBalanceComplete = async (point: Point) => {
        const sourceUrl = previewUrl;
        if (!sourceUrl) return;

        setIsProcessing(true);
        setMessage('Fixing colors...');

        try {
            const correctedImage = await applyWhiteBalance(sourceUrl, point);
            if (correctedImage) {
                setImage(correctedImage);
                const newPreview = URL.createObjectURL(correctedImage);
                setPreviewUrl(newPreview);
                setOriginalUrl(newPreview);
                setEditMode('none');
                setWizardStep('review');
                setMessage('Colors fixed!');
            } else {
                setMessage('Color fix failed.');
            }
        } catch (e) {
            console.error(e);
            setMessage('Error fixing colors.');
        }
        setIsProcessing(false);
    };

    const handleIlluminationComplete = async (points: Point[]) => {
        const sourceUrl = previewUrl;
        if (!sourceUrl) return;

        setIsProcessing(true);
        setMessage('Evening out lighting...');

        try {
            const correctedImage = await illuminationCorrect(sourceUrl, points);
            if (correctedImage) {
                setImage(correctedImage);
                const newPreview = URL.createObjectURL(correctedImage);
                setPreviewUrl(newPreview);
                setOriginalUrl(newPreview);
                setEditMode('none');
                setWizardStep('color');
                setMessage('Lighting evened out!');
            } else {
                setMessage('Lighting correction failed.');
            }
        } catch (e) {
            console.error(e);
            setMessage('Error correcting lighting.');
        }
        setIsProcessing(false);
    };

    const handleDelete = async (id: number | string) => { // Updated to accept string for Netlify IDs
        if (!token) return;
        if (!confirm('Are you sure you want to delete this painting?')) return;
        try {
            await api.deletePainting(id, token);
            fetchPaintings();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formMode === 'add' && !image) {
            setMessage("Please select an image.");
            return;
        }
        if (!token) return;

        setIsProcessing(true);
        setMessage('Saving...');

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('year', year);
            if (selectedCollectionId) formData.append('collectionId', selectedCollectionId);
            
            // Note: Not appending 'medium', 'dimensions', 'description' as they were removed/not in UI

            if (image) {
                // Convert to WebP
                const webpBlob = await convertImageToWebP(image);
                formData.append('image', webpBlob, 'painting.webp');
                
                // Calculate dimensions for optimization
                const { w, h } = await getImageDimensions(webpBlob);
                formData.append('pixelWidth', w.toString());
                formData.append('pixelHeight', h.toString());
            }

            if (formMode === 'add') {
                await api.createPainting(formData, token);
                setMessage('Painting created successfully!');
            } else if (formMode === 'edit' && isEditing) {
                await api.updatePainting(isEditing, formData, token);
                 setMessage('Painting updated successfully!');
            }

            fetchData();
            setTimeout(resetForm, 1000);
            
        } catch (err: unknown) {
             console.error(err);
             setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        setIsProcessing(false);
    };
    
    // --- Layout ---
    const fetchPaintings = () => {
         api.getPaintings().then(setPaintings).catch(console.error);
    }

    if (!token) {
        return (
            <div className="min-h-screen pt-32 pb-20 px-4 flex items-center justify-center bg-paper">
                <div className="max-w-md w-full p-8 bg-white shadow-lg rounded-lg border border-stone/20">
                    <h1 className="text-2xl font-serif text-charcoal mb-6 text-center">Admin Access</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                placeholder="Enter Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full p-3 border border-stone/30 rounded focus:outline-none focus:ring-2 focus:ring-charcoal/50"
                            />
                        </div>
                        {authError && <p className="text-red-500 text-sm">{authError}</p>}
                        <Button type="submit" className="w-full">Login</Button>
                    </form>
                    <p className="text-xs text-stone/60 text-center mt-6">
                        Forgot your password? Change <code className="bg-stone/10 px-1 rounded">ADMIN_PASSWORD</code> in
                        your Netlify site's Environment Variables, then redeploy.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#faf9f7] to-[#f0eeea] pt-24 pb-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <header className="flex justify-between items-end mb-8 border-b border-stone/20 pb-4">
                    <div>
                        <h1 className="text-3xl text-charcoal font-serif tracking-tight">Studio Admin</h1>
                        <p className="text-stone text-sm tracking-widest uppercase mt-1">Manage Collection</p>
                    </div>
                    {!showForm && (
                        <div className="flex gap-4">
                            {activeTab === 'paintings' && !settings.demoMode && (
                                <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-charcoal text-white hover:bg-stone gap-2 shadow-md">
                                    <Plus className="w-4 h-4" /> Add Painting
                                </Button>
                            )}
                             <Button variant="outline" onClick={handleLogout}>Logout</Button>
                        </div>
                    )}
                </header>

                {settings.demoMode && activeTab === 'paintings' && !showForm && (
                    <div className="bg-stone/10 text-stone text-sm p-4 rounded-sm mb-8">
                        This is a live demo showing sample paintings. Adding, editing, and deleting are turned off here.
                    </div>
                )}

                {!showForm && (
                    <div className="flex gap-2 mb-8 border-b border-stone/10">
                        <button
                            onClick={() => setActiveTab('paintings')}
                            className={`px-4 py-2 text-xs uppercase tracking-widest ${activeTab === 'paintings' ? 'text-charcoal border-b-2 border-charcoal font-semibold' : 'text-stone hover:text-charcoal'}`}
                        >
                            Paintings
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-4 py-2 text-xs uppercase tracking-widest ${activeTab === 'settings' ? 'text-charcoal border-b-2 border-charcoal font-semibold' : 'text-stone hover:text-charcoal'}`}
                        >
                            Settings
                        </button>
                    </div>
                )}

                {activeTab === 'settings' && !showForm && (
                    <AdminSettings token={token} onImported={fetchData} />
                )}

                {activeTab === 'paintings' && showForm && (
                    <div className="bg-white p-8 shadow-lg border border-stone/10 mb-12 relative rounded-sm">
                        <Button variant="ghost" size="icon" onClick={resetForm} className="absolute top-4 right-4">
                            <X className="w-4 h-4" />
                        </Button>
                        <h2 className="text-xl font-serif mb-6">{formMode === 'add' ? 'New Painting' : 'Edit Painting'}</h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-stone mb-2">Title *</label>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-[#faf9f7] border border-stone/20 p-3 rounded-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-stone mb-2">Year *</label>
                                    <input type="number" value={year} onChange={e => setYear(e.target.value)} required className="w-full bg-[#faf9f7] border border-stone/20 p-3 rounded-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
                                </div>
                            </div>

                            {/* Category Selection */}
                            <div>
                                <label className="block text-xs uppercase tracking-widest text-stone mb-2">
                                    Category
                                    <Tooltip text="Optional. Groups paintings together so visitors can filter by category on your gallery page - e.g. 'Landscapes' or 'Portraits'." />
                                </label>
                                {!isAddingCollection ? (
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedCollectionId}
                                            onChange={e => {
                                                if (e.target.value === 'new') {
                                                    setIsAddingCollection(true);
                                                } else {
                                                    setSelectedCollectionId(e.target.value);
                                                }
                                            }}
                                            className="w-full bg-[#faf9f7] border border-stone/20 p-3 rounded-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                                        >
                                            <option value="">-- No Category --</option>
                                            {collections.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                            <option value="new">+ Create New Category...</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCollectionName}
                                            onChange={e => setNewCollectionName(e.target.value)}
                                            placeholder="New Category Name"
                                            className="flex-1 bg-[#faf9f7] border border-stone/20 p-3 rounded-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                                        />
                                        <Button type="button" onClick={handleCreateCollection} className="bg-charcoal text-white hover:bg-stone">
                                            <Check className="w-4 h-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" onClick={() => setIsAddingCollection(false)}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {formMode === 'add' ? (
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-stone mb-2">Image File *</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={onFileChange}
                                        className="w-full text-stone text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-charcoal/10 file:text-charcoal hover:file:bg-charcoal/20 file:cursor-pointer"
                                    />
                                </div>
                            ) : null}

                            {/* Image Preview + Guided Photo Adjustment Wizard */}
                            {previewUrl && editMode === 'none' && (
                                <div className="mt-4">
                                    <div className="relative inline-block">
                                        <img src={previewUrl} alt="Preview" className="max-h-64 w-auto object-contain border border-stone/10 shadow-md rounded-sm" />
                                    </div>

                                    {wizardStep !== 'review' && (
                                        <div className="mt-4 bg-[#faf9f7] border border-stone/10 rounded-lg p-4 max-w-md">
                                            <p className="text-[10px] uppercase tracking-widest text-stone/60 mb-1">
                                                Step {wizardStep === 'crop' ? 1 : wizardStep === 'lighting' ? 2 : 3} of 3
                                            </p>

                                            {wizardStep === 'crop' && (
                                                <>
                                                    <h3 className="font-serif text-lg text-charcoal mb-1">Straighten or crop the photo?</h3>
                                                    <p className="text-xs text-stone mb-3">Skip if it's already flat and square.</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button type="button" size="sm" onClick={() => setEditMode('perspective')} className="gap-1.5 bg-charcoal text-white hover:bg-stone">
                                                            <Move className="w-3.5 h-3.5" /> Straighten
                                                        </Button>
                                                        <Tooltip text="For a photo taken at an angle - drag the corners to square it up." />
                                                        <Button type="button" size="sm" variant="outline" onClick={() => setEditMode('dewarp')} className="gap-1.5">
                                                            <Maximize className="w-3.5 h-3.5" /> Fix Curved Edges
                                                        </Button>
                                                        <Tooltip text="For paper that isn't lying flat - curled corners or a rolled canvas." />
                                                    </div>
                                                </>
                                            )}

                                            {wizardStep === 'lighting' && (
                                                <>
                                                    <h3 className="font-serif text-lg text-charcoal mb-1">Even out the lighting?</h3>
                                                    <p className="text-xs text-stone mb-3">Skip if the lighting already looks even.</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button type="button" size="sm" onClick={() => setEditMode('illumination')} className="gap-1.5 bg-charcoal text-white hover:bg-stone">
                                                            <Lightbulb className="w-3.5 h-3.5" /> Even Lighting
                                                        </Button>
                                                        <Tooltip text="Corrects shadows or a bright spot left by a camera flash." />
                                                    </div>
                                                </>
                                            )}

                                            {wizardStep === 'color' && (
                                                <>
                                                    <h3 className="font-serif text-lg text-charcoal mb-1">Fix the colors?</h3>
                                                    <p className="text-xs text-stone mb-3">Skip if the colors already look accurate.</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button type="button" size="sm" onClick={() => setEditMode('whiteBalance')} className="gap-1.5 bg-charcoal text-white hover:bg-stone">
                                                            <Sun className="w-3.5 h-3.5" /> Fix Colors
                                                        </Button>
                                                        <Tooltip text="Corrects colors that look too warm or cool. Click a white or gray part of the paper." />
                                                    </div>
                                                </>
                                            )}

                                            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-stone/10">
                                                {wizardStep === 'lighting' && (
                                                    <button type="button" onClick={() => setWizardStep('crop')} className="text-xs text-stone hover:text-charcoal underline underline-offset-4">
                                                        ‹ Back
                                                    </button>
                                                )}
                                                {wizardStep === 'color' && (
                                                    <button type="button" onClick={() => setWizardStep('lighting')} className="text-xs text-stone hover:text-charcoal underline underline-offset-4">
                                                        ‹ Back
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setWizardStep(wizardStep === 'crop' ? 'lighting' : wizardStep === 'lighting' ? 'color' : 'review')}
                                                    className="ml-auto text-xs text-stone hover:text-charcoal underline underline-offset-4 inline-flex items-center gap-1"
                                                >
                                                    Skip <ArrowRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {wizardStep === 'review' && (
                                        <div className="mt-3 flex items-center gap-4 text-xs">
                                            {image && <span className="text-green-700 font-medium">✓ Photo adjusted</span>}
                                            <button type="button" onClick={() => setWizardStep('crop')} className="text-stone hover:text-charcoal underline underline-offset-4">
                                                Adjust this photo
                                            </button>
                                            <button type="button" onClick={handleDownload} className="text-stone hover:text-charcoal underline underline-offset-4">
                                                Save to device
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-4 flex items-center justify-between">
                                <p className={`text-sm ${message.includes('!') ? 'text-green-600' : 'text-stone'}`}>{message}</p>
                                <Button
                                    type="submit"
                                    disabled={editMode !== 'none' || isProcessing || (formMode === 'add' && !image)}
                                    className="bg-charcoal text-white hover:bg-stone min-w-[150px] shadow-md disabled:opacity-50"
                                >
                                    {isProcessing ? 'Processing...' : formMode === 'add' ? 'UPLOAD' : 'SAVE'}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Perspective correction modal (4 corners) */}
                {editMode === 'perspective' && previewUrl && (
                    <CornerPicker
                        imageSrc={originalUrl || previewUrl}
                        onComplete={handlePerspectiveComplete}
                        onCancel={() => setEditMode('none')}
                    />
                )}

                {/* Advanced dewarp modal (multi-point edges) */}
                {editMode === 'dewarp' && previewUrl && (
                    <DewarpPicker
                        imageSrc={originalUrl || previewUrl}
                        onComplete={handleDewarpComplete}
                        onCancel={() => setEditMode('none')}
                    />
                )}

                {/* White balance picker modal */}
                {editMode === 'whiteBalance' && previewUrl && (
                    <WhiteBalancePicker
                        imageSrc={previewUrl}
                        onComplete={handleWhiteBalanceComplete}
                        onCancel={() => setEditMode('none')}
                    />
                )}

                {/* Illumination correction modal (4 corner samples) */}
                {editMode === 'illumination' && previewUrl && (
                    <IlluminationPicker
                        imageSrc={previewUrl}
                        onComplete={handleIlluminationComplete}
                        onCancel={() => setEditMode('none')}
                    />
                )}

                {/* Paintings List */}
                {activeTab === 'paintings' && (
                <div className="space-y-3">
                    {paintings.map((painting) => (
                        <div key={painting.id} className="bg-white p-4 border border-stone/10 flex items-center justify-between group hover:shadow-md transition-all rounded-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-stone/5 flex items-center justify-center overflow-hidden rounded-sm shadow-sm">
                                    <img src={`${painting.imageUrl}`} alt={painting.title} className="max-w-full max-h-full object-contain" />
                                </div>
                                <div>
                                    <h3 className="font-serif text-lg text-charcoal">{painting.title}</h3>
                                    <div className="flex gap-2 text-xs text-stone uppercase tracking-widest">
                                        <span>{painting.year}</span>
                                        {painting.collection && (
                                            <>
                                                <span>•</span>
                                                <span className="text-charcoal">{painting.collection.name}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {!settings.demoMode && (
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(painting)} className="text-stone/60 hover:text-amber-600" aria-label={`Edit ${painting.title}`}>
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(painting.id)} className="text-stone/60 hover:text-red-600" aria-label={`Delete ${painting.title}`}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                    {paintings.length === 0 && (
                        <div className="text-center py-12 text-stone">
                            No paintings found. Add one to get started.
                        </div>
                    )}
                </div>
                )}
            </div>
        </div>
    );
};

export default Admin;
