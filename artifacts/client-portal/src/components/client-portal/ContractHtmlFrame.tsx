import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { applyClientSignatureToContractHtml, buildContractRenderHtml, decodeContractHtml, extractPdfUrl } from '@/lib/clientContractPreview';

type ContractHtmlFrameProps = {
  html: string;
  title: string;
  className?: string;
  signatureData?: string | null;
  signedAt?: string | null;
};

const ContractHtmlFrame = forwardRef<HTMLIFrameElement, ContractHtmlFrameProps>(({ html, title, className, signatureData, signedAt }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => iframeRef.current as HTMLIFrameElement);

  const decoded = useMemo(() => decodeContractHtml(html), [html]);
  const pdfUrl = useMemo(() => extractPdfUrl(decoded), [decoded]);

  const documentHtml = useMemo(() => {
    if (pdfUrl) return null;
    const source = signatureData ? applyClientSignatureToContractHtml(decoded, signatureData, signedAt) : decoded;
    return buildContractRenderHtml(source);
  }, [decoded, pdfUrl, signatureData, signedAt]);

  useEffect(() => {
    if (pdfUrl) return;
    const iframe = iframeRef.current;
    const wrapper = wrapperRef.current;
    if (!iframe || !wrapper || !documentHtml) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(documentHtml);
    doc.close();

    // Apply CSS scale so the contract (typically 794px wide) fits the container.
    // Uses window resize events ONLY — window resize never fires when we change
    // iframe/wrapper styles, so there is no ResizeObserver feedback loop.
    const applyScale = () => {
      const idoc = iframe.contentDocument;
      const body = idoc?.body;
      const htmlEl = idoc?.documentElement;
      if (!body || !htmlEl) return;

      const rawHeight = Math.max(
        body.scrollHeight, body.offsetHeight,
        htmlEl.scrollHeight, htmlEl.offsetHeight,
      );
      const contentWidth = Math.max(body.scrollWidth, htmlEl.scrollWidth, 794);

      // Read container width from wrapper's PARENT so we never create a feedback
      // loop by reading from the element whose height we are about to set.
      const containerWidth = wrapper.parentElement
        ? wrapper.parentElement.clientWidth || wrapper.offsetWidth
        : wrapper.offsetWidth;

      if (containerWidth > 0 && contentWidth > containerWidth) {
        const scale = containerWidth / contentWidth;
        iframe.style.width = contentWidth + 'px';
        iframe.style.height = rawHeight + 'px';
        iframe.style.transform = `scale(${scale})`;
        iframe.style.transformOrigin = 'top left';
        wrapper.style.height = Math.ceil(rawHeight * scale) + 'px';
      } else {
        iframe.style.width = '100%';
        iframe.style.transform = '';
        iframe.style.transformOrigin = '';
        if (rawHeight > 0) iframe.style.height = rawHeight + 'px';
        wrapper.style.height = '';
      }
    };

    // Fire several times to catch fonts/images that load after the initial paint.
    const t1 = setTimeout(applyScale, 50);
    const t2 = setTimeout(applyScale, 250);
    const t3 = setTimeout(applyScale, 700);
    const t4 = setTimeout(applyScale, 1500);

    const win = iframe.contentWindow;
    win?.addEventListener('load', applyScale);

    // Window resize is safe: it fires when the browser window changes size,
    // NOT when we modify iframe/wrapper styles — no feedback loop possible.
    window.addEventListener('resize', applyScale);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      win?.removeEventListener('load', applyScale);
      window.removeEventListener('resize', applyScale);
    };
  }, [documentHtml, pdfUrl]);

  if (pdfUrl) {
    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`;
    return (
      <iframe
        ref={iframeRef}
        title={title}
        className={className}
        src={viewerUrl}
        allow="autoplay"
        style={{ border: 'none', width: '100%', height: '100%', minHeight: '640px', display: 'block' }}
      />
    );
  }

  return (
    <div ref={wrapperRef} className={className} style={{ overflow: 'hidden', width: '100%' }}>
      <iframe
        ref={iframeRef}
        title={title}
        sandbox="allow-same-origin allow-popups"
        style={{ border: 'none', display: 'block', width: '100%' }}
      />
    </div>
  );
});

ContractHtmlFrame.displayName = 'ContractHtmlFrame';

export default ContractHtmlFrame;
