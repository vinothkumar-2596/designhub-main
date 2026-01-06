import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

interface LottieLoaderProps {
    src: string;
    className?: string;
}

export function LottieLoader({ src, className }: LottieLoaderProps) {
    const [animationData, setAnimationData] = useState<any>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        // Try to fetch the .lottie file and convert to JSON
        const fetchAnimation = async () => {
            try {
                // Try .json extension first
                const jsonUrl = src.replace('.lottie', '.json');
                const response = await fetch(jsonUrl);

                if (response.ok) {
                    const data = await response.json();
                    setAnimationData(data);
                } else {
                    // Try original URL
                    const lottieResponse = await fetch(src);
                    if (lottieResponse.ok) {
                        const data = await lottieResponse.json();
                        setAnimationData(data);
                    } else {
                        setError(true);
                    }
                }
            } catch (err) {
                console.error('Failed to load Lottie animation:', err);
                setError(true);
            }
        };

        fetchAnimation();
    }, [src]);

    if (error || !animationData) {
        return null; // Return null to hide on error
    }

    return (
        <Lottie
            animationData={animationData}
            loop
            autoplay
            className={className}
        />
    );
}
