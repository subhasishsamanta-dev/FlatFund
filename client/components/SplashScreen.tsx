import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PiggyBank } from "lucide-react";

export function SplashScreen() {
    const [isLoaded, setIsLoaded] = useState(false);

    // Generate an array of coins with random delays
    const coins = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
        id: i,
        delay: i * 0.25,
        x: Math.random() * 40 - 20, // Random horizontal offset
    })), []);

    useEffect(() => {
        setIsLoaded(true);
    }, []);

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] overflow-hidden z-[9999]">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />

            <div className="relative flex flex-col items-center">
                {/* Coins falling */}
                <div className="absolute -top-40 left-0 right-0 flex justify-center h-40 pointer-events-none">
                    {coins.map((coin) => (
                        <motion.div
                            key={coin.id}
                            initial={{ y: -50, x: coin.x, opacity: 0, scale: 0.8 }}
                            animate={{
                                y: 160, // Drop into the piggy bank
                                opacity: [0, 1, 1, 0],
                                scale: [0.8, 1, 1, 0.8],
                                rotate: [0, 45, 90, 180]
                            }}
                            transition={{
                                duration: 1.2,
                                delay: coin.delay,
                                repeat: Infinity,
                                repeatDelay: 1,
                                ease: "easeIn"
                            }}
                            className="absolute w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-400 via-yellow-200 to-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)] flex items-center justify-center border border-yellow-300"
                        >
                            <span className="text-[10px] font-bold text-yellow-800">₹</span>
                        </motion.div>
                    ))}
                </div>

                {/* Piggy Bank */}
                <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{
                        scale: 1,
                        rotate: 0,
                        // Subtle bounce when coins "hit"
                        scaleY: [1, 1.05, 1],
                    }}
                    transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        scaleY: {
                            duration: 0.3,
                            repeat: Infinity,
                            repeatDelay: 0.1
                        }
                    }}
                    className="relative z-10 p-8 rounded-[40px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl"
                >
                    <div className="absolute inset-x-0 top-6 h-1 bg-white/20 blur-[1px] rounded-full mx-10" title="Penny Slot" />
                    <PiggyBank className="h-24 w-24 text-primary drop-shadow-[0_0_20px_rgba(var(--primary),0.3)]" />
                </motion.div>

                {/* Text Branding */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="mt-8 text-center"
                >
                    <h1 className="text-4xl font-black tracking-tighter text-white">
                        FLAT <span className="text-primary">FUND</span>
                    </h1>
                    <p className="text-muted-foreground text-sm font-bold mt-2">
                        ফান্ড কি আমাদের দুর্বোল নাকি
                    </p>
                </motion.div>
            </div>

            {/* Loading Indicator */}
            <motion.div
                className="absolute bottom-12 w-48 h-1 bg-white/5 rounded-full overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
            >
                <motion.div
                    className="h-full bg-primary"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
            </motion.div>
        </div>
    );
}

