"use client";

import { motion } from "framer-motion";
import { Playfair_Display } from "next/font/google";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { QrCode, ArrowRight } from "lucide-react";
import Image from "next/image";

const playfair = Playfair_Display({ subsets: ["latin"] });

export function ScanTeaser() {
    return (
        <section className="py-24 bg-[#2C3E50] text-white relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />

            <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center relative z-10">
                <div>
                    <h2 className={cn("text-4xl md:text-5xl font-bold mb-6", playfair.className)}>
                        Know Your Food's <br /> <span className="text-[#D4AF37]">True Story</span>
                    </h2>
                    <p className="text-lg text-gray-300 leading-relaxed mb-8">
                        Most food labels tell you nothing. MATI Harvest gives you the full picture. From the exact farm in Punjab to the carbon removed from the atmosphere.
                    </p>

                    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl mb-8">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <span className="font-mono text-sm tracking-widest text-green-400">BATCH: MH-2025-PUN-042</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Farmer</span>
                                <span>Anita Singh</span>
                            </div>
                            <div className="w-full h-px bg-white/10" />
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Origin</span>
                                <span>Ludhiana, India</span>
                            </div>
                            <div className="w-full h-px bg-white/10" />
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Carbon Removed</span>
                                <span className="text-[#D4AF37] font-bold"> -0.35 tonnes</span>
                            </div>
                        </div>
                    </div>

                    <Link href="/harvest/scan">
                        <button className="px-8 py-4 bg-[#D4AF37] text-[#1a1a1a] rounded-full font-bold hover:bg-[#c4a030] transition-all flex items-center gap-2">
                            <QrCode className="w-5 h-5" />
                            Trace This Batch
                        </button>
                    </Link>
                </div>

                {/* Visual: Phone Mockup or Timeline graphic */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative"
                >
                    {/* Placeholder for Phone Mockup */}
                    <div className="relative mx-auto border-gray-800 bg-gray-900 border-[8px] rounded-[2.5rem] h-[600px] w-[300px] shadow-2xl flex flex-col overflow-hidden">
                        <div className="h-[32px] w-[3px] bg-gray-800 absolute -start-[17px] top-[72px] rounded-s-lg"></div>
                        <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[124px] rounded-s-lg"></div>
                        <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[178px] rounded-s-lg"></div>
                        <div className="h-[64px] w-[3px] bg-gray-800 absolute -end-[17px] top-[142px] rounded-e-lg"></div>
                        <div className="rounded-[2rem] overflow-hidden w-full h-full bg-white text-black relative">
                            {/* Simple Mock UI inside phone */}
                            <div className="h-full w-full relative">
                                <div className="absolute top-0 w-full h-40 bg-gray-200">
                                    <Image src="/anita.jpeg" fill className="object-cover" alt="Anita" />
                                </div>
                                <div className="absolute top-32 left-4 right-4 bg-white p-4 rounded-xl shadow-lg">
                                    <h3 className="font-bold text-lg">This is Anita</h3>
                                    <p className="text-xs text-gray-500">Your Farmer</p>
                                </div>
                                <div className="absolute top-64 left-6 border-l-2 border-dashed border-gray-300 pl-6 space-y-8">
                                    <div className="relative">
                                        <div className="absolute -left-[29px] top-1 w-3 h-3 bg-green-500 rounded-full border border-white" />
                                        <div className="text-xs font-bold">Harvested</div>
                                        <div className="text-[10px] text-gray-500">March 15</div>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[29px] top-1 w-3 h-3 bg-gray-300 rounded-full border border-white" />
                                        <div className="text-xs font-bold">Processed</div>
                                        <div className="text-[10px] text-gray-500">March 20</div>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[29px] top-1 w-3 h-3 bg-gray-300 rounded-full border border-white" />
                                        <div className="text-xs font-bold">Shipped</div>
                                        <div className="text-[10px] text-gray-500">April 02</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
