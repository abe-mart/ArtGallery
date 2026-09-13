import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Painting } from '../types';
import { api } from '../lib/api';

const PaintingDetail = () => {
    const { id } = useParams<{ id: string }>();
    const [painting, setPainting] = useState<Painting | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setError('Invalid painting ID');
            setLoading(false);
            return;
        }

        api.getPainting(id)
            .then((data) => {
                if (!data) {
                    throw new Error('Painting not found');
                }
                setPainting(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch painting:", err);
                setError(err.message || 'Failed to load painting');
                setLoading(false);
            });

    }, [id]);

    if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center text-stone">Loading...</div>;
    if (error) return <div className="min-h-screen bg-paper flex items-center justify-center text-stone">{error}</div>;
    if (!painting) return <div className="min-h-screen bg-paper flex items-center justify-center text-stone">Painting not found.</div>;

    return (
        <div className="h-screen bg-paper flex flex-col relative overflow-hidden">
            <Button variant="ghost" asChild className="absolute top-24 left-8 z-20 text-stone hover:text-charcoal pl-0">
                <Link to="/gallery" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Link>
            </Button>

            <div className="flex-1 flex items-center justify-center p-8 md:p-12 h-full">
                <img
                    src={`${painting.imageUrl}`}
                    alt={painting.title}
                    className="max-h-full max-w-full object-contain shadow-sm"
                />
            </div>

            <div className="absolute bottom-0 left-0 w-full bg-paper/90 backdrop-blur-sm border-t border-stone/10 p-6 flex justify-center items-end">
                <div className="text-center">
                    <h1 className="text-3xl md:text-4xl text-charcoal font-serif mb-1">{painting.title}</h1>
                    <p className="text-stone font-light text-sm tracking-wide">
                        {painting.year}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaintingDetail;
