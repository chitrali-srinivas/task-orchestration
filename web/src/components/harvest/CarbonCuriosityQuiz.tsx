"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Check, ArrowRight, ChevronRight, Mountain, Droplets, Ship, Sprout, X } from "lucide-react";
import { cn } from "@/lib/utils";

const questions = [
    {
        id: 1,
        text: "How do you reduce your carbon footprint daily?",
        options: [
            { text: "Eat local / organic", type: "Beginner", score: 1 },
            { text: "Track emissions via apps", type: "Enthusiast", score: 2 },
            { text: "Advocate for policy changes", type: "Expert", score: 3 },
        ],
        icon: <Leaf className="w-6 h-6 text-green-600" />,
    },
    {
        id: 2,
        text: "Why choose regenerative rice?",
        options: [
            { text: "Tastes better", type: "Beginner", score: 1 },
            { text: "Supports soil health", type: "Enthusiast", score: 2 },
            { text: "Sequester CO₂ via ERW", type: "Expert", score: 3 },
        ],
        icon: <Sprout className="w-6 h-6 text-emerald-600" />,
    },
    {
        id: 3,
        text: "What's your take on carbon removal?",
        options: [
            { text: "New to it", type: "Beginner", score: 1 },
            { text: "Trees are key", type: "Enthusiast", score: 2 },
            { text: "Tech like ERW is revolutionary", type: "Expert", score: 3 },
        ],
        icon: <Mountain className="w-6 h-6 text-gray-600" />,
    },
];

export function CarbonCuriosityQuiz() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentQ, setCurrentQ] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [showERW, setShowERW] = useState(false); // For the ERW journey part

    const handleAnswer = (points: number) => {
        setScore(s => s + points);
        if (currentQ < questions.length - 1) {
            setCurrentQ(c => c + 1);
        } else {
            setShowResult(true);
        }
    };

    const reset = () => {
        setIsOpen(false);
        setCurrentQ(0);
        setScore(0);
        setShowResult(false);
        setShowERW(false);
    };

    const getPersona = () => {
        if (score <= 4) return { title: "Carbon Beginner", msg: "Start with tracing your rice!", color: "text-green-600" };
        if (score <= 7) return { title: "Eco Enthusiast", msg: "Explore how ERW cuts emissions by 20%.", color: "text-emerald-600" };
        return { title: "Sustainability Expert", msg: "Deep dive: MATI's MRV data on 0.35t CO₂ per batch.", color: "text-[#556B2F]" };
    };

    const persona = getPersona();

    return (
        <>
            {/* Trigger Button */}
            <div className="flex justify-center py-8">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(true)}
                    className="relative group overflow-hidden rounded-full px-8 py-3 bg-gradient-to-r from-[#556B2F] to-[#7C9082] text-white font-medium shadow-lg"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        What's Your Carbon Curiosity? <ChevronRight className="w-4 h-4" />
                    </span>
                    <div className="absolute inset-0 bg-white/20 group-hover:animate-pulse" />
                </motion.button>
            </div>

            {/* Quiz Modal */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-[#F9F8F6] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto"
                        >
                            {/* Close Button */}
                            <button onClick={reset} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
                                <X className="w-6 h-6" />
                            </button>

                            <div className="p-8">
                                {!showResult ? (
                                    <div className="space-y-6">
                                        {/* Progress */}
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-[#556B2F]"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                                            />
                                        </div>

                                        {/* Question */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 mb-2">
                                                {questions[currentQ].icon}
                                                <span className="text-sm font-bold text-[#556B2F] uppercase tracking-wider">Question {currentQ + 1}/{questions.length}</span>
                                            </div>
                                            <h2 className="text-2xl font-bold text-[#1a1a1a] font-serif">
                                                {questions[currentQ].text}
                                            </h2>
                                            
                                            <div className="space-y-3 mt-6">
                                                {questions[currentQ].options.map((opt, i) => (
                                                    <motion.button
                                                        key={i}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.1 }}
                                                        onClick={() => handleAnswer(opt.score)}
                                                        className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-[#556B2F] hover:bg-[#556B2F]/5 transition-all flex items-center justify-between group"
                                                    >
                                                        <span className="font-medium text-gray-700 group-hover:text-[#1a1a1a]">{opt.text}</span>
                                                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-[#556B2F] transition-opacity" />
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {/* Result Header */}
                                        <div className="text-center space-y-2">
                                            <motion.div 
                                                initial={{ scale: 0 }} 
                                                animate={{ scale: 1 }} 
                                                className="w-20 h-20 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-4"
                                            >
                                                <Leaf className={cn("w-10 h-10", persona.color)} />
                                            </motion.div>
                                            <h2 className="text-3xl font-bold font-serif text-[#1a1a1a]">You're a {persona.title}!</h2>
                                            <p className="text-gray-600">{persona.msg}</p>
                                            <p className="text-sm font-medium text-[#556B2F]">Your curiosity helps restore 2.3 acres like Anita&apos;s farm.</p>
                                        </div>

                                        {/* ERW Explanation & Journey */}
                                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                                                <Mountain className="w-5 h-5 text-gray-400" />
                                                The Science: Rocks as Sponges
                                            </h3>
                                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                                Enhanced Rock Weathering (ERW) is like giving nature a speed boost. We spread crushed basalt rock on farms. These &quot;rock sponges&quot; react with rainwater to soak up CO₂ permanently, turning it into healthy soil nutrients.
                                            </p>
                                            
                                            {/* Visual Journey Timeline */}
                                            <div className="relative pl-4 border-l-2 border-gray-100 space-y-6 my-6">
                                                <TimelineStep 
                                                    icon={<Mountain className="w-4 h-4 text-gray-500" />}
                                                    title="1. Rock Crushing"
                                                    desc="Basalt rocks are crushed into dust to increase surface area."
                                                    delay={0.2}
                                                />
                                                <TimelineStep 
                                                    icon={<Leaf className="w-4 h-4 text-[#556B2F]" />}
                                                    title="2. Spreading on Farms"
                                                    desc="Dust is spread on Anita's field. It's safe and chemical-free."
                                                    delay={1.5} // delayed appearance
                                                />
                                                <TimelineStep 
                                                    icon={<Droplets className="w-4 h-4 text-blue-400" />}
                                                    title="3. CO₂ Capture"
                                                    desc="Rain + Rock + CO₂ = Carbon locked away for centuries."
                                                    delay={2.8}
                                                />
                                                <TimelineStep 
                                                    icon={<Ship className="w-4 h-4 text-amber-600" />}
                                                    title="4. Sustainable Journey"
                                                    desc="Rice travels to California with controlled emissions."
                                                    delay={4.0}
                                                />
                                            </div>
                                        </div>

                                        {/* CTA */}
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => {
                                                    reset();
                                                    document.getElementById('journey')?.scrollIntoView({ behavior: 'smooth' });
                                                }}
                                                className="flex-1 py-3 rounded-full bg-[#1a1a1a] text-white font-medium hover:bg-gray-800 transition-colors"
                                            >
                                                Trace a Batch Now
                                            </button>
                                            <button 
                                                onClick={reset}
                                                className="px-6 py-3 rounded-full border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function TimelineStep({ icon, title, desc, delay }: any) {
    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration: 0.5 }}
            className="relative"
        >
            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-[#556B2F]" />
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{icon}</div>
                <div>
                    <h4 className="text-sm font-bold text-[#1a1a1a]">{title}</h4>
                    <p className="text-xs text-gray-500">{desc}</p>
                </div>
            </div>
        </motion.div>
    );
}

