"use client";

import { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { ArrowDown, MapPin, Leaf, Droplets, Sun, Truck, Ship, Store, ChevronRight, CheckCircle2, Sprout, Users, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { ImpactCalculator } from "@/components/harvest/ImpactCalculator";
import { Testimonials } from "@/components/harvest/Testimonials";
import { IntroAnimation } from "@/components/harvest/IntroAnimation";
import { MapAnimation } from "@/components/harvest/MapAnimation";
import { CarbonCuriosityQuiz } from "@/components/harvest/CarbonCuriosityQuiz";
import { Navbar } from "@/components/harvest/Navbar";

import dynamic from 'next/dynamic';

const JourneyMapWrapper = dynamic(() => import('@/components/harvest/JourneyMap'), {
    ssr: false,
    loading: () => <div className="h-screen w-full bg-[#E8E6D9] animate-pulse flex items-center justify-center text-gray-400">Loading Map...</div>
});

const playfair = Playfair_Display({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

export default function HarvestPage() {
    const [showIntro, setShowIntro] = useState(true);
    const targetRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start end", "end start"],
    });

    const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
    const scale = useTransform(scrollYProgress, [0, 0.5], [0.8, 1]);
    const parallaxY = useTransform(scrollYProgress, [0, 1], [0, 100]);

    return (
        <main className={cn("min-h-screen bg-[#F9F8F6] text-[#2C3E50]", inter.className)}>
            <Navbar />
            {/* Intro Animation Overlay */}
            {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}

            {/* 1. Hero Section (Redesigned) */}
            <section className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">
                {/* Parallax Background: Vines/Fields */}
                {!showIntro && (
                    <motion.div
                        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                        style={{ y: parallaxY }}
                    >
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/leaves.png')]" />
                    </motion.div>
                )}
                {/* Map Background Animation */}
                {!showIntro && <MapAnimation />}

                <div className="relative z-10 w-full max-w-6xl grid md:grid-cols-2 gap-12 items-center">
                    {/* Left: Impact Card with Rice Bag */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-white/50 relative"
                    >
                        <div className="absolute -top-12 -left-12 w-24 h-24 bg-[#556B2F]/10 rounded-full blur-2xl" />

                        <div className="flex flex-col items-center text-center">
                            <div className="relative w-64 h-80 mb-6">
                                <Image
                                    src="/ricebag.png"
                                    alt="Mati Harvest Rice"
                                    fill
                                    className="object-contain drop-shadow-xl"
                                />
                            </div>

                            <h2 className={cn("text-2xl font-bold text-[#1a1a1a] mb-2", playfair.className)}>
                                Your purchase helped
                            </h2>

                            <div className="grid grid-cols-2 gap-8 w-full mt-4">
                                <div>
                                    <div className="text-4xl font-bold text-[#556B2F]">0.35</div>
                                    <div className="text-sm text-gray-500">Tonnes of CO₂</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-[#556B2F]">3</div>
                                    <div className="text-sm text-gray-500">Families</div>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-100 w-full text-sm text-gray-600">
                                <p>0.35 Tonnes of CO₂ = CO₂ saved by <strong>3 🌳</strong> in a year</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right: Text Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.8 }}
                        className="text-center md:text-left space-y-6"
                    >
                        <h1 className={cn("text-4xl md:text-6xl font-bold leading-tight text-[#1a1a1a]", playfair.className)}>
                            Trace your <span className="text-[#556B2F]">MATI Harvest</span> pack from Anita&apos;s field to your shelf.
                        </h1>
                        <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-xl">
                            Follow Batch <span className="font-semibold text-[#556B2F]">#MH2025A</span> from
                            ERW-treated soil in Punjab, India to California, USA.
                        </p>

                        {/* CTA Button */}
                        <div className="mt-4 flex flex-col sm:flex-row gap-3 items-center md:items-start">
                            <button
                                type="button"
                                onClick={() => document.getElementById("farmer-story")?.scrollIntoView({ behavior: "smooth" })}
                                className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#1a1a1a] text-white text-lg font-medium hover:bg-gray-800 shadow-lg transition-transform hover:-translate-y-0.5"
                            >
                                Start the journey
                                <ChevronRight className="ml-2 w-5 h-5" />
                            </button>
                        </div>

                        <p className="pt-3 text-sm md:text-base text-gray-500 max-w-md">
                            Scroll to see how Enhanced Rock Weathering controls carbon emissions at every step.
                        </p>
                    </motion.div>
                </div>

                <motion.div
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[#556B2F]/50 cursor-pointer"
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    onClick={() => document.getElementById('farmer-story')?.scrollIntoView({ behavior: 'smooth' })}
                >
                    <div className="text-sm mb-2">Scroll to know more</div>
                    <ArrowDown className="w-6 h-6 mx-auto" />
                </motion.div>
            </section>

            {/* 2. Farmer Story Section (Redesigned) */}
            <section id="farmer-story" className="py-20 px-6 bg-white relative overflow-hidden" ref={targetRef}>
                {/* Background Texture */}
                <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/rice-paper.png')]" />

                <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-12 items-center relative z-10">
                    {/* Left: Large Portrait */}
                    <motion.div
                        style={{ opacity, scale }}
                        className="md:col-span-5 relative aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl"
                    >
                        <Image
                            src="/anita.jpeg"
                            alt="Anita, Rice Farmer"
                            fill
                            className="object-cover hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold text-[#1a1a1a] shadow-lg">
                            <MapPin className="w-4 h-4 text-[#D4AF37]" />
                            Ludhiana, Punjab
                        </div>

                        {/* Animation: Soil particles rising to form a subtle heart/aura on scroll */}
                        <SoilRiseAnimation />
                    </motion.div>

                    {/* Right: Content & Gallery */}
                    <div className="md:col-span-7 space-y-8">
                        <div>
                            <h2 className={cn("text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-4", playfair.className)}>
                                This is <span className="underline decoration-[#556B2F] decoration-4 underline-offset-4">Anita</span>
                            </h2>
                            <p className="text-lg text-gray-600 leading-relaxed">
                                A farmer from India with 2.5 Acres of farm land where she grew the rice you purchased, which was harvested on Sep 2025 using regenerative practices like SRI. She has been farming for 15 years and is a leader in her local women's farming collective.
                            </p>
                        </div>

                        {/* Quote Card */}
                        <div className="bg-[#F5F5DC] p-8 rounded-2xl border-l-4 border-[#D4AF37] relative">
                            <p className={cn("text-2xl italic text-[#1a1a1a] mb-4", playfair.className)}>
                                "The soil is our mother. If we heal her, she feeds us."
                            </p>
                            <div className="text-right font-bold text-[#556B2F]">- Anita</div>
                        </div>

                        {/* Mini Gallery */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative h-48 rounded-xl overflow-hidden group">
                                <Image
                                    src="/Farm Satellite View.png"
                                    alt="Farm Satellite View"
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                            </div>
                            <div className="relative h-48 rounded-xl overflow-hidden group">
                                <Image
                                    src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop"
                                    alt="Sunset over fields"
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Carbon Curiosity Quiz Section */}
            <section className="px-6 py-16 bg-white border-y border-[#E2E0D8]">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center space-y-4 mb-6">
                        <h2 className={cn("text-2xl md:text-3xl font-bold text-[#1a1a1a]", playfair.className)}>
                            What&apos;s Your Carbon Curiosity?
                        </h2>
                        <p className="text-gray-600 text-sm md:text-base max-w-2xl mx-auto">
                            Take a 30-second quiz to discover how your rice choices power Enhanced Rock Weathering,
                            from Anita&apos;s farm in Punjab to your shelf in California.
                        </p>
                    </div>
                    {/* Quiz renders its own primary button without extra background chrome */}
                    <CarbonCuriosityQuiz />
                </div>
            </section>

            {/* 3. The Journey (Interactive Map) */}
            <section id="journey" className="relative bg-[#F9F8F6]">
                <div className="py-20 px-6 text-center">
                    <h2 className={cn("text-3xl font-bold mb-4", playfair.className)}>The Journey of Your Rice</h2>
                    <p className="text-gray-600">From Punjab to California, traced at every step.</p>
                </div>

                <JourneyMapWrapper />
            </section>

            {/* 4. Farming & Certification Details */}
            <section className="py-20 px-6 bg-white relative overflow-hidden">
                {/* Animation: Rocks sprinkling (ERW) */}
                <RockSprinkleAnimation />

                <div className="max-w-5xl mx-auto relative z-10">
                    <div className="grid md:grid-cols-3 gap-8">
                        <CertificationCard
                            icon={<Leaf className="w-10 h-10 text-[#556B2F] mb-4" />}
                            title="Regenerative"
                            desc="Grown using System of Rice Intensification (SRI) to restore soil health."
                            popupTitle="System of Rice Intensification (SRI)"
                            popupDesc="A farming methodology aimed at increasing the yield of rice produced in farming. It uses less water, reduces costs, and improves soil health."
                        />
                        <CertificationCard
                            icon={<Droplets className="w-10 h-10 text-[#556B2F] mb-4" />}
                            title="Water Smart"
                            desc="Uses 30% less water than conventional paddy farming methods."
                            popupTitle="Water Conservation"
                            popupDesc="By alternating wetting and drying of rice fields, we reduce methane emissions and save millions of liters of water per acre."
                        />
                        <CertificationCard
                            icon={<Sun className="w-10 h-10 text-[#556B2F] mb-4" />}
                            title="Certified"
                            desc="Meets rigorous standards for organic and sustainable production."
                            popupTitle="Certifications"
                            popupContent={
                                <ul className="text-sm list-disc pl-4 space-y-1">
                                    <li><strong>USDA Organic:</strong> Grown without synthetic pesticides.</li>
                                    <li><strong>ROC Silver:</strong> Regenerative Organic Certified for soil health and fairness.</li>
                                </ul>
                            }
                            badges={["USDA Organic", "ROC Silver"]}
                        />
                    </div>
                </div>
            </section>

            {/* 5. Impact Calculator (Replaces Static Impact) */}
            <section className="py-20 px-6 bg-[#2C3E50] text-white relative overflow-hidden">
                {/* Floating CO2 Bubbles Background - Client Only */}
                <BackgroundBubbles />

                <div className="max-w-4xl mx-auto relative z-10">
                    <ImpactCalculator />
                </div>
            </section>

            {/* 6. Social Proof / Testimonials */}
            <Testimonials />

            {/* 7. Closing Section */}
            <section className="py-24 px-6 bg-[#F5F5DC] text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                </div>
                <div className="max-w-2xl mx-auto space-y-8 relative z-10">
                    <h2 className={cn("text-3xl md:text-4xl font-bold text-[#1a1a1a]", playfair.className)}>
                        Join the Regenerative Movement
                    </h2>
                    <p className="text-gray-600 text-lg">
                        MATI Harvest is on a mission to restore the earth, one grain at a time. Learn more about our science and our farmers.
                    </p>
                    <button className="px-8 py-4 bg-[#1a1a1a] text-white rounded-full font-medium hover:bg-gray-800 transition-all transform hover:-translate-y-1 shadow-xl">
                        Explore MATI Carbon
                    </button>
                </div>
            </section>
        </main>
    );
}

// Helper Components for cleaner code

function SoilRiseAnimation() {
    const [particles, setParticles] = useState<Array<{ left: number, delay: number, duration: number }>>([]);

    useEffect(() => {
        setParticles([...Array(12)].map(() => ({
            left: Math.random() * 100,
            delay: Math.random() * 2,
            duration: 3 + Math.random() * 2
        })));
    }, []);

    if (particles.length === 0) return null;

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {particles.map((p, i) => (
                <motion.div
                    key={i}
                    className="absolute bottom-0 w-2 h-2 bg-[#D4AF37]/60 rounded-full"
                    initial={{ y: 100, opacity: 0, scale: 0 }}
                    whileInView={{
                        y: -300 - Math.random() * 200, // Randomness here is okay as it runs on animation start
                        opacity: [0, 1, 0],
                        scale: [0, 1.5, 0],
                        x: (Math.random() - 0.5) * 100,
                    }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        delay: p.delay,
                        ease: "easeOut",
                    }}
                    style={{ left: `${p.left}%` }}
                />
            ))}
        </div>
    );
}

function RockSprinkleAnimation() {
    const [rocks, setRocks] = useState<Array<{ left: number, delay: number }>>([]);

    useEffect(() => {
        setRocks([...Array(8)].map(() => ({
            left: 20 + Math.random() * 60,
            delay: Math.random() * 3
        })));
    }, []);

    if (rocks.length === 0) return null;

    return (
        <div className="absolute top-0 right-0 w-full h-full pointer-events-none overflow-hidden z-0">
            {rocks.map((rock, i) => (
                <motion.div
                    key={i}
                    className="absolute top-0 w-1.5 h-1.5 bg-gray-400 rounded-sm rotate-45"
                    initial={{ y: -20, opacity: 0 }}
                    whileInView={{
                        y: 150,
                        opacity: [0, 1, 0],
                        rotate: 360,
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: rock.delay,
                        ease: "linear",
                    }}
                    style={{ left: `${rock.left}%` }}
                />
            ))}
        </div>
    );
}

function BackgroundBubbles() {
    const [bubbles, setBubbles] = useState<Array<{ left: number, duration: number }>>([]);

    useEffect(() => {
        setBubbles([...Array(10)].map(() => ({
            left: Math.random() * 100,
            duration: Math.random() * 5 + 5
        })));
    }, []);

    if (bubbles.length === 0) return null;

    return (
        <div className="absolute inset-0 pointer-events-none">
            {bubbles.map((b, i) => (
                <motion.div
                    key={i}
                    className="absolute w-4 h-4 rounded-full border border-white/20"
                    initial={{ bottom: -20, left: `${b.left}%`, opacity: 0 }}
                    animate={{ bottom: "100%", opacity: [0, 0.5, 0] }}
                    transition={{ duration: b.duration, repeat: Infinity, ease: "linear" }}
                />
            ))}
        </div>
    );
}

function JourneyStep({ title, date, desc, icon, align, color = "#556B2F" }: any) {
    return (
        <motion.div
            className="relative flex md:items-center gap-8 md:justify-between group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
        >
            {/* Left Side Content (Desktop) */}
            <div className={cn("hidden md:block w-5/12 text-right p-4", align === "right" && "invisible")}>
                {align === "left" && (
                    <>
                        <h3 className="text-xl font-bold text-[#1a1a1a]">{title}</h3>
                        <p className="text-sm text-gray-500 mb-2">{date}</p>
                        <p className="text-gray-600 text-sm">{desc}</p>
                    </>
                )}
            </div>

            {/* Center Node */}
            <div className="absolute left-8 md:left-1/2 -translate-x-1/2 flex flex-col items-center justify-center z-10">
                {/* Icon Circle */}
                <div className="w-12 h-12 rounded-full bg-white shadow-md border-2 border-gray-100 flex items-center justify-center text-[#556B2F] relative z-20">
                    {icon}
                </div>
                {/* Pulse Effect */}
                <motion.div
                    className="absolute w-full h-full rounded-full -z-10"
                    style={{ backgroundColor: color }}
                    initial={{ scale: 1, opacity: 0.4 }}
                    whileInView={{ scale: 1.6, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            </div>

            {/* Right Side Content (Desktop) */}
            <div className={cn("hidden md:block w-5/12 text-left p-4", align === "left" && "invisible")}>
                {align === "right" && (
                    <>
                        <h3 className="text-xl font-bold text-[#1a1a1a]">{title}</h3>
                        <p className="text-sm text-gray-500 mb-2">{date}</p>
                        <p className="text-gray-600 text-sm">{desc}</p>
                    </>
                )}
            </div>

            {/* Mobile Layout (Content always on right of line) */}
            <div className="md:hidden flex-1 pl-20 py-4">
                <h3 className="text-xl font-bold text-[#1a1a1a]">{title}</h3>
                <p className="text-sm text-gray-500 mb-2">{date}</p>
                <p className="text-gray-600 text-sm">{desc}</p>
            </div>
        </motion.div>
    );
}

function CertificationCard({ icon, title, desc, popupTitle, popupDesc, popupContent, badges }: any) {
    return (
        <div className="group p-8 rounded-2xl bg-[#F9F8F6] border border-[#7C9082]/10 hover:shadow-lg transition-all relative overflow-hidden">
            {icon}
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-gray-600 text-sm mb-4">{desc}</p>
            <div className="flex items-center gap-2 text-xs font-medium text-[#556B2F] bg-[#556B2F]/10 px-3 py-1 rounded-full w-fit">
                <CheckCircle2 className="w-3 h-3" /> Verified
            </div>
            {badges && (
                <div className="flex flex-wrap gap-2 mt-4">
                    {badges.map((b: string) => (
                        <span key={b} className="text-[10px] font-bold border border-gray-300 px-2 py-1 rounded bg-white">{b}</span>
                    ))}
                </div>
            )}

            {/* Hover Pop-up */}
            <div className="absolute inset-0 bg-[#556B2F] text-white p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex flex-col justify-center">
                <h4 className="font-bold mb-2">{popupTitle}</h4>
                {popupContent ? popupContent : <p className="text-sm">{popupDesc}</p>}
            </div>
        </div>
    );
}
