import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Painting, Collection } from '../types';
import { Trash2, Edit2, Plus, X, Move, Sun, Maximize, Check, Lightbulb, Download } from 'lucide-react';
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
            setMessage('Image loaded. Use tools to edit before uploading.');
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
                // setOriginalUrl(newPreview); // Original updated originalUrl too? Yes.
                setEditMode('none');
                setMessage('Straightened! Click UPLOAD to save.');
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
        setMessage('Dewarping curved edges...');

        try {
            const dewarpedImage = await meshWarp(sourceUrl, edges);
            if (dewarpedImage) {
                setImage(dewarpedImage);
                const newPreview = URL.createObjectURL(dewarpedImage);
                setPreviewUrl(newPreview);
                setOriginalUrl(newPreview);
                setEditMode('none');
                setMessage('Dewarped! Click UPLOAD to save.');
            } else {
                setMessage('Dewarp failed - try adjusting points.');
            }
        } catch (e) {
            console.error(e);
            setMessage('Error during dewarp.');
        }
        setIsProcessing(false);
    };

    const handleWhiteBalanceComplete = async (point: Point) => {
        const sourceUrl = previewUrl;
        if (!sourceUrl) return;

        setIsProcessing(true);
        setMessage('Applying white balance...');

        try {
            const correctedImage = await applyWhiteBalance(sourceUrl, point);
            if (correctedImage) {
                setImage(correctedImage);
                const newPreview = URL.createObjectURL(correctedImage);
                setPreviewUrl(newPreview);
                setOriginalUrl(newPreview); 
                setEditMode('none');
                setMessage('White balance applied! Click UPLOAD to save.');
            } else {
                setMessage('White balance failed.');
            }
        } catch (e) {
            console.error(e);
            setMessage('Error applying white balance.');
        }
        setIsProcessing(false);
    };

    const handleIlluminationComplete = async (points: Point[]) => {
        const sourceUrl = previewUrl;
        if (!sourceUrl) return;

        setIsProcessing(true);
        setMessage('Correcting lighting...');

        try {
            const correctedImage = await illuminationCorrect(sourceUrl, points);
            if (correctedImage) {
                setImage(correctedImage);
                const newPreview = URL.createObjectURL(correctedImage);
                setPreviewUrl(newPreview);
                setOriginalUrl(newPreview);
                setEditMode('none');
                setMessage('Lighting evened out! Click UPLOAD to save.');
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
                            {activeTab === 'paintings' && (
                                <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-charcoal text-white hover:bg-stone gap-2 shadow-md">
                                    <Plus className="w-4 h-4" /> Add Painting
                                </Button>
                            )}
                             <Button variant="outline" onClick={handleLogout}>Logout</Button>
                        </div>
                    )}
                </header>

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
                    <AdminSettings token={token} />
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
                                <label className="block text-xs uppercase tracking-widest text-stone mb-2">Category (Collection)</label>
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

                            {/* Image Preview with Edit Tools */}
                            {previewUrl && editMode === 'none' && (
                                <div className="mt-4">
                                    <div className="relative inline-block">
                                        <img src={previewUrl} alt="Preview" className="max-h-64 w-auto object-contain border border-stone/10 shadow-md rounded-sm" />

                                        {/* Floating toolbar - 4 tools */}
                                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 bg-white px-2 py-1.5 rounded-full shadow-lg border border-stone/10">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditMode('perspective')}
                                                className="gap-1 text-xs px-2"
                                                title="Straighten & Crop - for flat paper with perspective distortion"
                                            >
                                                <Move className="w-3 h-3" />
                                                Straighten
                                            </Button>
                                            <div className="w-px bg-stone/20" />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditMode('dewarp')}
                                                className="gap-1 text-xs px-2"
                                                title="Advanced Dewarp - for curved/warped paper edges"
                                            >
                                                <Maximize className="w-3 h-3" />
                                                Dewarp
                                            </Button>
                                            <div className="w-px bg-stone/20" />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditMode('illumination')}
                                                className="gap-1 text-xs px-2"
                                                title="Even Lighting - correct shadows and uneven illumination"
                                            >
                                                <Lightbulb className="w-3 h-3" />
                                                Lighting
                                            </Button>
                                            <div className="w-px bg-stone/20" />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditMode('whiteBalance')}
                                                className="gap-1 text-xs px-2"
                                                title="White Balance - click on white paper to correct colors"
                                            >
                                                <Sun className="w-3 h-3" />
                                                White Bal
                                            </Button>
                                            <div className="w-px bg-stone/20" />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleDownload}
                                                className="gap-1 text-xs px-2"
                                                title="Download current image at full resolution"
                                            >
                                                <Download className="w-3 h-3" />
                                                Download
                                            </Button>
                                        </div>

                                        {/* Edited indicator */}
                                        {image && (
                                            <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded shadow">
                                                ✓ Edited
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-stone mt-4 text-center">
                                       Click image tools to adjust. Changes are saved on Upload.
                                    </p>
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
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(painting)} className="hover:text-amber-600">
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(painting.id)} className="hover:text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
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
