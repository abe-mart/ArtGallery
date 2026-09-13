import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface Point {
    x: number;
    y: number;
}

interface IlluminationPickerProps {
    imageSrc: string;
    onComplete: (points: Point[]) => void;
    onCancel: () => void;
    isProcessing?: boolean;
}

const CORNER_LABELS = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];
const CORNER_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6']; // red, amber, green, blue

/**
 * Component for selecting 4 corner sample points for illumination correction.
 * User clicks on paper areas at each corner of the painting.
 */
export const IlluminationPicker: React.FC<IlluminationPickerProps> = ({ imageSrc, onComplete, onCancel, isProcessing = false }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [points, setPoints] = useState<(Point | null)[]>([null, null, null, null]);
    const [displayPoints, setDisplayPoints] = useState<(Point | null)[]>([null, null, null, null]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
        if (currentIndex >= 4) return;

        const img = imgRef.current;
        if (!img) return;

        const rect = img.getBoundingClientRect();
        const displayX = e.clientX - rect.left;
        const displayY = e.clientY - rect.top;

        const scaleX = img.naturalWidth / rect.width;
        const scaleY = img.naturalHeight / rect.height;

        const imageX = displayX * scaleX;
        const imageY = displayY * scaleY;

        const newPoints = [...points];
        const newDisplayPoints = [...displayPoints];
        newPoints[currentIndex] = { x: imageX, y: imageY };
        newDisplayPoints[currentIndex] = { x: displayX, y: displayY };

        setPoints(newPoints);
        setDisplayPoints(newDisplayPoints);
        setCurrentIndex(currentIndex + 1);
    };

    const handleUndo = () => {
        if (currentIndex > 0) {
            const newPoints = [...points];
            const newDisplayPoints = [...displayPoints];
            newPoints[currentIndex - 1] = null;
            newDisplayPoints[currentIndex - 1] = null;
            setPoints(newPoints);
            setDisplayPoints(newDisplayPoints);
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleComplete = () => {
        const validPoints = points.filter((p): p is Point => p !== null);
        if (validPoints.length === 4) {
            onComplete(validPoints);
        }
    };

    const allPointsSet = points.every(p => p !== null);

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
            {isProcessing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                    <div className="flex flex-col items-center gap-3 text-white">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <p className="text-sm">Evening out lighting…</p>
                    </div>
                </div>
            )}
            <div className="flex flex-col items-center max-h-full max-w-full">
                <div className="mb-4 text-white text-center">
                    <h3 className="text-xl font-serif mb-2">Even Lighting</h3>
                    <p className="text-sm text-white/70 mb-2">
                        Click on <span className="font-bold">paper areas</span> (not the painting) at each corner.
                        This evens out shadows and lighting while preserving the paper's natural tone.
                    </p>
                    <div className="flex justify-center gap-4 text-xs">
                        {CORNER_LABELS.map((label, idx) => (
                            <span
                                key={label}
                                className={`px-2 py-1 rounded ${
                                    idx < currentIndex
                                        ? 'bg-white/20'
                                        : idx === currentIndex
                                        ? 'bg-white/40 font-bold'
                                        : 'bg-white/10'
                                }`}
                                style={{ borderLeft: `3px solid ${CORNER_COLORS[idx]}` }}
                            >
                                {idx + 1}. {label} {idx < currentIndex && '✓'}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="relative">
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Select illumination sample points"
                        className={`max-h-[55vh] max-w-[80vw] object-contain ${currentIndex < 4 ? 'cursor-crosshair' : ''}`}
                        onClick={handleClick}
                        draggable={false}
                    />

                    {/* Display sample point indicators */}
                    {displayPoints.map((point, idx) => point && (
                        <div
                            key={idx}
                            className="absolute pointer-events-none"
                            style={{
                                left: point.x - 15,
                                top: point.y - 15,
                                width: 30,
                                height: 30,
                            }}
                        >
                            {/* Outer ring with corner color */}
                            <div
                                className="absolute inset-0 border-2 rounded-full"
                                style={{ borderColor: CORNER_COLORS[idx] }}
                            />
                            {/* Center dot */}
                            <div
                                className="absolute rounded-full"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 6,
                                    height: 6,
                                    backgroundColor: CORNER_COLORS[idx],
                                }}
                            />
                            {/* Label */}
                            <div
                                className="absolute text-xs font-bold"
                                style={{
                                    left: '50%',
                                    top: -18,
                                    transform: 'translateX(-50%)',
                                    color: CORNER_COLORS[idx],
                                    textShadow: '0 0 3px black, 0 0 3px black',
                                }}
                            >
                                {idx + 1}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-4 mt-6">
                    <Button variant="secondary" onClick={onCancel} disabled={isProcessing}>Cancel</Button>
                    <Button
                        variant="secondary"
                        onClick={handleUndo}
                        disabled={currentIndex === 0 || isProcessing}
                    >
                        Undo
                    </Button>
                    <Button
                        onClick={handleComplete}
                        disabled={!allPointsSet || isProcessing}
                        className="bg-white text-black hover:bg-white/90 gap-2"
                    >
                        {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : 'Apply Lighting Correction'}
                    </Button>
                </div>

                <p className="mt-3 text-white/50 text-xs">
                    Tip: Click on the white paper border, not on painted areas
                </p>
            </div>
        </div>
    );
};

export default IlluminationPicker;
