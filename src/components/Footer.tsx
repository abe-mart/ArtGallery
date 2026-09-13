
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

const Footer = () => {
    const { settings } = useSettings();
    return (
        <footer className="bg-paper py-12 border-t border-stone/10 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
                <p className="text-stone text-xs tracking-widest">
                    &copy; {new Date().getFullYear()} {settings.copyrightName.toUpperCase()}. ALL RIGHTS RESERVED.
                </p>
                <Link to="/admin" className="text-stone/50 text-[10px] tracking-widest hover:text-stone transition-colors">
                    ADMIN
                </Link>
            </div>
        </footer>
    );
};

export default Footer;
