"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";

export default function SignInPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // Log for testing as requested
            console.log("Logged in with email:", user.email);

            // Show success screen instead of redirecting to OTP
            setIsSuccess(true);
        } catch (err: any) {
            console.error("Sign-in error:", err);
            setError(err.message || "Failed to sign in with Google. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinue = () => {
        router.push("/dashboard"); // Redirect to dashboard or home after success
    };

    return (
        <main className="flex min-h-screen w-full">
            {/* Left Side - Background Image & Logo */}
            <div className="relative hidden lg:flex lg:w-1/2 h-screen overflow-hidden">
                <div 
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: "url('/basaltrocky_d.webp')" }}
                />
                <div className="absolute inset-0 bg-black/20" /> {/* Subtle overlay for text readability */}
                <div className="relative z-10 flex items-center justify-center w-full h-full">
                    <h1 className="text-white text-8xl font-medium tracking-[0.2em] flex items-start">
                        MATI<span className="text-3xl font-semibold ml-1 -mt-1">C</span>
                    </h1>
                </div>
            </div>

            {/* Right Side - Login Form or Success Screen */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-950 relative">
                {!isSuccess ? (
                    <>
                        {/* Help Icon with Hover Card */}
                        <div className="absolute top-6 right-6">
                            <HoverCard openDelay={0} closeDelay={0}>
                                <HoverCardTrigger asChild>
                                    <button className="text-zinc-400 hover:text-zinc-600 transition-colors">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                            <path d="M12 17h.01" />
                                        </svg>
                                    </button>
                                </HoverCardTrigger>
                                <HoverCardContent align="end" className="w-64 p-4 shadow-xl border-zinc-100">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-semibold text-zinc-900">Support</h4>
                                        <a 
                                            href="mailto:Help@maticarbon.com" 
                                            className="text-sm text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 transition-colors"
                                        >
                                            Help@maticarbon.com
                                        </a>
                                    </div>
                                </HoverCardContent>
                            </HoverCard>
                        </div>

                        <div className="w-full max-w-sm space-y-8">
                            <div className="text-center space-y-2">
                                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                                    Login to your account
                                </h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Login with your registered email id.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <Button
                                    className="w-full bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 h-12 text-base font-medium flex items-center justify-center gap-3 shadow-sm"
                                    onClick={handleGoogleSignIn}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                                            <path
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                fill="#4285F4"
                                            />
                                            <path
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                fill="#34A853"
                                            />
                                            <path
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                                fill="#FBBC05"
                                            />
                                            <path
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                fill="#EA4335"
                                            />
                                        </svg>
                                    )}
                                    Continue with Google
                                </Button>
                            </div>

                            <div className="text-center text-xs text-zinc-400 dark:text-zinc-500">
                                By clicking continue, you agree to our{" "}
                                <a href="#" className="underline hover:text-zinc-600 transition-colors">Terms of Service</a>{" "}
                                and{" "}
                                <a href="#" className="underline hover:text-zinc-600 transition-colors">Privacy Policy</a>.
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="w-full max-w-sm flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-300">
                        <div className="relative">
                            <div className="bg-green-500 rounded-full p-6 shadow-lg shadow-green-500/20">
                                <CheckCircle2 className="w-16 h-16 text-white" />
                            </div>
                        </div>
                        
                        <div className="text-center space-y-2">
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                                Logged in successfully!
                            </p>
                        </div>

                        <Button 
                            onClick={handleContinue}
                            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 h-12 text-base font-medium rounded-md shadow-sm transition-all"
                        >
                            Continue
                        </Button>
                    </div>
                )}
            </div>
        </main>
    );
}
