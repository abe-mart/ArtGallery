import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';

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

interface DewarpPickerProps {
    imageSrc: string;
    onComplete: (edges: EdgePoints) => void;
    onCancel: () => void;
}

const POINTS_PER_EDGE = 5;

/**
 * Component for selecting multiple control points along each edge
 * to define the curved boundary of a warped painting.
 */
export const DewarpPicker: React.FC<DewarpPickerProps> = ({ imageSrc, onComplete, onCancel }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [edges, setEdges] = useState<EdgePoints>({ top: [], right: [], bottom: [], left: [] });
    const [dragging, setDragging] = useState<{ edge: keyof EdgePoints; index: number } | null>(null);
    const [scale, setScale] = useState(1);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Initialize default points when image loads
    useEffect(() => {
        if (imageLoaded && imgRef.current) {
            const rect = imgRef.current.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;
            const margin = 15;

            // Calculate scale for converting display coords to image coords
            if (imgRef.current.naturalWidth) {
                setScale(imgRef.current.naturalWidth / w);
            }

            // Create initial points along each edge
            const createEdgePoints = (
                start: Point, end: Point, count: number
            ): Point[] => {
                const points: Point[] = [];
                for (let i = 0; i < count; i++) {
                    const t = i / (count - 1);
                    points.push({
                        x: start.x + t * (end.x - start.x),
                        y: start.y + t * (end.y - start.y)
                    });
                }
                return points;
            };

            setEdges({
                top: createEdgePoints({ x: margin, y: margin }, { x: w - margin, y: margin }, POINTS_PER_EDGE),
                right: createEdgePoints({ x: w - margin, y: margin }, { x: w - margin, y: h - margin }, POINTS_PER_EDGE),
                bottom: createEdgePoints({ x: margin, y: h - margin }, { x: w - margin, y: h - margin }, POINTS_PER_EDGE),
                left: createEdgePoints({ x: margin, y: margin }, { x: margin, y: h - margin }, POINTS_PER_EDGE),
            });
        }
    }, [imageLoaded]);

    const handleMouseDown = useCallback((edge: keyof EdgePoints, index: number) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging({ edge, index });
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

        setEdges(prev => {
            const newEdges = { ...prev };
            newEdges[dragging.edge] = [...prev[dragging.edge]];
            newEdges[dragging.edge][dragging.index] = { x, y };
            return newEdges;
        });
    }, [dragging]);

    const handleMouseUp = useCallback(() => {
        setDragging(null);
    }, []);

    const handleComplete = () => {
        // Scale all points to original image coordinates
        const scaledEdges: EdgePoints = {
            top: edges.top.map(p => ({ x: p.x * scale, y: p.y * scale })),
            right: edges.right.map(p => ({ x: p.x * scale, y: p.y * scale })),
            bottom: edges.bottom.map(p => ({ x: p.x * scale, y: p.y * scale })),
            left: edges.left.map(p => ({ x: p.x * scale, y: p.y * scale })),
        };
        onComplete(scaledEdges);
    };

    const edgeColors: Record<keyof EdgePoints, string> = {
        top: '#ef4444',    // red
        right: '#22c55e',  // green
        bottom: '#3b82f6', // blue
        left: '#f59e0b'    // amber
    };

    const renderEdge = (edgeName: keyof EdgePoints, points: Point[]) => (
        <>
            {/* Line connecting points */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                <polyline
                    points={points.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={edgeColors[edgeName]}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            {/* Draggable points */}
            {points.map((point, index) => (
                <div
                    key={`${edgeName}-${index}`}
                    className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing flex items-center justify-center z-10"
                    style={{
                        left: point.x,
                        top: point.y,
                    }}
                    onMouseDown={handleMouseDown(edgeName, index)}
                >
                    <div
                        className="w-4 h-4 rounded-full border-2 border-white shadow-md"
                        style={{ backgroundColor: edgeColors[edgeName] }}
                    />
                </div>
            ))}
        </>
    );

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
            <div className="flex flex-col items-center max-h-full max-w-full">
                <div className="mb-4 text-white text-center">
                    <h3 className="text-xl font-serif mb-2">Advanced Dewarp</h3>
                    <p className="text-sm text-white/70 mb-1">Drag points along each edge to match the curved paper boundary.</p>
                    <div className="flex gap-4 justify-center text-xs">
                        <span style={{ color: edgeColors.top }}>● Top</span>
                        <span style={{ color: edgeColors.right }}>● Right</span>
                        <span style={{ color: edgeColors.bottom }}>● Bottom</span>
                        <span style={{ color: edgeColors.left }}>● Left</span>
                    </div>
                </div>

                <div
                    ref={containerRef}
                    className="relative cursor-crosshair select-none"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Dewarp"
                        className="max-h-[55vh] max-w-[80vw] object-contain"
                        onLoad={() => setImageLoaded(true)}
                        draggable={false}
                    />

                    {imageLoaded && (
                        <>
                            {renderEdge('top', edges.top)}
                            {renderEdge('right', edges.right)}
                            {renderEdge('bottom', edges.bottom)}
                            {renderEdge('left', edges.left)}
                        </>
                    )}
                </div>

                <div className="flex gap-4 mt-6">
                    <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button
                        onClick={handleComplete}
                        className="bg-white text-black hover:bg-white/90"
                    >
                        Apply Dewarp
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default DewarpPicker;
