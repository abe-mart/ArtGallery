import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Painting } from '../types';
import { X, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { useSettings } from '../context/SettingsContext';

// Salon-style layout algorithm
interface LayoutItem {
    painting: Painting;
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
}

const Gallery = () => {
    const { settings } = useSettings();
    const [paintings, setPaintings] = useState<Painting[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPainting, setSelectedPainting] = useState<Painting | null>(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [imageDimensions, setImageDimensions] = useState<Map<number, { w: number; h: number }>>(new Map());
    const [scrollProgress, setScrollProgress] = useState(0);
    const sliderRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    const [sortMode, setSortMode] = useState<'default' | 'category' | 'year'>('default');
    
    // Track if initial entrance animation is done
    const [hasAnimated, setHasAnimated] = useState(false);
    useEffect(() => {
        if (!loading && !hasAnimated) {
             const timer = setTimeout(() => setHasAnimated(true), 2000); // Wait for entrance to finish
             return () => clearTimeout(timer);
        }
    }, [loading, hasAnimated]);

    // Reset zoom when closing/changing painting
    useEffect(() => {
        setIsZoomed(false);
    }, [selectedPainting]);

    // Physics-based scrolling state
    const scrollState = useRef({
        isDown: false,
        startX: 0,
        scrollLeft: 0,
        velocity: 0,
        targetScroll: 0,
        lastTime: 0,
        animFrameId: 0
    });

    useEffect(() => {
        const slider = sliderRef.current;
        if (!slider) return;

        const FRICTION = 0.95;
        const DRAG_MULTIPLIER = 1.5;

        const updateScroll = () => {
            if (!slider) return;
            if (Math.abs(scrollState.current.velocity) > 0.1) {
                slider.scrollLeft += scrollState.current.velocity;
                scrollState.current.velocity *= FRICTION;
                if (!scrollState.current.isDown) {
                    scrollState.current.animFrameId = requestAnimationFrame(updateScroll);
                }
            } else {
                scrollState.current.velocity = 0;
            }
        };

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                scrollState.current.velocity += e.deltaY * 0.5;
                const MAX_VELOCITY = 50;
                if (scrollState.current.velocity > MAX_VELOCITY) scrollState.current.velocity = MAX_VELOCITY;
                if (scrollState.current.velocity < -MAX_VELOCITY) scrollState.current.velocity = -MAX_VELOCITY;
                cancelAnimationFrame(scrollState.current.animFrameId);
                scrollState.current.animFrameId = requestAnimationFrame(updateScroll);
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            scrollState.current.isDown = true;
            scrollState.current.startX = e.pageX - slider.offsetLeft;
            scrollState.current.scrollLeft = slider.scrollLeft;
            scrollState.current.velocity = 0;
            cancelAnimationFrame(scrollState.current.animFrameId);
            slider.style.cursor = 'grabbing';
        };

        const handleMouseLeave = () => {
            scrollState.current.isDown = false;
            slider.style.cursor = 'grab';
            scrollState.current.animFrameId = requestAnimationFrame(updateScroll);
        };

        const handleMouseUp = () => {
            scrollState.current.isDown = false;
            slider.style.cursor = 'grab';
            scrollState.current.animFrameId = requestAnimationFrame(updateScroll);
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!scrollState.current.isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            // Use 1.5 drag multiplier same as scroll logic constant
            const walk = (x - scrollState.current.startX) * DRAG_MULTIPLIER;
            const newScroll = scrollState.current.scrollLeft - walk;
            const delta = newScroll - slider.scrollLeft;
            scrollState.current.velocity = delta;
            slider.scrollLeft = newScroll;
        };

        slider.addEventListener('wheel', handleWheel, { passive: false });
        slider.addEventListener('mousedown', handleMouseDown);
        slider.addEventListener('mouseleave', handleMouseLeave);
        slider.addEventListener('mouseup', handleMouseUp);
        slider.addEventListener('mousemove', handleMouseMove);
        slider.style.cursor = 'grab';

        // Track scroll progress
        const handleScroll = () => {
            const maxScroll = slider.scrollWidth - slider.clientWidth;
            if (maxScroll > 0) {
                setScrollProgress(slider.scrollLeft / maxScroll);
            }
        };
        slider.addEventListener('scroll', handleScroll);

        return () => {
            // Cancel any pending animation frame
            if (scrollState.current.animFrameId) {
                cancelAnimationFrame(scrollState.current.animFrameId);
                scrollState.current.animFrameId = 0;
            }
            slider.removeEventListener('wheel', handleWheel);
            slider.removeEventListener('mousedown', handleMouseDown);
            slider.removeEventListener('mouseleave', handleMouseLeave);
            slider.removeEventListener('mouseup', handleMouseUp);
            slider.removeEventListener('mousemove', handleMouseMove);
            slider.removeEventListener('scroll', handleScroll);
        };
    }, [loading]);

    useEffect(() => {
        const imageRefs: HTMLImageElement[] = []; // Track images for cleanup

        api.getPaintings()
            .then(data => {
                setPaintings(data);
                data.forEach((p: Painting) => {
                    // OPTIMIZATION: Use pre-calculated DB dimensions if available
                    if (p.pixelWidth && p.pixelHeight) {
                        setImageDimensions(prev => new Map(prev).set(p.id, { w: p.pixelWidth!, h: p.pixelHeight! }));
                    } else {
                        // Fallback
                        const img = new Image();
                        imageRefs.push(img); 
                        img.onload = () => {
                            setImageDimensions(prev => new Map(prev).set(p.id, { w: img.width, h: img.height }));
                        };
                        img.onerror = () => {
                            setImageDimensions(prev => new Map(prev).set(p.id, { w: 1, h: 1 }));
                        };
                        img.src = `${p.imageUrl}`;
                    }
                });
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch paintings:", err);
                setLoading(false);
            });

        return () => {
            // Clear image references
            imageRefs.forEach(img => {
                img.onload = null;
                img.onerror = null;
                img.src = '';
            });
        };
    }, []);

    // Helper to group paintings
    const groupedPaintings = useMemo(() => {
        if (sortMode === 'default') {
            return [{ title: '', items: paintings }];
        }

        const groups: { title: string; items: Painting[] }[] = [];

        if (sortMode === 'category') {
            const map = new Map<string, Painting[]>();
            paintings.forEach(p => {
                const cat = p.collection?.name || 'Uncategorized';
                if (!map.has(cat)) map.set(cat, []);
                map.get(cat)!.push(p);
            });
            // Sort categories alphabetically-ish, but maybe put Uncategorized last
            Array.from(map.entries())
                .sort((a, b) => {
                    if (a[0] === 'Uncategorized') return 1;
                    if (b[0] === 'Uncategorized') return -1;
                    return a[0].localeCompare(b[0]);
                })
                .forEach(([title, items]) => groups.push({ title, items }));
        } else if (sortMode === 'year') {
            const map = new Map<number, Painting[]>();
            paintings.forEach(p => {
                if (!map.has(p.year)) map.set(p.year, []);
                map.get(p.year)!.push(p);
            });
            // Sort years descending
            Array.from(map.entries())
                .sort((a, b) => b[0] - a[0])
                .forEach(([year, items]) => groups.push({ title: year.toString(), items }));
        }

        return groups;
    }, [paintings, sortMode]);

    // Salon-style layout calculation
    const layout = useMemo(() => {
        // Only calculate layout when we have dimensions for all details (or fallback ones)
        if (paintings.length === 0) return [];
        // Note: We don't strictly wait for ALL dimensions because some images might fail/be slow
        // But we need at least some. Since we setLoading(false) after initiating fetches, we are good.

        const wallHeight = 625;
        const baseSize = 225;
        const padding = 30;
        const items: (LayoutItem & { type: 'painting' | 'divider'; text?: string })[] = [];

        // Start after the intro placard
        let currentX = 450;

        groupedPaintings.forEach((group) => {
            // Add Section Divider if not default mode
            if (sortMode !== 'default') {
                items.push({
                    type: 'divider',
                    text: group.title,
                    x: currentX,
                    y: 150, // Fixed height for divider
                    width: 100, // Placeholder
                    height: 200, // Placeholder
                    scale: 1,
                    painting: {} as Painting // Dummy
                });
                currentX += 120;
            }

            let clusterIndex = 0;

            for (let i = 0; i < group.items.length; i++) {
                const painting = group.items[i];
                const dims = imageDimensions.get(painting.id) || { w: 1, h: 1 };
                const aspectRatio = dims.w / dims.h;

                const posInCluster = i % 3;

                // Reset cluster pattern for each group so they look consistent
                const clusterType = clusterIndex % 4;

                let scale: number;
                let yOffset: number;

                if (clusterType === 0) {
                    if (posInCluster === 0) { scale = 1.3; yOffset = 0.5; }
                    else if (posInCluster === 1) { scale = 0.85; yOffset = 0.15; }
                    else { scale = 0.85; yOffset = 0.85; }
                } else if (clusterType === 1) {
                    if (posInCluster === 0) { scale = 1.1; yOffset = 0.2; }
                    else if (posInCluster === 1) { scale = 1.0; yOffset = 0.5; }
                    else { scale = 0.9; yOffset = 0.75; }
                } else if (clusterType === 2) {
                    if (posInCluster === 0) { scale = 0.8; yOffset = 0.3; }
                    else if (posInCluster === 1) { scale = 1.4; yOffset = 0.5; }
                    else { scale = 0.8; yOffset = 0.7; }
                } else {
                    if (posInCluster === 0) { scale = 1.0; yOffset = 0.25; }
                    else if (posInCluster === 1) { scale = 1.2; yOffset = 0.65; }
                    else { scale = 0.9; yOffset = 0.4; }
                }

                const width = baseSize * scale * (aspectRatio > 1 ? aspectRatio : 1);
                const height = baseSize * scale * (aspectRatio < 1 ? 1 / aspectRatio : 1);
                const y = (wallHeight - height) * yOffset;

                items.push({ type: 'painting', painting, x: currentX, y, width, height, scale });

                currentX += width + padding + (posInCluster === 2 ? 60 : 0);

                if (posInCluster === 2) clusterIndex++;
            }

            // Gap between groups
            currentX += 150;
        });

        return items;
    }, [groupedPaintings, imageDimensions, sortMode]);

    const totalWidth = useMemo(() => {
        if (layout.length === 0) return 1000;
        const last = layout[layout.length - 1];
        return last.x + last.width + 200;
    }, [layout]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8f7f5' }}>
                <div className="animate-pulse text-stone tracking-[0.3em] text-sm font-light">LOADING COLLECTION</div>
            </div>
        );
    }

    if (paintings.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center text-center px-4" style={{ background: '#f8f7f5' }}>
                <div className="max-w-md">
                    <h1 className="text-2xl font-serif text-charcoal mb-3">{settings.artistName}</h1>
                    <p className="text-stone mb-2">This gallery is just getting started.</p>
                    <p className="text-stone text-sm">
                        Please check back soon
                        {settings.demoMode ? '.' : (
                            <> — or if this is your site, <a href="/admin" className="underline underline-offset-4 hover:text-charcoal">sign in</a> to add your first painting.</>
                        )}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen overflow-hidden flex flex-col relative">
            {/* Light gallery wall */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    background: 'linear-gradient(180deg, #faf9f7 0%, #f5f3f0 50%, #ebe8e4 100%)',
                }}
            />

            {/* Environmental Lighting / Atmosphere Layers */}
            <div
                className="absolute top-0 left-0 right-0 h-32 z-0 pointer-events-none"
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, transparent 100%)',
                }}
            />
            <div
                className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                }}
            />
            {/* Floor */}
            <div
                className="absolute bottom-0 left-0 w-full h-[12%] z-0"
                style={{
                    background: 'linear-gradient(180deg, #d4c8b8 0%, #c9bba8 60%, #bfb098 100%)',
                }}
            />
            {/* Floor shine */}
            <div
                className="absolute bottom-0 left-0 w-full h-[12%] z-0 pointer-events-none"
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
                }}
            />
            {/* Baseboard trim */}
            <div
                className="absolute z-0"
                style={{
                    bottom: '12%',
                    left: 0,
                    right: 0,
                    height: '8px',
                    background: 'linear-gradient(180deg, #ffffff 0%, #f0ebe5 100%)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                }}
            />

            {/* Sorting Controls */}
            <div className="absolute top-24 right-8 z-30 flex gap-4 text-xs tracking-widest uppercase">
                {(['default', 'category', 'year'] as const).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => setSortMode(mode)}
                        className={`transition-colors duration-300 ${sortMode === mode ? 'text-charcoal font-semibold border-b border-charcoal' : 'text-stone hover:text-charcoal'}`}
                    >
                        {mode === 'default' ? 'All' : mode}
                    </button>
                ))}
            </div>

            {/* Scrollable gallery */}
            <div
                ref={sliderRef}
                className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide relative z-10"
                style={{ paddingTop: '100px', paddingBottom: '14%' }}
            >
                <div
                    className="relative h-full"
                    style={{ width: totalWidth, minWidth: '100vw' }}
                >
                    {/* Wall Placard - Scrolls with paintings */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: selectedPainting ? 0 : 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="absolute pointer-events-none"
                        style={{
                            left: 80,
                            top: 120,
                            width: 280,
                        }}
                    >
                        <h1
                            className="text-4xl md:text-5xl font-serif tracking-wide mb-4"
                            style={{
                                color: '#3d3830',
                                fontWeight: 300,
                            }}
                        >
                            The Collection
                        </h1>
                        <p
                            className="text-sm leading-relaxed"
                            style={{ color: '#6b635a' }}
                        >
                            {settings.galleryIntro}
                        </p>
                        <div
                            className="mt-4 w-16 h-px"
                            style={{ background: '#c9bfb0' }}
                        />

                        {/* Scroll hint arrow */}
                        <div className="mt-6 pointer-events-auto inline-block">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (sliderRef.current) {
                                        sliderRef.current.scrollBy({ left: window.innerWidth < 768 ? 250 : 400, behavior: 'smooth' });
                                    }
                                }}
                                className={`flex items-center gap-2 transition-all duration-500 group cursor-pointer ${scrollProgress > 0.1 ? 'opacity-0 pointer-events-none' : 'opacity-100 text-stone/60 hover:text-stone'}`}
                                aria-label="Scroll gallery right"
                            >
                                <span className="text-xs uppercase tracking-widest font-serif">Explore</span>
                                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>

                    {layout.map((item, index) => {
                        if (item.type === 'divider') {
                            return (
                                <motion.div
                                    key={`divider-${item.text}-${index}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="absolute"
                                    style={{
                                        left: item.x,
                                        top: 100, // Fixed top text
                                        width: 150,
                                        height: '100%'
                                    }}
                                >
                                    <div className="h-full border-l border-stone/20 absolute left-0 top-0 bottom-24" />
                                    <h2
                                        className="text-2xl font-serif text-charcoal/80 absolute top-4 left-6 whitespace-nowrap"
                                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                    >
                                        {item.text}
                                    </h2>
                                </motion.div>
                            );
                        }

                        // Just assume painting type here
                        return (
                            <motion.div
                                key={item.painting.id}
                                layoutId={`container-${item.painting.id}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ 
                                    duration: 0.6, 
                                    delay: hasAnimated ? 0 : index * 0.08,
                                    ease: "circOut"
                                }}
                                className="absolute group cursor-pointer"
                                style={{
                                    left: item.x,
                                    top: item.y,
                                }}
                                onClick={() => setSelectedPainting(item.painting)}
                            >
                                {/* Museum spotlight */}
                                <div
                                    className="absolute pointer-events-none"
                                    style={{
                                        top: -80,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: item.width * 1.5,
                                        height: item.height + 120,
                                        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,252,245,0.3) 0%, transparent 70%)',
                                    }}
                                />

                                {/* Hover highlight */}
                                <div
                                    className="absolute -inset-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-lg"
                                    style={{
                                        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.02) 0%, transparent 70%)',
                                    }}
                                />

                                {/* Refined thin frame */}
                                <div
                                    className="transition-transform duration-300 group-hover:scale-[1.02]"
                                    style={{
                                        boxShadow: '0 6px 24px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
                                    }}
                                >
                                    {/* Outer frame - thin dark wood */}
                                    <div
                                        style={{
                                            padding: '2px',
                                            background: 'linear-gradient(145deg, #4a3c30 0%, #2a241c 100%)',
                                        }}
                                    >
                                        {/* Inner gold accent line */}
                                        <div
                                            style={{
                                                padding: '1px',
                                                background: 'linear-gradient(145deg, #9a7b4a 0%, #6d5530 100%)',
                                            }}
                                        >
                                            {/* Inner frame */}
                                            <div
                                                style={{
                                                    padding: '2px',
                                                    background: 'linear-gradient(145deg, #3d3225 0%, #2a241c 100%)',
                                                }}
                                            >
                                                {/* White mat */}
                                                <div
                                                    style={{
                                                        padding: `${10 * item.scale}px`,
                                                        background: '#fefefe',
                                                        boxShadow: 'inset 0 0 15px rgba(0,0,0,0.02)',
                                                    }}
                                                >
                                                    <motion.img
                                                        layoutId={`image-${item.painting.id}`}
                                                        src={`${item.painting.imageUrl}`}
                                                        alt={item.painting.title}
                                                        style={{
                                                            width: item.width - (28 * item.scale),
                                                            height: 'auto',
                                                            display: 'block',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Refined Label Plate */}
                                <div className="absolute -bottom-16 left-0 right-0 text-center opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                                    <h3 className="font-serif text-charcoal text-lg leading-none mb-1">{item.painting.title}</h3>
                                    <p className="font-sans text-stone text-[10px] uppercase tracking-widest">{item.painting.year}</p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Detail overlay */}
            <AnimatePresence>
                {selectedPainting && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center p-8"
                        style={{ backgroundColor: 'rgba(250, 249, 247, 0.98)' }}
                        onClick={() => setSelectedPainting(null)}
                    >
                        <div className="relative w-full h-full flex flex-col items-center justify-center">
                            <Button
                                variant="ghost"
                                className="absolute top-4 right-4 text-stone hover:text-charcoal z-50"
                                onClick={(e) => { e.stopPropagation(); setSelectedPainting(null); }}
                            >
                                <X className="h-6 w-6" />
                            </Button>

                            <motion.div
                                layoutId={`container-${selectedPainting.id}`}
                                className="relative flex flex-col items-center justify-center pointer-events-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <motion.div
                                    style={{
                                        boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)',
                                    }}
                                    className={`relative ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                                    onClick={() => {
                                        if (!isDraggingRef.current) {
                                            setIsZoomed(!isZoomed);
                                        }
                                    }}
                                    onDragStart={() => {
                                        isDraggingRef.current = true;
                                    }}
                                    onDragEnd={() => {
                                        setTimeout(() => {
                                            isDraggingRef.current = false;
                                        }, 100);
                                    }}
                                    animate={{
                                        scale: isZoomed ? 2.5 : 1,
                                        cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                                        x: isZoomed ? undefined : 0,
                                        y: isZoomed ? undefined : 0
                                    }}
                                    drag={isZoomed}
                                    dragConstraints={{
                                        left: -1000,
                                        right: 1000,
                                        top: -1000,
                                        bottom: 1000
                                    }}
                                    whileHover={{ scale: isZoomed ? 2.5 : 1.01 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    {/* Thin frame in detail view */}
                                    <div
                                        style={{
                                            padding: '3px',
                                            background: 'linear-gradient(145deg, #4a3c30 0%, #2a241c 100%)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                padding: '1px',
                                                background: 'linear-gradient(145deg, #c9a868 0%, #a08545 100%)',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    padding: '2px',
                                                    background: 'linear-gradient(145deg, #3d3225 0%, #2a241c 100%)',
                                                }}
                                            >
                                                <div
                                                    className="bg-white"
                                                    style={{ padding: '16px' }}
                                                >
                                                    <motion.img
                                                        layoutId={`image-${selectedPainting.id}`}
                                                        src={`${selectedPainting.imageUrl}`}
                                                        alt={selectedPainting.title}
                                                        className="max-h-[65vh] max-w-[75vw] object-contain block select-none"
                                                        draggable={false}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="mt-6 text-center"
                                    style={{ opacity: isZoomed ? 0 : 1, pointerEvents: isZoomed ? 'none' : 'auto' }}
                                >
                                    <h2
                                        className="text-2xl font-serif tracking-wide"
                                        style={{ color: '#3d3830' }}
                                    >
                                        {selectedPainting.title}
                                    </h2>
                                    <p
                                        className="text-sm mt-1 tracking-wider"
                                        style={{ color: '#8a8075' }}
                                    >
                                        {selectedPainting.year}
                                    </p>
                                </motion.div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default Gallery;
