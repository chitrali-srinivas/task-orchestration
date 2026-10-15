"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Check, ChevronRight, Info, Truck, MapPin, CloudRain, Mountain, Sprout, X } from "lucide-react";
import { cn } from "@/lib/utils";

type QuizState = "intro" | "question" | "result";
type Archetype = "Beginner" | "Enthusiast" | "Expert";

const QUESTIONS = [
    {
        id: 1,
        question: "How do you reduce your carbon footprint daily?",
        options: [
            { text: "Eat local/organic", score: 1 },
            { text: "Track emissions via apps", score: 2 },
            { text: "Advocate for policy changes", score: 3 },
        ],
    },
    {
        id: 2,
        question: "Why choose regenerative rice?",
        options: [
            { text: "It tastes better", score: 1 },
            { text: "Supports soil health", score: 2 },
            { text: "Sequesters CO₂ via ERW", score: 3 },
        ],
    },
    {
        id: 3,
        question: "What's your take on carbon removal?",
        options: [
            { text: "New to it", score: 1 },
            { text: "Planting trees is key", score: 2 },
            { text: "Tech like ERW is revolutionary", score: 3 },
        ],
    },
];

export function CarbonQuiz() {
    const [state, setState] = useState<QuizState>("intro");
    const [currentQ, setCurrentQ] = useState(0);
    const [score, setScore] = useState(0);
    const [archetype, setArchetype] = useState<Archetype>("Beginner");

    const handleAnswer = (points: number) => {
        const newScore = score + points;
        setScore(newScore);

        if (currentQ < QUESTIONS.length - 1) {
            setCurrentQ(currentQ + 1);
        } else {
            // Determine result
            if (newScore <= 4) setArchetype("Beginner");
            else if (newScore <= 7) setArchetype("Enthusiast");
            else setArchetype("Expert");
            setState("result");
        }
    };

    return (
        <section className="py-16 px-6 bg-[#F5F5DC]/30 border-y border-[#556B2F]/10 relative overflow-hidden">
            <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
            
            <div className="max-w-2xl mx-auto relative z-10">
                <AnimatePresence mode="wait">
                    {state === "intro" && (
                        <QuizIntro onStart={() => setState("question")} />
                    )}
                    {state === "question" && (
                        <QuizQuestion
                            key={currentQ}
                            data={QUESTIONS[currentQ]}
                            total={QUESTIONS.length}
                            current={currentQ + 1}
                            onAnswer={handleAnswer}
                        />
                    )}
                    {state === "result" && (
                        <QuizResult archetype={archetype} />
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
}

function QuizIntro({ onStart }: { onStart: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-6 bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-lg border border-[#556B2F]/10"
        >
            <div className="w-16 h-16 bg-[#556B2F]/10 rounded-full flex items-center justify-center mx-auto text-[#556B2F]">
                <Leaf className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold text-[#1a1a1a] font-serif">What's Your Carbon Curiosity?</h2>
            <p className="text-gray-600 text-lg">
                Take this 30-second quiz to discover your impact level and see how your rice choices can restore the planet.
            </p>
            <button
                onClick={onStart}
                className="px-8 py-4 bg-[#1a1a1a] text-white rounded-full font-medium hover:bg-gray-800 transition-all shadow-lg hover:scale-105"
            >
                Take the Quiz
            </button>
        </motion.div>
    );
}

function QuizQuestion({ data, total, current, onAnswer }: { data: any, total: number, current: number, onAnswer: (s: number) => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="bg-white/90 backdrop-blur p-8 rounded-3xl shadow-xl border border-[#556B2F]/10"
        >
            <div className="flex justify-between items-center mb-6 text-sm font-medium text-gray-500">
                <span>Question {current} of {total}</span>
                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-[#556B2F]"
                        initial={{ width: `${((current - 1) / total) * 100}%` }}
                        animate={{ width: `${(current / total) * 100}%` }}
                    />
                </div>
            </div>

            <h3 className="text-2xl font-bold text-[#1a1a1a] mb-8 font-serif">{data.question}</h3>

            <div className="space-y-3">
                {data.options.map((opt: any, idx: number) => (
                    <button
                        key={idx}
                        onClick={() => onAnswer(opt.score)}
                        className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-[#556B2F] hover:bg-[#556B2F]/5 transition-all flex items-center group"
                    >
                        <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm font-bold mr-4 group-hover:bg-[#556B2F] group-hover:text-white transition-colors">
                            {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-gray-700 font-medium group-hover:text-[#1a1a1a]">{opt.text}</span>
                        <ChevronRight className="ml-auto w-5 h-5 text-gray-300 group-hover:text-[#556B2F] opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                ))}
            </div>
        </motion.div>
    );
}

function QuizResult({ archetype }: { archetype: Archetype }) {
    const [showVisual, setShowVisual] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/95 backdrop-blur p-8 rounded-3xl shadow-2xl border border-[#556B2F]/20 text-center relative overflow-hidden"
        >
            {/* Confetti/Leaves Effect could go here */}
            
            <div className="relative z-10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#556B2F] mb-2">Your Result</h3>
                <h2 className="text-4xl font-bold text-[#1a1a1a] mb-4 font-serif">You're a Carbon {archetype}!</h2>
                
                <p className="text-gray-600 mb-8 leading-relaxed">
                    {archetype === "Beginner" && "You're starting your journey! Every choice counts. Discover how traceble rice makes an impact."}
                    {archetype === "Enthusiast" && "You know your stuff! You understand that soil health is key to a sustainable future."}
                    {archetype === "Expert" && "Impressive! You're ready for the deep science of Enhanced Rock Weathering and verified carbon removal."}
                </p>

                <div className="bg-[#F9F8F6] rounded-2xl p-6 mb-8 border border-[#556B2F]/10 text-left">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#556B2F]/10 rounded-full text-[#556B2F]">
                            <Info className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-[#1a1a1a] mb-2">How MATI Works (ERW)</h4>
                            <p className="text-sm text-gray-600 mb-4">
                                Think of crushed rocks as <strong>sponges for CO₂</strong>. When spread on Anita's farm in Punjab, they react with rain and air to permanently lock carbon in the soil.
                            </p>
                            <button 
                                onClick={() => setShowVisual(!showVisual)}
                                className="text-sm font-bold text-[#556B2F] hover:underline flex items-center gap-1"
                            >
                                {showVisual ? "Hide" : "See the Visual Journey"} <ChevronRight className={cn("w-4 h-4 transition-transform", showVisual && "rotate-90")} />
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {showVisual && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="pt-6 border-t border-gray-200 mt-6">
                                    <VisualERWJourney />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                        onClick={() => document.getElementById("journey")?.scrollIntoView({ behavior: "smooth" })}
                        className="px-8 py-4 bg-[#1a1a1a] text-white rounded-full font-medium hover:bg-gray-800 transition-all shadow-lg hover:-translate-y-1"
                    >
                        Trace a Batch
                    </button>
                    <button 
                        onClick={() => document.getElementById("farmer-story")?.scrollIntoView({ behavior: "smooth" })}
                        className="px-8 py-4 bg-white border-2 border-gray-200 text-[#1a1a1a] rounded-full font-medium hover:border-[#1a1a1a] transition-all"
                    >
                        Meet the Farmers
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

function VisualERWJourney() {
    const steps = [
        { icon: <Mountain className="w-5 h-5" />, label: "Rocks Crushed", desc: "Basalt rock is crushed into dust." },
        { icon: <Sprout className="w-5 h-5" />, label: "Spread on Farm", desc: "Applied to Anita's fields in Punjab." },
        { icon: <CloudRain className="w-5 h-5" />, label: "CO₂ Capture", desc: "Rain reacts with rock dust, locking carbon." },
        { icon: <Truck className="w-5 h-5" />, label: "To Your Shelf", desc: "Rice grows healthy; carbon stays locked." },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-4 gap-2 relative">
                {/* Connecting Line */}
                <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200 -z-10" />
                
                {steps.map((step, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.3 }}
                        className="flex flex-col items-center text-center"
                    >
                        <motion.div 
                            className="w-10 h-10 rounded-full bg-white border-2 border-[#556B2F] flex items-center justify-center text-[#556B2F] mb-2 shadow-sm z-10"
                            whileHover={{ scale: 1.1 }}
                        >
                            {step.icon}
                        </motion.div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Step {i + 1}</p>
                        <p className="text-xs font-bold text-[#1a1a1a] leading-tight">{step.label}</p>
                    </motion.div>
                ))}
            </div>
            
            {/* Animation Demo Area */}
            <div className="h-24 bg-[#F0F4F8] rounded-xl relative overflow-hidden border border-gray-200">
                {/* Animated Particles */}
                {[...Array(5)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-gray-400 rounded-full opacity-50"
                        initial={{ x: -10, y: 20 }}
                        animate={{ x: 400, y: [20, 40, 20] }}
                        transition={{ duration: 3, repeat: Infinity, delay: i * 0.5, ease: "linear" }}
                    />
                ))}
                <div className="absolute bottom-0 left-0 w-full h-2 bg-[#D4AF37]/30" /> {/* Soil */}
                <div className="absolute center text-xs text-gray-400 w-full text-center top-10">
                    Visualizing the carbon capture process...
                </div>
            </div>
        </div>
    );
}

