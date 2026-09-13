import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { useSettings } from '../context/SettingsContext';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const { settings } = useSettings();

    const navLinks = [
        { name: 'Gallery', path: '/' },
        { name: 'About', path: '/info' },
        { name: 'Admin', path: '/admin' },
    ];

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="fixed w-full bg-paper/90 backdrop-blur-sm z-50 border-b border-stone/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    <Link to="/" className="font-serif text-2xl tracking-wide text-charcoal hover:opacity-80 transition-opacity">
                        {settings.artistName}
                        <span className="block text-xs font-sans text-stone tracking-widest mt-1">{settings.subtitle}</span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex space-x-12 items-center">
                        {settings.demoMode && (
                            <a
                                href="https://github.com/abe-mart/ArtGallery"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] tracking-widest uppercase bg-charcoal text-paper px-3 py-1.5 rounded-full hover:opacity-80 transition-opacity"
                            >
                                Live Demo — Deploy Your Own
                            </a>
                        )}
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.path}
                                className={cn(
                                    "text-sm tracking-widest transition-colors duration-300 font-sans uppercase",
                                    isActive(link.path) ? "text-charcoal border-b border-stone" : "text-stone hover:text-charcoal"
                                )}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
                            {isOpen ? <X className="h-6 w-6 text-charcoal" /> : <Menu className="h-6 w-6 text-charcoal" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden bg-paper absolute w-full border-b border-stone/10 transition-all duration-300 ease-in-out">
                    <div className="px-4 pt-2 pb-6 space-y-4 text-center">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.path}
                                onClick={() => setIsOpen(false)}
                                className={cn(
                                    "block px-3 py-2 text-base font-medium tracking-wide uppercase",
                                    isActive(link.path) ? "text-charcoal" : "text-stone"
                                )}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
