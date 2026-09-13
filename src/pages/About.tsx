
import { useSettings } from '../context/SettingsContext';

const About = () => {
    const { settings } = useSettings();
    const paragraphs = settings.aboutText.split(/\n{2,}/).filter(Boolean);

    return (
        <div className="min-h-screen bg-paper pt-24 pb-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-4xl md:text-5xl text-charcoal font-serif mb-12 text-center">{settings.aboutHeadline}</h1>

                <div className="prose prose-lg prose-stone mx-auto font-serif">
                    {settings.aboutQuote && (
                        <p className="lead text-2xl text-charcoal/80 mb-8 italic">
                            {settings.aboutQuote}
                        </p>
                    )}
                    {paragraphs.map((paragraph, idx) => (
                        <p key={idx} className="mb-6">
                            {paragraph}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default About;
