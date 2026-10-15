"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Trees, Wind, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImpactCalculatorProps {
    className?: string;
}

export function ImpactCalculator({ className }: ImpactCalculatorProps) {
    const [bags, setBags] = useState(1);
    const [co2, setCo2] = useState(0.35);
    const [trees, setTrees] = useState(7);
    const [water, setWater] = useState(2500);

    // Update stats when bags change
    useEffect(() => {
        setCo2(parseFloat((bags * 0.35).toFixed(2)));
        setTrees(Math.round(bags * 7));
        setWater(bags * 2500);
    }, [bags]);

    const increment = () => setBags((prev) => Math.min(prev + 1, 100));
    const decrement = () => setBags((prev) => Math.max(prev - 1, 1));

    return (
        <div className={cn("bg-white rounded-3xl p-8 shadow-xl border border-[#7C9082]/20", className)}>
            <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-[#1a1a1a] mb-2">Calculate Your Impact</h3>
                <p className="text-gray-600">See how your purchase helps the planet.</p>
            </div>

            {/* Input Control */}
            <div className="flex items-center justify-center gap-6 mb-10">
                <button
                    onClick={decrement}
                    className="w-10 h-10 rounded-full bg-[#F5F5DC] text-[#556B2F] flex items-center justify-center hover:bg-[#556B2F] hover:text-white transition-colors"
                >
                    <Minus className="w-5 h-5" />
                </button>
                <div className="text-center">
                    <div className="text-3xl font-bold text-[#1a1a1a]">{bags}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Bags of Rice</div>
                </div>
                <button
                    onClick={increment}
                    className="w-10 h-10 rounded-full bg-[#F5F5DC] text-[#556B2F] flex items-center justify-center hover:bg-[#556B2F] hover:text-white transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-6">
                {/* CO2 Stat */}
                <div className="relative overflow-hidden rounded-2xl bg-[#F9F8F6] p-6 group">
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#556B2F] shadow-sm">
                                <Wind className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-gray-700">CO₂ Sequestered</span>
                        </div>
                        <div className="text-right">
                            <motion.div
                                key={co2}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="text-2xl font-bold text-[#1a1a1a]"
                            >
                                {co2}t
                            </motion.div>
                        </div>
                    </div>
                    {/* Progress Bar Background */}
                    <motion.div
                        className="absolute bottom-0 left-0 h-1 bg-[#556B2F]/20 w-full"
                    >
                        <motion.div
                            className="h-full bg-[#556B2F]"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(bags * 10, 100)}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </motion.div>
                </div>

                {/* Trees Stat */}
                <div className="relative overflow-hidden rounded-2xl bg-[#F9F8F6] p-6 group">
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#556B2F] shadow-sm">
                                <Trees className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-gray-700">Tree Equivalent</span>
                        </div>
                        <div className="text-right">
                            <motion.div
                                key={trees}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="text-2xl font-bold text-[#1a1a1a]"
                            >
                                {trees}
                            </motion.div>
                        </div>
                    </div>
                    <motion.div
                        className="absolute bottom-0 left-0 h-1 bg-[#556B2F]/20 w-full"
                    >
                        <motion.div
                            className="h-full bg-[#556B2F]"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(bags * 5, 100)}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </motion.div>
                </div>

                {/* Water Stat */}
                <div className="relative overflow-hidden rounded-2xl bg-[#F9F8F6] p-6 group">
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#556B2F] shadow-sm">
                                <Leaf className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-gray-700">Water Saved (L)</span>
                        </div>
                        <div className="text-right">
                            <motion.div
                                key={water}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="text-2xl font-bold text-[#1a1a1a]"
                            >
                                {water.toLocaleString()}
                            </motion.div>
                        </div>
                    </div>
                    <motion.div
                        className="absolute bottom-0 left-0 h-1 bg-[#556B2F]/20 w-full"
                    >
                        <motion.div
                            className="h-full bg-[#556B2F]"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(bags * 2, 100)}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </motion.div>
                </div>
            </div>

            <div className="mt-8 text-center">
                <p className="text-sm text-gray-500 italic">
                    *Estimates based on comparative LCA data vs. conventional paddy rice.
                </p>
            </div>
        </div>
    );
}
