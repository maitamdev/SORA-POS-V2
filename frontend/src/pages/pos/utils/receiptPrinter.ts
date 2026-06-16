/**
 * Prints the given HTML content in a hidden iframe to prevent browser pop-up blockers.
 * Works perfectly on mobile and desktop web browsers.
 */
export const printReceipt = (htmlContent: string): void => {
  // 1. Clean up any previous print iframe to avoid bloating the DOM
  const existingIframe = document.getElementById('sora-pos-print-iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  // 2. Create a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'sora-pos-print-iframe';
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    console.error('[ReceiptPrinter] Cannot access print iframe document');
    return;
  }

  // 3. Write print content
  doc.open();
  doc.write(htmlContent);
  doc.close();

  // 4. Trigger printer dialog after resources (fonts, stylesheets) load
  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('[ReceiptPrinter] Failed to print receipt:', err);
    }
  }, 250);
};
