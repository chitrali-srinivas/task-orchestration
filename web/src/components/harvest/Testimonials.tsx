"use client";

import { Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const testimonials = [
    {
        id: 1,
        name: "Sarah Jenkins",
        location: "Portland, OR",
        text: "Loving how my rice fights climate change! The taste is incredible, and knowing exactly where it comes from makes every meal special.",
        rating: 5,
    },
    {
        id: 2,
        name: "Michael Chen",
        location: "San Francisco, CA",
        text: "Finally, a brand that takes transparency seriously. The trace page is beautiful and informative.",
        rating: 5,
    },
    {
        id: 3,
        name: "Emma Wilson",
        location: "Austin, TX",
        text: "I've switched all my grain purchases to MATI. The quality is unmatched, and the impact is real.",
        rating: 5,
    },
];

export function Testimonials() {
    return (
        <section className="py-20 px-6 bg-[#F9F8F6]">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold mb-4 font-playfair text-[#1a1a1a]">Community Stories</h2>
                    <p className="text-gray-600">Join thousands of conscious consumers making a difference.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {testimonials.map((t) => (
                        <div key={t.id} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative">
                            <Quote className="absolute top-6 right-6 w-8 h-8 text-[#556B2F]/10" />
                            <div className="flex gap-1 mb-4">
                                {[...Array(t.rating)].map((_, i) => (
                                    <Star key={i} className="w-4 h-4 fill-[#D4AF37] text-[#D4AF37]" />
                                ))}
                            </div>
                            <p className="text-gray-600 mb-6 italic">"{t.text}"</p>
                            <div>
                                <div className="font-bold text-[#1a1a1a]">{t.name}</div>
                                <div className="text-xs text-gray-500">{t.location}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
