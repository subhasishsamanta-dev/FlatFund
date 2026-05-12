// Defensive patch to avoid ResizeObserver loop warnings by deferring callbacks
// This wraps the native ResizeObserver callback invocation inside requestAnimationFrame
// and catches errors to prevent the "ResizeObserver loop completed with undelivered notifications." console noise.

if (typeof window !== 'undefined' && (window as any).ResizeObserver) {
  const NativeRO = (window as any).ResizeObserver;

  class PatchedResizeObserver {
    private _ro: any;
    constructor(callback: ResizeObserverCallback) {
      // Wrap the user callback to run inside rAF and try/catch
      const wrapped = (entries: ResizeObserverEntry[], observer: ResizeObserver) => {
        try {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              try {
                callback(entries, observer);
              } catch (err) {
                // swallow errors from user callback to avoid breaking RO loop
                // still log to console for debugging
                // eslint-disable-next-line no-console
                console.error('Error in ResizeObserver callback:', err);
              }
            });
          } else {
            try {
              callback(entries, observer);
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('Error in ResizeObserver callback:', err);
            }
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Error scheduling ResizeObserver callback:', err);
        }
      };

      this._ro = new NativeRO(wrapped);
    }

    observe(target: Element, options?: ResizeObserverOptions) {
      try {
        return this._ro.observe(target, options);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('ResizeObserver.observe error:', err);
      }
    }

    unobserve(target: Element) {
      try {
        return this._ro.unobserve(target);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('ResizeObserver.unobserve error:', err);
      }
    }

    disconnect() {
      try {
        return this._ro.disconnect();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('ResizeObserver.disconnect error:', err);
      }
    }
  }

  try {
    (window as any).ResizeObserver = PatchedResizeObserver;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not patch ResizeObserver:', err);
  }
}
