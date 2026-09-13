import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface Point {
    x: number;
    y: number;
}

interface WhiteBalancePickerProps {
    imageSrc: string;
    onComplete: (point: Point) => void;
    onCancel: () => void;
    isProcessing?: boolean;
}

/**
 * Component for selecting a white reference point for white balance correction.
 */
export const WhiteBalancePicker: React.FC<WhiteBalancePickerProps> = ({ imageSrc, onComplete, onCancel, isProcessing = false }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
    const [displayPoint, setDisplayPoint] = useState<Point | null>(null);

    const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
        const img = imgRef.current;
        if (!img) return;

        const rect = img.getBoundingClientRect();
        
        // Get click position relative to the displayed image
        const displayX = e.clientX - rect.left;
        const displayY = e.clientY - rect.top;
        
        // Calculate scale from natural size to displayed size
        const scaleX = img.naturalWidth / rect.width;
        const scaleY = img.naturalHeight / rect.height;
        
        // Convert to original image coordinates
        const imageX = displayX * scaleX;
        const imageY = displayY * scaleY;
        
        // Store both for display and submission
        setDisplayPoint({ x: displayX, y: displayY });
        setSelectedPoint({ x: imageX, y: imageY });
    };

    const handleComplete = () => {
        if (selectedPoint) {
            onComplete(selectedPoint);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
            {isProcessing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                    <div className="flex flex-col items-center gap-3 text-white">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <p className="text-sm">Fixing colors…</p>
                    </div>
                </div>
            )}
            <div className="flex flex-col items-center max-h-full max-w-full">
                <div className="mb-4 text-white text-center">
                    <h3 className="text-xl font-serif mb-2">White Balance</h3>
                    <p className="text-sm text-white/70">Click on an area that should be white (like the paper). Colors will be adjusted to make it neutral.</p>
                </div>

                <div className="relative">
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Select white reference"
                        className="max-h-[60vh] max-w-[80vw] object-contain cursor-crosshair"
                        onClick={handleClick}
                        draggable={false}
                    />

                    {/* Selected point indicator */}
                    {displayPoint && (
                        <div
                            className="absolute pointer-events-none"
                            style={{
                                left: displayPoint.x - 20,
                                top: displayPoint.y - 20,
                                width: 40,
                                height: 40,
                            }}
                        >
                            {/* Outer ring */}
                            <div className="absolute inset-0 border-2 border-white rounded-full" />
                            {/* Inner crosshair */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-1 h-1 bg-white rounded-full" />
                            </div>
                            {/* Sample area indicator */}
                            <div
                                className="absolute border border-yellow-400 rounded"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 20,
                                    height: 20,
                                }}
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-4 mt-6">
                    <Button variant="secondary" onClick={onCancel} disabled={isProcessing}>Cancel</Button>
                    <Button
                        onClick={handleComplete}
                        disabled={!selectedPoint || isProcessing}
                        className="bg-white text-black hover:bg-white/90 gap-2"
                    >
                        {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : 'Apply White Balance'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default WhiteBalancePicker;
