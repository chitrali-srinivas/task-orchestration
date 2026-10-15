"use client";

import { motion } from "framer-motion";

export function MapAnimation() {
    return (
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice">
                {/* Simplified World Map Path (Conceptual) */}
                <path
                    d="M200,100 Q400,50 600,150 T900,100" // Placeholder for actual map data
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                />

                {/* Journey Line */}
                <motion.path
                    d="M700,200 Q600,250 500,220 T200,180" // Punjab (approx) -> Mumbai -> Ocean -> LA
                    fill="none"
                    stroke="#556B2F"
                    strokeWidth="3"
                    strokeDasharray="10 5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3, ease: "easeInOut", delay: 1 }}
                />

                {/* Points */}
                <motion.circle cx="700" cy="200" r="5" fill="#D4AF37" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 }} />
                <motion.circle cx="200" cy="180" r="5" fill="#D4AF37" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 4 }} />

                {/* Labels */}
                <motion.text x="710" y="200" fill="#1a1a1a" fontSize="12" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>Punjab</motion.text>
                <motion.text x="210" y="180" fill="#1a1a1a" fontSize="12" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.2 }}>California</motion.text>
            </svg>

            {/* Background Map Image (Using a clean SVG or Image) */}
            <div className="absolute inset-0 -z-10 bg-[url('https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg')] bg-contain bg-no-repeat bg-center opacity-30 grayscale" />
        </div>
    );
}
