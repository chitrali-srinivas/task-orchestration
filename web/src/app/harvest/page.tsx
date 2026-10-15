"use client";

import { Navbar } from "@/components/harvest/Navbar";
import { HeroSection } from "@/components/harvest/home/HeroSection";
import { AboutSection } from "@/components/harvest/home/AboutSection";
import { ScanTeaser } from "@/components/harvest/home/ScanTeaser";
import { Testimonials } from "@/components/harvest/Testimonials";
import { ImpactCalculator } from "@/components/harvest/ImpactCalculator";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export default function HarvestLandingPage() {
    return (
        <main className={cn("min-h-screen bg-[#F9F8F6] text-[#2C3E50]", inter.className)}>
            <Navbar />
            <HeroSection />
            <AboutSection />

            <section className="py-20 bg-[#F5F5DC]/30">
                <div className="max-w-7xl mx-auto px-6 mb-12 text-center">
                    <h2 className="text-3xl font-bold font-serif mb-4">Farmer Voices</h2>
                    <p className="text-gray-600">Hear from those who feed us.</p>
                </div>
                <Testimonials />
            </section>

            <ScanTeaser />

            <section className="py-24 bg-white relative">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold font-serif mb-8">Calculate Your Potential Impact</h2>
                    <ImpactCalculator />
                </div>
            </section>

            {/* Footer Placeholder */}
            <footer className="py-12 bg-[#1a1a1a] text-white text-center">
                <div className="max-w-7xl mx-auto px-6">
                    <p className="text-gray-400 mb-4">&copy; 2025 Mati Carbon. All rights reserved.</p>
                    <div className="flex justify-center gap-6 text-sm text-gray-500">
                        <a href="#" className="hover:text-white">Privacy Policy</a>
                        <a href="#" className="hover:text-white">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </main>
    );
}
