import React, { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';

interface Point {
    x: number;
    y: number;
}

interface CornerPickerProps {
    imageSrc: string;
    onComplete: (corners: Point[]) => void;
    onCancel: () => void;
}

/**
 * Component for selecting 4 corners on an image for perspective correction.
 * User clicks/drags 4 points: top-left, top-right, bottom-right, bottom-left
 */
export const CornerPicker: React.FC<CornerPickerProps> = ({ imageSrc, onComplete, onCancel }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [corners, setCorners] = useState<Point[]>([]);
    const [dragging, setDragging] = useState<number | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [scale, setScale] = useState(1);

    // Initialize corners when image loads
    useEffect(() => {
        if (imageLoaded && imgRef.current) {
            const rect = imgRef.current.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;
            // Default corners slightly inset
            const margin = 20;
            setCorners([
                { x: margin, y: margin },           // top-left
                { x: w - margin, y: margin },       // top-right
                { x: w - margin, y: h - margin },   // bottom-right
                { x: margin, y: h - margin }        // bottom-left
            ]);

            // Calculate scale factor for converting display coords to image coords
            if (imgRef.current.naturalWidth) {
                setScale(imgRef.current.naturalWidth / w);
            }
        }
    }, [imageLoaded]);

    const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
        e.preventDefault();
        setDragging(index);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragging === null || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setCorners(prev => {
            const newCorners = [...prev];
            newCorners[dragging] = { x, y };
            return newCorners;
        });
    };

    const handleMouseUp = () => {
        setDragging(null);
    };

    const handleComplete = () => {
        // Scale corners back to original image coordinates
        const scaledCorners = corners.map(c => ({
            x: c.x * scale,
            y: c.y * scale
        }));
        onComplete(scaledCorners);
    };

    const cornerLabels = ['TL', 'TR', 'BR', 'BL'];
    const cornerColors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b'];

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
            <div className="flex flex-col items-center max-h-full max-w-full">
                <div className="mb-4 text-white text-center">
                    <h3 className="text-xl font-serif mb-2">Straighten & Crop</h3>
                    <p className="text-sm text-white/70">Drag corners to the painting edges. The selected area will be straightened and cropped.</p>
                </div>

                <div
                    ref={containerRef}
                    className="relative cursor-crosshair"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Select corners"
                        className="max-h-[60vh] max-w-[80vw] object-contain"
                        onLoad={() => setImageLoaded(true)}
                        draggable={false}
                    />

                    {/* Draw connecting lines */}
                    {corners.length === 4 && (
                        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                            <polygon
                                points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                                fill="rgba(255,255,255,0.1)"
                                stroke="white"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                            />
                        </svg>
                    )}

                    {/* Corner handles */}
                    {corners.map((corner, index) => (
                        <div
                            key={index}
                            className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing flex items-center justify-center"
                            style={{
                                left: corner.x,
                                top: corner.y,
                            }}
                            onMouseDown={handleMouseDown(index)}
                        >
                            <div
                                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold shadow-lg"
                                style={{ backgroundColor: cornerColors[index] }}
                            >
                                {cornerLabels[index]}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-4 mt-6">
                    <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button
                        onClick={handleComplete}
                        disabled={corners.length !== 4}
                        className="bg-white text-black hover:bg-white/90"
                    >
                        Apply Correction
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CornerPicker;
