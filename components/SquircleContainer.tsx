import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';

interface SquircleProps {
    children: React.ReactNode;
    className?: string;
    bgClassName?: string;
    cornerRadius?: number; // Base radius info
    backgroundColor?: string;
}

// Helper to generate a "smooth" corner path data 
// Approximating Figma's "60% smoothing" or iOS squircle
// We'll use a double-bezier approach for each corner to get that "continuous curvature" look.
const getSquirclePath = (w: number, h: number, r: number) => {
    if (w <= 0 || h <= 0) return "";

    // Constrain radius
    const R = Math.min(w / 2, h / 2, r);

    // Smoothing factor (0 = round rect, 1 = max smoothness). 
    // 0.6 is a good "Apple-like" smoothing.
    // Effectively, we extend the curve start points further along the edge.
    const cornerRatio = 0.6;
    const smoothR = R * (1 + cornerRatio);
    // Ensure we don't overlap in the middle
    const limitedR = Math.min(w / 2, h / 2, smoothR);

    const handleLen = limitedR * 0.9; // Much stronger pull than 0.55

    // Path Segments
    return `
    M 0 ${limitedR}
    C 0 ${limitedR - handleLen}, ${limitedR - handleLen} 0, ${limitedR} 0
    L ${w - limitedR} 0
    C ${w - limitedR + handleLen} 0, ${w} ${limitedR - handleLen}, ${w} ${limitedR}
    L ${w} ${h - limitedR}
    C ${w} ${h - limitedR + handleLen}, ${w - limitedR + handleLen} ${h}, ${w - limitedR} ${h}
    L ${limitedR} ${h}
    C ${limitedR - handleLen} ${h}, 0 ${h - limitedR + handleLen}, 0 ${h - limitedR}
    Z
  `.replace(/\n/g, ' ');
};

export const SquircleContainer: React.FC<SquircleProps> = ({
    children,
    className = "",
    bgClassName = "",
    cornerRadius = 48, // Default ~3rem
    backgroundColor
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });

    const updateSize = () => {
        if (containerRef.current) {
            setDims({
                w: containerRef.current.offsetWidth,
                h: containerRef.current.offsetHeight
            });
        }
    };

    // Observe resize
    useLayoutEffect(() => {
        updateSize();
        const observer = new ResizeObserver(() => updateSize());
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    const pathData = getSquirclePath(dims.w, dims.h, cornerRadius);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Background Layer with Shadow and Shape */}
            {dims.w > 0 && (
                <svg
                    className={`absolute inset-0 w-full h-full pointer-events-none transition-colors duration-200 ${bgClassName}`}
                    style={{
                        // We apply drop shadow to the SVG element which will cast based on the filled Path
                        filter: 'drop-shadow(0 25px 50px rgba(0, 0, 0, 0.25))'
                    }}
                >
                    <path d={pathData} fill={backgroundColor || "currentColor"} />
                </svg>
            )}

            {/* Content Layer */}
            {/* Note: Content is NOT clipped by default to allow scrolling internally if needed, 
          but usually we want to respect the shape. 
          Given the user requests the "shape", effectively the background is what matters. 
          The text will sit inside. */}
            <div className="relative z-10 h-full w-full">
                {children}
            </div>
        </div>
    );
};
