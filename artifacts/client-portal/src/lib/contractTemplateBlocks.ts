export interface ContractTemplateBlock {
  id: string;
  label: string;
  html: string;
  excerpt: string;
}

const VISIBLE_MEDIA_SELECTOR = 'img, table, hr, svg, canvas, video, iframe';

const hasVisibleContent = (element: Element) => {
  const htmlElement = element as HTMLElement;
  const text = (htmlElement.textContent || '').trim();
  return !!text || !!htmlElement.querySelector(VISIBLE_MEDIA_SELECTOR);
};

const getMeaningfulChildren = (element: Element) => Array.from(element.children).filter((child) => hasVisibleContent(child));

const isWrapperCandidate = (element: Element) => ['DIV', 'SECTION', 'ARTICLE', 'MAIN'].includes(element.tagName);

const resolveBlocksContainer = (element: Element) => {
  let current = element;

  while (true) {
    const meaningfulChildren = getMeaningfulChildren(current);
    if (meaningfulChildren.length !== 1) return current;

    const onlyChild = meaningfulChildren[0];
    if (!isWrapperCandidate(onlyChild)) return current;

    current = onlyChild;
  }
};

const buildLabel = (element: Element, index: number, fallback?: string) => {
  const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
  const headingText = (heading?.textContent || '').trim();
  if (headingText) return headingText;

  const text = ((element as HTMLElement).textContent || '').replace(/\s+/g, ' ').trim();
  if (fallback) return fallback;
  if (!text) return `Bloc ${index + 1}`;
  return text.slice(0, 42) + (text.length > 42 ? '…' : '');
};

const buildExcerpt = (element: Element) => {
  const text = ((element as HTMLElement).textContent || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 72) + (text.length > 72 ? '…' : '');
};

const getWrapperAndSectionsParent = (container: HTMLElement) => {
  const wrapper = container.querySelector('div[style*="max-width"]') || container;
  let sectionsParent: Element = wrapper;

  // Find the child that contains the most sub-sections (the main content body)
  const wrapperChildren = getMeaningfulChildren(wrapper);
  let maxSubChildren = 0;

  for (const child of wrapperChildren) {
    if (!isWrapperCandidate(child)) continue;
    const resolved = resolveBlocksContainer(child);
    const subCount = getMeaningfulChildren(resolved).length;
    if (subCount > maxSubChildren && subCount > 1) {
      maxSubChildren = subCount;
      sectionsParent = child;
    }
  }

  return { wrapper, sectionsParent };
};

const collectBlockElements = (wrapper: Element, sectionsParent: Element) => {
  const blockElements: Element[] = [];

  if (sectionsParent !== wrapper) {
    const innerContainer = resolveBlocksContainer(sectionsParent);
    let phase: 'before' | 'after' = 'before';

    for (const child of Array.from(wrapper.children)) {
      if (child === sectionsParent) {
        blockElements.push(...getMeaningfulChildren(innerContainer));
        phase = 'after';
        continue;
      }

      if (!hasVisibleContent(child)) continue;
      blockElements.push(child);
      if (phase === 'before') phase = 'before';
    }
  } else {
    const resolvedWrapper = resolveBlocksContainer(wrapper);
    blockElements.push(...getMeaningfulChildren(resolvedWrapper));
  }

  return blockElements;
};

const replaceElementWithHtml = (element: Element, html: string) => {
  const fragment = document.createElement('div');
  fragment.innerHTML = html.trim();
  const nodes = Array.from(fragment.childNodes);

  if (!nodes.length) {
    element.remove();
    return;
  }

  element.replaceWith(...nodes);
};

export function parseContractTemplateBlocks(html: string): ContractTemplateBlock[] {
  if (!html?.trim() || typeof document === 'undefined') {
    return html?.trim()
      ? [{ id: 'block-0', label: 'Bloc 1', html, excerpt: '' }]
      : [];
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const { wrapper, sectionsParent } = getWrapperAndSectionsParent(container);
  const blockElements = collectBlockElements(wrapper, sectionsParent);

  const blocks = blockElements.map((element, index) => {
    const isWrapperLevel = sectionsParent !== wrapper && element.parentElement === wrapper;
    const fallback = isWrapperLevel
      ? blockElements.indexOf(element) === 0
        ? 'En-tête'
        : 'Pied de page'
      : undefined;

    return {
      id: `block-${index}`,
      label: buildLabel(element, index, fallback),
      html: (element as HTMLElement).outerHTML,
      excerpt: buildExcerpt(element),
    };
  });

  return blocks.length ? blocks : [{ id: 'block-0', label: 'Bloc 1', html, excerpt: '' }];
}

export function rebuildContractTemplateFromBlocks(originalHtml: string, blocks: ContractTemplateBlock[]): string {
  if (!originalHtml?.trim() || typeof document === 'undefined') {
    return blocks.map((block) => block.html).join('');
  }

  const container = document.createElement('div');
  container.innerHTML = originalHtml;

  const { wrapper, sectionsParent } = getWrapperAndSectionsParent(container);
  const originalBlockElements = collectBlockElements(wrapper, sectionsParent);

  if (originalBlockElements.length !== blocks.length) {
    return blocks.map((block) => block.html).join('');
  }

  for (let index = originalBlockElements.length - 1; index >= 0; index -= 1) {
    replaceElementWithHtml(originalBlockElements[index], blocks[index].html);
  }

  return container.innerHTML;
}
