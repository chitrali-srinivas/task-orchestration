"use client";

import { motion } from "framer-motion";
import { Playfair_Display } from "next/font/google";
import { cn } from "@/lib/utils";
import { Globe, Sprout, ShieldCheck, Users } from "lucide-react";

const playfair = Playfair_Display({ subsets: ["latin"] });

export function AboutSection() {
    return (
        <section id="about" className="py-24 bg-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/3 h-full bg-[#F5F5DC]/30 -skew-x-12 translate-x-1/2" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <h2 className={cn("text-4xl font-bold text-[#1a1a1a] mb-6", playfair.className)}>
                        Our Mission: Empowering Farmers, Restoring Earth
                    </h2>
                    <p className="text-lg text-gray-600 leading-relaxed">
                        Our "Farmer First Carbon Removal" mission aims to increase smallholder incomes while sequestering CO₂ for 10,000+ years. We provide ERW soil supplements that act as natural fertilizer, reducing costs and boosting resilience against pests and inconsistent rains.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-16 items-center">
                    {/* Visual: Map / Infographic Placeholder */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="relative bg-[#F9F8F6] rounded-3xl p-8 aspect-[4/3] flex items-center justify-center border border-gray-100 shadow-inner"
                    >
                        <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg')] bg-contain bg-no-repeat bg-center opacity-10" />

                        {/* Locations pinned */}
                        <div className="absolute top-[40%] left-[65%] flex flex-col items-center">
                            <span className="w-4 h-4 bg-[#D4AF37] rounded-full animate-ping absolute" />
                            <span className="w-4 h-4 bg-[#D4AF37] rounded-full relative z-10 border-2 border-white" />
                            <span className="text-xs font-bold mt-1 bg-white px-2 py-0.5 rounded shadow">India</span>
                        </div>
                        <div className="absolute top-[55%] left-[55%] flex flex-col items-center">
                            <span className="w-3 h-3 bg-[#556B2F] rounded-full relative z-10 border-2 border-white" />
                            <span className="text-xs font-bold mt-1 bg-white px-2 py-0.5 rounded shadow">Tanzania</span>
                        </div>
                        <div className="absolute top-[60%] left-[55%] flex flex-col items-center">
                            <span className="w-3 h-3 bg-[#556B2F] rounded-full relative z-10 border-2 border-white" />
                            <span className="text-xs font-bold mt-1 bg-white px-2 py-0.5 rounded shadow">Zambia</span>
                        </div>
                        <div className="absolute top-[35%] left-[20%] flex flex-col items-center">
                            <span className="w-3 h-3 bg-[#556B2F] rounded-full relative z-10 border-2 border-white" />
                            <span className="text-xs font-bold mt-1 bg-white px-2 py-0.5 rounded shadow">USA</span>
                        </div>
                    </motion.div>

                    {/* Content: Value Props */}
                    <div className="space-y-12">
                        <ValueProp
                            icon={<Sprout className="w-6 h-6" />}
                            title="Natural & Durable"
                            desc="We use Enhanced Rock Weathering to permanently lock CO₂ in aquifers and oceans. It's a natural process, accelerated safely."
                        />
                        <ValueProp
                            icon={<Users className="w-6 h-6" />}
                            title="Impactful Yields"
                            desc="Farmers see up to 20% increase in yields (e.g., 10 bags vs 6-7). Stronger plants, better water retention, and healthier soil."
                        />
                        <ValueProp
                            icon={<ShieldCheck className="w-6 h-6" />}
                            title="Science-Backed MRV"
                            desc="Developed by a global consortium of scientists. We ensure vigorous Measurement, Reporting, and Verification for every ton removed."
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

function ValueProp({ icon, title, desc }: any) {
    return (
        <div className="flex gap-4">
            <div className="w-12 h-12 bg-[#556B2F]/10 text-[#556B2F] rounded-full flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div>
                <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">{title}</h3>
                <p className="text-gray-600 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}
