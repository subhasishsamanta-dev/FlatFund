import { useEffect } from "react";
import { useMotionValue, useTransform, animate } from "framer-motion";

export function useCountUp(endValue: number, duration: number = 1.5) {
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString("en-IN"));

    useEffect(() => {
        const controls = animate(count, endValue, { duration: duration, ease: "easeOut" });
        return () => controls.stop();
    }, [endValue, count, duration]);

    return rounded;
}
