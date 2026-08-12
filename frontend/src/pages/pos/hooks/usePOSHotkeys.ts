import { useEffect, useRef } from 'react';

interface UsePOSHotkeysOptions {
  submitBarcode: (barcode: string) => void;
  onCheckout: () => void;
  focusBarcodeInput: () => void;
}

export const usePOSHotkeys = ({
  submitBarcode,
  onCheckout,
  focusBarcodeInput,
}: UsePOSHotkeysOptions) => {
  const scannerBufferRef = useRef('');
  const scannerLastKeyAtRef = useRef(0);
  const scannerTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Some scanner/IME integrations dispatch keydown-like events without a key value.
      // Normalize it before reading .length or appending it to the scanner buffer.
      const key = typeof event.key === 'string' ? event.key : '';
      const target = event.target as HTMLElement | null;
      const activeInputId = target?.id || '';
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      const isBarcodeInput = activeInputId === 'barcode-search-input';

      // 1. If Enter and buffer is not empty (scanned via hardware keyboard scanner)
      if (key === 'Enter' && scannerBufferRef.current && !isBarcodeInput) {
        const scannedCode = scannerBufferRef.current;
        scannerBufferRef.current = '';
        if (scannerTimerRef.current) {
          window.clearTimeout(scannerTimerRef.current);
          scannerTimerRef.current = null;
        }
        if (scannedCode.length >= 4) {
          event.preventDefault();
          submitBarcode(scannedCode);
          return;
        }
      }

      // 2. Accumulate character inputs from standard keyboard scanner emulation
      if (
        key.length === 1 &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !isBarcodeInput &&
        !isEditableTarget
      ) {
        const now = Date.now();
        // If delay is too long, reset buffer (means typed by hand instead of scanned)
        if (now - scannerLastKeyAtRef.current > 120) {
          scannerBufferRef.current = '';
        }
        scannerLastKeyAtRef.current = now;
        scannerBufferRef.current += key;

        if (scannerTimerRef.current) {
          window.clearTimeout(scannerTimerRef.current);
        }
        scannerTimerRef.current = window.setTimeout(() => {
          scannerBufferRef.current = '';
        }, 180);
        return;
      }

      // 3. F2 / F3 / F9 keys
      if (key === 'F2') {
        event.preventDefault();
        focusBarcodeInput();
      } else if (key === 'F3') {
        event.preventDefault();
        document.getElementById('product-search-input')?.focus();
      } else if (key === 'F9') {
        event.preventDefault();
        onCheckout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
    };
  }, [submitBarcode, onCheckout, focusBarcodeInput]);
};
