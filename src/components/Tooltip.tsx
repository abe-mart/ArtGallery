import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

// A small "(?)" icon that shows a short explanation on hover (desktop) or
// tap (touch/mobile) - unlike a native title="" tooltip, this actually
// works for touch users and is keyboard-focusable. Clicking always opens
// it (never toggles) so a click right after a hover can't immediately
// close it again; it closes on outside click, Escape, or losing focus.
const Tooltip = ({ text }: { text: string }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: Event) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('focusin', close);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('focusin', close);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <span className="relative inline-block ml-1.5 align-middle" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(true)}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                className="text-stone/50 hover:text-stone transition-colors align-middle"
                aria-label="More info"
            >
                <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {open && (
                <span
                    role="tooltip"
                    className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-sm bg-charcoal text-paper text-xs leading-snug normal-case tracking-normal font-sans shadow-lg"
                >
                    {text}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-charcoal" />
                </span>
            )}
        </span>
    );
};

export default Tooltip;
