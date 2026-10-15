"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";
import { Playfair_Display } from "next/font/google";
import { cn } from "@/lib/utils";

const playfair = Playfair_Display({ subsets: ["latin"] });

export function HeroSection() {
    return (
        <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden bg-[#F9F8F6] py-20 md:py-0">
            {/* Background Parallax Effect (Simplified) */}
            <div className="absolute inset-0 z-0 opacity-20">
                <Image
                    src="https://images.unsplash.com/photo-1536617621972-2d1ae55a507a?q=80&w=2938&auto=format&fit=crop"
                    alt="Rice Field Background"
                    fill
                    className="object-cover"
                />
            </div>

            <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/50 to-[#F9F8F6] z-0" />

            <div className="relative z-10 max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1 }}
                    className="space-y-6 text-center md:text-left order-2 md:order-1"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#556B2F]/10 text-[#556B2F] text-xs md:text-sm font-bold tracking-wider">
                        <Leaf className="w-4 h-4" /> FARMER-FIRST CARBON REMOVAL
                    </div>
                    <h1 className={cn("text-4xl md:text-6xl font-bold text-[#1a1a1a] leading-[1.1] mb-6", playfair.className)}>
                        <span className="block text-[#556B2F]">MATI Harvest:</span> Trace Your Net Zero Journey.
                    </h1>
                    <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-lg mx-auto md:mx-0 mb-8">
                        We scale gigaton carbon removal via Enhanced Rock Weathering, building climate resilience and economic empowerment for over 100 million smallholder farmers.
                        <br /><br />
                        Serve your family net zero, traceable rice that restores the earth.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
                        <Link href="/harvest/scan" className="w-full sm:w-auto">
                            <button className="px-8 py-4 bg-[#1a1a1a] text-white rounded-full font-medium hover:bg-gray-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2 w-full">
                                Scan Your Pack <ArrowRight className="w-5 h-5" />
                            </button>
                        </Link>
                        <button className="px-8 py-4 bg-white text-[#1a1a1a] border border-gray-200 rounded-full font-medium hover:bg-gray-50 transition-all shadow-md w-full sm:w-auto">
                            Carbon Curiosity Quiz
                        </button>
                    </div>
                </motion.div>

                {/* Visual: Rice Bag Morph (Simplified for now as high quality image) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="relative order-1 md:order-2"
                >
                    <div className="relative w-full aspect-square max-w-[320px] md:max-w-[500px] mx-auto">
                        {/* Glowing effect behind */}
                        <div className="absolute inset-0 bg-[#D4AF37]/20 rounded-full blur-3xl animate-pulse" />

                        <Image
                            src="/mati-rice-bag.png"
                            alt="Mati Rice Bag"
                            width={500}
                            height={600}
                            className="object-contain relative z-10 drop-shadow-2xl"
                        />

                        {/* Floating Elements - Adjusted for Mobile */}
                        <motion.div
                            className="absolute -right-2 top-10 md:-right-4 md:top-20 bg-white p-3 md:p-4 rounded-xl shadow-lg border border-gray-100 flex items-center gap-3 z-20 scale-90 md:scale-100 origin-right"
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-[#556B2F]/10 rounded-full flex items-center justify-center text-[#556B2F]">
                                CO₂
                            </div>
                            <div>
                                <div className="text-sm font-bold text-gray-900">-0.35t Removed</div>
                                <div className="text-[10px] md:text-xs text-gray-500">Per batch</div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="absolute -left-2 bottom-10 md:-left-4 md:bottom-20 bg-white p-3 md:p-4 rounded-xl shadow-lg border border-gray-100 flex items-center gap-3 z-20 scale-90 md:scale-100 origin-left"
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        >
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-[#D4AF37]/10 rounded-full flex items-center justify-center text-[#D4AF37] font-bold">
                                20%
                            </div>
                            <div>
                                <div className="text-sm font-bold text-gray-900">Yield Increase</div>
                                <div className="text-[10px] md:text-xs text-gray-500">For farmers</div>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
