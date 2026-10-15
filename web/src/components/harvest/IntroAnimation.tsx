"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface IntroAnimationProps {
    onComplete: () => void;
}

type Phase = "fade-in" | "co2-orbit" | "absorb" | "green-logo" | "bag-reveal" | "fly-out" | "complete";

export function IntroAnimation({ onComplete }: IntroAnimationProps) {
    const [phase, setPhase] = useState<Phase>("fade-in");
    const [particles, setParticles] = useState<Array<{ x: number, y: number }>>([]);

    useEffect(() => {
        setParticles([...Array(10)].map(() => ({
            x: (Math.random() - 0.5) * 260,
            y: (Math.random() - 0.5) * 260
        })));

        // Total sequence ~7s, kept lightweight for performance
        const timers: NodeJS.Timeout[] = [];

        timers.push(setTimeout(() => setPhase("co2-orbit"), 800)); // black -> farm
        timers.push(setTimeout(() => setPhase("absorb"), 2600));
        timers.push(setTimeout(() => setPhase("green-logo"), 4000));
        timers.push(setTimeout(() => setPhase("bag-reveal"), 5200));
        timers.push(setTimeout(() => setPhase("fly-out"), 6500));
        timers.push(
            setTimeout(() => {
                setPhase("complete");
                onComplete();
            }, 7200)
        );

        return () => {
            timers.forEach(clearTimeout);
        };
    }, [onComplete]);

    return (
        <AnimatePresence>
            {phase !== "complete" && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-[#F9F8F6]"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    {/* Punjab farm background fading in */}
                    <motion.div
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: phase === "fade-in" ? 0.3 : 0.6 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                    >
                        <Image
                            src="/Farm Satellite View.png"
                            alt="Punjab farm at dawn"
                            fill
                            priority
                            className="object-cover opacity-50 mix-blend-multiply"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#F9F8F6] via-[#F9F8F6]/60 to-transparent" />
                    </motion.div>

                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                        {/* CO2 Particles */}
                        {(phase === "co2-orbit" || phase === "absorb") && particles.length > 0 && (
                            <>
                                {particles.map((p, i) => (
                                    <motion.div
                                        key={i}
                                        className="absolute w-10 h-10 rounded-full bg-gray-400/20 border border-gray-600/10 flex items-center justify-center text-[10px] font-semibold text-gray-600"
                                        style={{
                                            transformOrigin: "center",
                                        }}
                                        initial={{
                                            opacity: 0,
                                            x: p.x,
                                            y: p.y,
                                        }}
                                        animate={
                                            phase === "co2-orbit"
                                                ? {
                                                      opacity: 1,
                                                      rotate: 360,
                                                      transition: {
                                                          duration: 6,
                                                          repeat: Infinity,
                                                          ease: "linear",
                                                      },
                                                  }
                                                : {
                                                      opacity: 0,
                                                      x: 0,
                                                      y: 0,
                                                      scale: 0.1,
                                                      transition: {
                                                          duration: 1.4,
                                                          ease: "easeInOut",
                                                      },
                                                  }
                                        }
                                    >
                                        CO₂
                                    </motion.div>
                                ))}
                            </>
                        )}

                        {/* Central Logo / Rice Bag */}
                        <motion.div
                            className="relative z-10"
                            animate={
                                phase === "fly-out"
                                    ? {
                                          // Nudge the bag toward the hero card position (left column, upper-middle)
                                          x: "-22vw",
                                          y: "-10vh",
                                          scale: 0.9,
                                      }
                                    : {}
                            }
                            transition={{ duration: 1.1, ease: "easeInOut" }}
                        >
                            {phase === "bag-reveal" || phase === "fly-out" ? (
                                <motion.div
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1.2, opacity: 1 }}
                                    transition={{ duration: 0.9, type: "spring" }}
                                >
                                    <Image
                                        src="/ricebag.png"
                                        alt="MATI Harvest Organic Indrayani Rice"
                                        width={220}
                                        height={320}
                                        className="object-contain drop-shadow-2xl"
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    className={cn(
                                        "w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold font-serif shadow-xl",
                                        phase === "absorb"
                                            ? "bg-[#1a1a1a] text-white"
                                            : phase === "green-logo"
                                                ? "bg-[#556B2F] text-white"
                                                : "bg-white text-[#1a1a1a] border border-[#1a1a1a]/10"
                                    )}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{
                                        opacity: 1,
                                        scale: phase === "absorb" ? 1.15 : 1,
                                    }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                >
                                    M
                                </motion.div>
                            )}
                        </motion.div>

                        {/* Text Overlay during phases */}
                        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center px-6 w-full">
                            <AnimatePresence mode="wait">
                                {(phase === "co2-orbit" || phase === "fade-in") && (
                                    <motion.p
                                        key="text1"
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -12 }}
                                        className="text-lg md:text-xl text-gray-700 max-w-xl mx-auto font-serif italic"
                                    >
                                        From a smallholder plot in Punjab...
                                    </motion.p>
                                )}
                                {phase === "absorb" && (
                                    <motion.p
                                        key="text2"
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -12 }}
                                        className="text-lg md:text-xl text-gray-800 font-medium max-w-xl mx-auto"
                                    >
                                        MATI&apos;s Enhanced Rock Weathering captures CO₂.
                                    </motion.p>
                                )}
                                {phase === "green-logo" && (
                                    <motion.p
                                        key="text3"
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -12 }}
                                        className="text-xl md:text-2xl text-[#556B2F] font-semibold max-w-2xl mx-auto"
                                    >
                                        Turning pollution into healthy soil.
                                    </motion.p>
                                )}
                                {(phase === "bag-reveal" || phase === "fly-out") && (
                                    <motion.p
                                        key="text4"
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -12 }}
                                        className="text-xl md:text-2xl text-[#1a1a1a] font-semibold max-w-2xl mx-auto"
                                    >
                                        Your rice helped remove <span className="text-[#556B2F]">0.35 tonnes of CO₂</span>.
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
