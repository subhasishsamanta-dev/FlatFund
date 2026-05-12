/**
 * Haptic Feedback utility
 * Provides tactile feedback via the Vibration API for a more 'premium' feel on mobile.
 */

export const haptics = {
    /**
     * Subtle tap for button presses or navigation
     */
    light: () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(10);
        }
    },

    /**
     * medium tap for toggles, menu openings, or activations
     */
    medium: () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(25);
        }
    },

    /**
     * Double-tap pattern for successful actions (e.g. saving a deposit)
     */
    success: () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([15, 50, 15]);
        }
    },

    /**
     * Stronger single pulse for error or rejection
     */
    error: () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50);
        }
    },

    /**
     * Warning pattern
     */
    warning: () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([30, 40, 30, 40, 30]);
        }
    }
};
