"""
Form PDF generation utility using Playwright for HTML-to-PDF conversion
Uses multiprocessing to avoid Windows asyncio subprocess issues
"""
import asyncio
import logging
import multiprocessing
from typing import List, Optional
from concurrent.futures import ProcessPoolExecutor

logger = logging.getLogger(__name__)

# JavaScript to apply PDF styling (converted from the Next.js version)
PDF_STYLING_SCRIPT = """
(targetIds) => {
    const body = document.body;
    if (!body) return;
    
    body.style.overflow = 'hidden';
    body.style.margin = '0';
    body.style.padding = '0';
    body.style.backgroundColor = '#ffffff';
    
    // Create a container for vertical stacked layout
    const container = document.createElement('div');
    container.id = 'pdf-container';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '0';
    container.style.width = '100%';
    container.style.boxSizing = 'border-box';
    container.style.padding = '4px';
    
    // Find and move all target elements to container
    const targetElements = [];
    targetIds.forEach((id) => {
        const element = document.querySelector(id);
        if (element) {
            const cloned = element.cloneNode(true);
            cloned.id = `${id.replace('#', '')}-pdf`;
            
            cloned.style.width = '100%';
            cloned.style.margin = '0';
            cloned.style.padding = '8px';
            cloned.style.backgroundColor = '#ffffff';
            cloned.style.color = '#000000';
            cloned.style.boxSizing = 'border-box';
            cloned.style.position = 'relative';
            cloned.style.overflow = 'hidden';
            cloned.style.pageBreakAfter = 'auto';
            cloned.style.pageBreakInside = 'avoid';
            cloned.style.marginBottom = '4px';
            
            targetElements.push(cloned);
            container.appendChild(cloned);
        }
    });
    
    body.innerHTML = '';
    body.appendChild(container);
    
    // Process all target elements for styling
    targetElements.forEach((targetElement) => {
        // Fix responsive styles for PDF
        const allDivs = targetElement.querySelectorAll('div');
        allDivs.forEach((div) => {
            const classList = div.className || '';
            if (div.querySelector('table') && (classList.includes('overflow') || classList.includes('overflow-x'))) {
                div.style.setProperty('overflow', 'visible', 'important');
                div.style.setProperty('overflow-x', 'visible', 'important');
                div.style.setProperty('overflow-y', 'visible', 'important');
            }
        });
        
        // Remove min-width constraints from tables
        const tables = targetElement.querySelectorAll('table');
        tables.forEach((table) => {
            const classList = table.className || '';
            if (classList.includes('min-w')) {
                table.style.setProperty('min-width', '0', 'important');
            }
            table.style.setProperty('width', '100%', 'important');
        });
        
        // Ensure grid layouts use desktop breakpoints
        const grids = targetElement.querySelectorAll('[class*="grid"]');
        grids.forEach((grid) => {
            const classList = grid.className || '';
            if (classList.includes('grid-cols-1') && classList.includes('md:grid-cols-2')) {
                grid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
            } else if (classList.includes('grid-cols-1') && classList.includes('sm:grid-cols-2')) {
                grid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
            }
        });
        
        // Fix responsive padding
        const allElementsForPadding = targetElement.querySelectorAll('*');
        allElementsForPadding.forEach((el) => {
            const classList = el.className || '';
            if (classList.includes('p-4') && (classList.includes('sm:p-6') || classList.includes('md:p-8'))) {
                el.style.setProperty('padding', '2rem', 'important');
            }
        });
        
        // Fix responsive font sizes
        const allElementsForFontSize = targetElement.querySelectorAll('*');
        allElementsForFontSize.forEach((el) => {
            const classList = el.className || '';
            if (classList.includes('text-[10px]') && classList.includes('sm:text-xs')) {
                el.style.setProperty('font-size', '0.75rem', 'important');
            }
        });
        
        // Process all elements for borders and styling
        const allElements = targetElement.querySelectorAll('*');
        allElements.forEach((el) => {
            const styleAttr = el.getAttribute('style') || '';
            const computedStyle = window.getComputedStyle(el);
            const bgImage = computedStyle.backgroundImage || styleAttr;
            const position = computedStyle.position || '';
            const zIndex = computedStyle.zIndex || '';
            const pointerEvents = computedStyle.pointerEvents || '';
            const elClassList = el.className || '';
            
            const hasBackgroundImage = bgImage && bgImage !== 'none' && (bgImage.includes('url(') || styleAttr.includes('backgroundImage'));
            const isAbsolute = position === 'absolute' || elClassList.includes('absolute');
            const isBackgroundLayer = zIndex === '0' || elClassList.includes('z-0') || pointerEvents === 'none' || elClassList.includes('pointer-events-none');
            const isBackgroundLogo = hasBackgroundImage && isAbsolute && isBackgroundLayer;
            
            el.style.visibility = 'visible';
            
            if (isBackgroundLogo) {
                el.style.setProperty('opacity', '0.03', 'important');
            } else {
                el.style.opacity = '1';
            }
            
            // Ensure borders are visible
            const classList = el.className || '';
            if (classList.includes('border-2') || classList.includes('border-b') || classList.includes('border-b-2') || classList.includes('border-r-2')) {
                el.style.setProperty('border-color', '#000000', 'important');
                el.style.setProperty('border-style', 'solid', 'important');
                if (classList.includes('border-2')) {
                    const containsTable = el.querySelector('table') !== null;
                    if (containsTable) {
                        el.style.setProperty('border-width', '0.5px', 'important');
                    } else {
                        el.style.setProperty('border-width', '1px', 'important');
                    }
                } else if (classList.includes('border-b-2')) {
                    el.style.setProperty('border-bottom-width', '0.5px', 'important');
                    el.style.setProperty('border-top-width', '0', 'important');
                    el.style.setProperty('border-left-width', '0', 'important');
                    el.style.setProperty('border-right-width', '0', 'important');
                } else if (classList.includes('border-r-2')) {
                    el.style.setProperty('border-right-width', '0.5px', 'important');
                } else if (classList.includes('border-b')) {
                    el.style.setProperty('border-bottom-width', '0.5px', 'important');
                    el.style.setProperty('border-top-width', '0', 'important');
                    el.style.setProperty('border-left-width', '0', 'important');
                    el.style.setProperty('border-right-width', '0', 'important');
                }
            }
            
            // Style table cells
            if (el.tagName === 'TD' || el.tagName === 'TH') {
                const row = el.parentElement;
                const table = row?.closest('table');
                
                if (table) {
                    const cells = Array.from(row.cells);
                    const cellIndex = cells.indexOf(el);
                    const isLastColumn = cellIndex === cells.length - 1;
                    
                    const rows = Array.from(table.rows);
                    const rowIndex = rows.indexOf(row);
                    const isLastRow = rowIndex === rows.length - 1;
                    
                    el.style.setProperty('border-style', 'solid', 'important');
                    el.style.setProperty('border-color', '#000000', 'important');
                    
                    if (isLastColumn) {
                        el.style.setProperty('border-right-width', '0', 'important');
                    } else if (classList.includes('border-r-2')) {
                        el.style.setProperty('border-right-width', '0.5px', 'important');
                    } else {
                        el.style.setProperty('border-right-width', '0', 'important');
                    }
                    
                    if (isLastRow) {
                        el.style.setProperty('border-bottom-width', '0', 'important');
                    } else if (classList.includes('border-b-2')) {
                        el.style.setProperty('border-bottom-width', '0.5px', 'important');
                    } else if (classList.includes('border-b')) {
                        el.style.setProperty('border-bottom-width', '0.5px', 'important');
                    } else {
                        el.style.setProperty('border-bottom-width', '0', 'important');
                    }
                    
                    const colspan = el.colSpan || 1;
                    const isColspanCell = colspan > 1;
                    if (isColspanCell) {
                        el.style.setProperty('border-left-width', '0.5px', 'important');
                    } else {
                        el.style.setProperty('border-left-width', '0', 'important');
                    }
                    
                    el.style.setProperty('border-top-width', '0', 'important');
                }
            }
            
            // Style titles
            if (el.tagName === 'H2') {
                const classList = el.className || '';
                if (classList.includes('text-sm') || classList.includes('text-base') || el.textContent?.includes('RETURN OF ASSETS FORM')) {
                    el.style.fontSize = '0.875rem';
                    el.style.lineHeight = '1.25rem';
                    el.style.fontWeight = 'bold';
                }
            }
            
            if (el.tagName === 'P') {
                const classList = el.className || '';
                const textContent = el.textContent || '';
                if (classList.includes('text-xs')) {
                    el.style.fontSize = '0.75rem';
                    el.style.lineHeight = '1rem';
                    el.style.fontWeight = '600';
                }
                if (textContent.includes('This certify that assets') || textContent.includes('complete and in good condition')) {
                    el.style.fontSize = '10px';
                    el.style.lineHeight = '1.2';
                    el.style.color = '#6b7280';
                    el.style.fontStyle = 'italic';
                }
            }
            
            // Style control number
            if (el.tagName === 'DIV') {
                const classList = el.className || '';
                const textContent = el.textContent || '';
                const hasControlNumberClass = classList.includes('text-[10px]');
                const isControlNumber = classList.includes('border-b-2') && 
                    (hasControlNumberClass || el.previousElementSibling?.textContent?.includes('CTRL NO') || el.parentElement?.textContent?.includes('CTRL NO'));
                if (isControlNumber && textContent.trim().length > 0) {
                    el.style.setProperty('font-size', '10px', 'important');
                    el.style.setProperty('line-height', '1.2', 'important');
                }
            }
            
            // Style employee details
            if (el.tagName === 'P' || el.tagName === 'DIV' || el.tagName === 'SPAN') {
                const classList = el.className || '';
                let isInEmployeeDetailsCard = false;
                let currentParent = el.parentElement;
                while (currentParent && currentParent !== document.body) {
                    if (currentParent.classList.contains('border-2')) {
                        const hasGrid = currentParent.querySelector('.grid.grid-cols-2');
                        if (hasGrid) {
                            isInEmployeeDetailsCard = true;
                            break;
                        }
                    }
                    currentParent = currentParent.parentElement;
                }
                
                if (classList.includes('text-xs') || isInEmployeeDetailsCard) {
                    if (isInEmployeeDetailsCard) {
                        el.style.fontSize = '0.65rem';
                        el.style.lineHeight = '0.9rem';
                    } else if (classList.includes('text-xs')) {
                        el.style.fontSize = '0.75rem';
                        el.style.lineHeight = '1rem';
                    }
                }
            }
            
            // Style signature section
            const parentClass = el.parentElement?.className || '';
            if (parentClass.includes('grid') && parentClass.includes('grid-cols-2') && (el.tagName === 'P' || el.tagName === 'DIV')) {
                el.style.fontSize = '0.75rem';
                el.style.lineHeight = '1rem';
            }
            
            // Style table cells padding
            if (el.tagName === 'TD' || el.tagName === 'TH') {
                const classList = el.className || '';
                if (classList.includes('text-xs')) {
                    el.style.fontSize = '0.75rem';
                    el.style.lineHeight = '1rem';
                }
                if (classList.includes('py-0.5')) {
                    el.style.paddingTop = '2px';
                    el.style.paddingBottom = '2px';
                    el.style.paddingLeft = '8px';
                    el.style.paddingRight = '8px';
                } else if (classList.includes('p-2') && !classList.includes('py-0.5')) {
                    el.style.padding = '8px';
                } else if (classList.includes('py-1')) {
                    el.style.paddingTop = '4px';
                    el.style.paddingBottom = '4px';
                    el.style.paddingLeft = '8px';
                    el.style.paddingRight = '8px';
                }
            }
            
            // Style checkboxes
            if (el.tagName === 'INPUT' && el.type === 'checkbox') {
                const isChecked = el.checked || el.hasAttribute('checked') || el.getAttribute('checked') === '' || el.getAttribute('checked') === 'true';
                
                if (isChecked) {
                    el.checked = true;
                    el.setAttribute('checked', 'checked');
                } else {
                    el.checked = false;
                    el.removeAttribute('checked');
                }
                
                el.style.width = '12px';
                el.style.height = '12px';
                el.style.border = '1.5px solid #000000';
                el.style.borderRadius = '2px';
                el.style.appearance = 'none';
                el.style.setProperty('-webkit-appearance', 'none');
                el.style.cursor = 'default';
                el.style.position = 'relative';
                el.style.display = 'inline-block';
                el.style.verticalAlign = 'middle';
                el.style.setProperty('-webkit-print-color-adjust', 'exact');
                el.style.setProperty('print-color-adjust', 'exact');
                
                if (isChecked) {
                    el.style.backgroundColor = '#000000';
                    el.style.borderColor = '#000000';
                    const checkmarkSVG = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><path fill="white" stroke="white" stroke-width="1.2" d="M1.5 4 L3.5 6 L6.5 1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
                    el.style.backgroundImage = `url("data:image/svg+xml,${checkmarkSVG}")`;
                    el.style.backgroundSize = '8px 8px';
                    el.style.backgroundRepeat = 'no-repeat';
                    el.style.backgroundPosition = 'center';
                } else {
                    el.style.backgroundColor = '#ffffff';
                    el.style.borderColor = '#000000';
                    el.style.backgroundImage = 'none';
                }
            }
        });
    });
}
"""


def _run_playwright_in_process(html: Optional[str], url: Optional[str], element_ids: List[str]) -> bytes:
    """
    Run Playwright in a separate process with its own event loop.
    This function is the target for multiprocessing.
    """
    import asyncio
    import sys
    
    # On Windows, we need to set the event loop policy for subprocess support
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    async def _generate():
        from playwright.async_api import async_playwright
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--disable-web-security',
                ]
            )
            
            try:
                page = await browser.new_page()
                
                # Set viewport to A4 proportions
                await page.set_viewport_size({"width": 794, "height": 1123})
                
                # Navigate or set content
                if url:
                    try:
                        await page.goto(url, wait_until="networkidle", timeout=60000)
                        
                        # Wait for target elements
                        for element_id in element_ids:
                            try:
                                await page.wait_for_selector(element_id, timeout=20000, state="visible")
                            except Exception:
                                # Wait a bit more for React hydration
                                await asyncio.sleep(3)
                                element = await page.query_selector(element_id)
                                if not element:
                                    raise ValueError(f"Element {element_id} not found on page")
                    except Exception as nav_error:
                        if html:
                            await page.set_content(html, wait_until="networkidle", timeout=60000)
                        else:
                            raise ValueError(f"Failed to navigate to URL: {nav_error}")
                elif html:
                    await page.set_content(html, wait_until="networkidle", timeout=60000)
                
                # Wait for images
                await page.evaluate("""
                    async () => {
                        const images = Array.from(document.querySelectorAll('img'));
                        await Promise.all(
                            images.map((img) => {
                                if (img.complete) return Promise.resolve();
                                return new Promise((resolve) => {
                                    img.onload = resolve;
                                    img.onerror = resolve;
                                    setTimeout(resolve, 3000);
                                });
                            })
                        );
                        await document.fonts.ready;
                    }
                """)
                
                # Wait for dynamic content
                await asyncio.sleep(2)
                
                # Verify elements exist
                missing_elements = []
                for element_id in element_ids:
                    element = await page.query_selector(element_id)
                    if not element:
                        missing_elements.append(element_id)
                
                if missing_elements:
                    raise ValueError(f"Elements {', '.join(missing_elements)} not found")
                
                # Apply PDF styling
                await page.evaluate(PDF_STYLING_SCRIPT, element_ids)
                
                # Emulate print media
                await page.emulate_media(media="print")
                
                # Generate PDF
                pdf_data = await page.pdf(
                    format="A4",
                    print_background=True,
                    margin={
                        "top": "10mm",
                        "right": "10mm",
                        "bottom": "10mm",
                        "left": "10mm",
                    },
                )
                
                return pdf_data
            
            finally:
                await browser.close()
    
    # Create new event loop and run
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_generate())
    finally:
        loop.close()


def _process_wrapper(args):
    """Wrapper to unpack arguments for multiprocessing"""
    html, url, element_ids = args
    return _run_playwright_in_process(html, url, element_ids)


# Use spawn method for Windows compatibility
_mp_context = multiprocessing.get_context('spawn')


async def generate_form_pdf(
    html: Optional[str] = None,
    url: Optional[str] = None,
    element_ids: Optional[List[str]] = None,
) -> bytes:
    """
    Generate a PDF from HTML content or URL using Playwright
    
    Args:
        html: HTML content to render
        url: URL to navigate to
        element_ids: List of element IDs to capture (e.g., ['#return-form-admin', '#return-form-dept'])
    
    Returns:
        PDF content as bytes
    """
    if not html and not url:
        raise ValueError("HTML content or URL is required")
    
    if not element_ids or len(element_ids) == 0:
        raise ValueError("Element ID(s) required")
    
    # Run Playwright in a separate process to avoid Windows asyncio issues
    loop = asyncio.get_event_loop()
    
    with ProcessPoolExecutor(max_workers=1, mp_context=_mp_context) as executor:
        pdf_data = await loop.run_in_executor(
            executor,
            _process_wrapper,
            (html, url, element_ids),
        )
    
    return pdf_data
