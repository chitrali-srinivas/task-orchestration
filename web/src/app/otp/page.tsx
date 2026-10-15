"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock, AlertCircle, Timer } from "lucide-react";
import { auth } from "@/lib/firebase";

export default function OTPPage() {
    const router = useRouter();
    const [otp, setOtp] = useState("");
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Timer effect for lockout
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isLocked && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isLocked) {
            setIsLocked(false);
            setAttempts(0);
            setError(null);
        }
        return () => clearInterval(timer);
    }, [isLocked, timeLeft]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (isLocked) return;

        // Hardcoded OTP check
        if (otp === "123456") {
            console.log("OTP verification successful for:", auth.currentUser?.email);
            router.push("/dashboard");
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            console.log(`OTP attempt failed (${newAttempts}/3) for:`, auth.currentUser?.email);

            if (newAttempts >= 3) {
                setIsLocked(true);
                setTimeLeft(60);
                setError("Maximum tries reached. Please try again after 1 minute.");
            } else {
                setError(`Incorrect OTP. ${3 - newAttempts} attempts remaining.`);
            }
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-900">
            <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800 shadow-lg">
                <CardHeader className="flex flex-col items-center space-y-2">
                    <div className="rounded-full bg-zinc-100 p-3 dark:bg-zinc-800">
                        <Lock className="h-6 w-6 text-mati-gold" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Verification</CardTitle>
                    <CardDescription>
                        Enter the 6-digit code sent to your device
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            {isLocked ? <Timer className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            <AlertTitle>{isLocked ? "Locked" : "Error"}</AlertTitle>
                            <AlertDescription>
                                {error}
                                {isLocked && <div className="mt-1 font-mono text-sm">Retry in {timeLeft}s</div>}
                            </AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="text"
                                placeholder="Enter 6-digit code"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                maxLength={6}
                                className="text-center text-lg tracking-widest"
                                disabled={isLocked}
                            />
                            <p className="text-xs text-center text-zinc-500">
                                (For demo: use 123456)
                            </p>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-mati-gold hover:bg-yellow-600 text-white"
                            disabled={isLocked || otp.length !== 6}
                        >
                            Verify & Proceed
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
