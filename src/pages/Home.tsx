import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Painting } from '../types';
import { api } from '../lib/api';
import { useSettings } from '../context/SettingsContext';

const Home = () => {
    const { settings } = useSettings();
    const [featuredPaintings, setFeaturedPaintings] = useState<Painting[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getPaintings()
            .then(data => {
                // Featured logic: Just take first 3 for now, or filter by some property if it existed
                setFeaturedPaintings(data.slice(0, 3)); 
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch paintings:", err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="min-h-screen bg-texture bg-fixed">
            {/* Hero Section */}
            <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-paper/20 z-10" />
                <div className="max-w-4xl mx-auto text-center z-20 px-4">
                    <h1 className="text-5xl md:text-7xl lg:text-8xl text-charcoal mb-6 font-serif italic tracking-tight animate-fade-in-up">
                        {settings.heroHeadline}
                    </h1>
                    <p className="text-lg md:text-xl text-stone mb-10 font-sans tracking-wide max-w-2xl mx-auto">
                        {settings.heroSubtext}
                    </p>
                    <Button asChild size="lg" variant="default" className="rounded-full px-12 text-md tracking-wider">
                        <Link to="/">View Collection</Link>
                    </Button>
                </div>
            </section>

            {/* Featured Artwork */}
            <section className="py-24 px-4 bg-paper/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-end mb-16">
                        <div>
                            <h2 className="text-4xl text-charcoal mb-2">Featured Works</h2>
                            <div className="h-1 w-24 bg-water-blue/30 rounded-full"></div>
                        </div>
                        {featuredPaintings.length > 0 && (
                            <Button variant="link" asChild className="text-stone hover:text-charcoal hidden md:inline-flex">
                                <Link to="/" className="flex items-center gap-2">
                                    View all works <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        )}
                    </div>

                    {loading ? (
                        <div className="text-center py-20 text-stone font-sans tracking-wider animate-pulse">Loading gallery...</div>
                    ) : featuredPaintings.length === 0 ? (
                        <div className="text-center py-20 text-stone">
                            No paintings yet — check back soon.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 md:gap-16">
                            {featuredPaintings.map((painting) => (
                                <Link to={`/gallery/${painting.id}`} key={painting.id} className="group block cursor-pointer">
                                    <div className="aspect-[4/3] overflow-hidden bg-gray-100 mb-6 shadow-sm group-hover:shadow-md transition-all duration-500 ease-out">
                                        <img
                                            src={`${painting.imageUrl}`}
                                            alt={painting.title}
                                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-in-out opacity-95 group-hover:opacity-100"
                                        />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-xl text-charcoal font-serif mb-1 group-hover:text-stone transition-colors">{painting.title}</h3>
                                        <p className="text-xs text-stone uppercase tracking-widest">{painting.year}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {featuredPaintings.length > 0 && (
                        <div className="mt-12 text-center md:hidden">
                            <Button variant="outline" asChild className="w-full border-stone/30">
                                <Link to="/">View all works</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            {/* Artist Statement Teaser */}
            <section className="py-32 bg-charcoal text-paper relative overflow-hidden">
                <div className="max-w-3xl mx-auto text-center px-6 relative z-10">
                    <h2 className="text-3xl md:text-5xl font-serif mb-8 leading-tight">
                        {settings.quoteText}
                    </h2>
                    <Button asChild variant="secondary" className="rounded-full">
                        <Link to="/about">Read Process</Link>
                    </Button>
                </div>
            </section>
        </div>
    );
};

export default Home;
