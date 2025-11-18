/**
 * Clase de utilidades estáticas para manipulación básica del DOM (reemplazo del objeto 'jq').
 */
export class Utilities {
    /** Agrega una o más clases a un elemento (o lista de elementos). */
    public static addClass(el: Element | NodeListOf<Element> | null, classes: string): void {
        if (!el) return;

        const classList = classes.split(/\s+/).filter(c => c.trim() !== '');

        const elements = el instanceof NodeList || Array.isArray(el) ? Array.from(el) : [el];

        elements.forEach(e => {
            if (e instanceof Element) {
                e.classList.add(...classList);
            }
        });
    }

    /** Obtiene el último elemento de una NodeList o Array. */
    public static findLast<T extends Element>(el: NodeListOf<T> | Array<T> | null): T | null {
        if (el && el.length > 0) {
            return el[el.length - 1];
        }
        return null;
    }

    /** Obtiene la opción seleccionada de un elemento <select>. */
    public static findSelectedOption(el: HTMLSelectElement | null): HTMLOptionElement | null {
        if (!el || !el.options || !el.options.length) return null;
        return el.options[el.selectedIndex];
    }

    /** Establece el innerHTML de un elemento. */
    public static html(el: Element | null, html: string): void {
        if (el) el.innerHTML = html;
    }

    /** Obtiene el desplazamiento del elemento respecto al documento. */
    public static offset(el: Element | null): { top: number, left: number } {
        if (!el || !el.getClientRects().length) return { top: 0, left: 0 };
        const rect = el.getBoundingClientRect();
        const win = el.ownerDocument!.defaultView!;
        return {
            top: rect.top + win.pageYOffset,
            left: rect.left + win.pageXOffset
        };
    }

    /** Elimina un event listener de un elemento o selector. */
    public static off(el: Element | NodeListOf<Element> | Document | null, event: string, selectorOrListener: string | EventListener, listener?: EventListener): void {
        if (!el) return;
        const elements = el instanceof NodeList || Array.isArray(el) ? Array.from(el) : [el];

        elements.forEach(currentEl => {
            if (typeof selectorOrListener === 'function') {
                currentEl.removeEventListener(event, selectorOrListener as EventListener);
            } else if (typeof selectorOrListener === 'string' && listener) {
                const targets = currentEl.querySelectorAll(selectorOrListener);
                targets.forEach((target: any) => target.removeEventListener(event, listener));
            }
        });
    }

    /** Agrega un event listener a un elemento o selector. */
    public static on(el: Element | NodeListOf<Element> | Document | null, event: string, selectorOrListener: string | EventListener, listener?: EventListener): void {
        if (!el) return;
        const elements = el instanceof NodeList || Array.isArray(el) ? Array.from(el) : [el];

        elements.forEach(currentEl => {
            if (typeof selectorOrListener === 'function') {
                currentEl.addEventListener(event, selectorOrListener as EventListener);
            } else if (typeof selectorOrListener === 'string' && listener) {
                const targets = currentEl.querySelectorAll(selectorOrListener);
                targets.forEach((target: any) => target.addEventListener(event, listener));
            }
        });
    }

    /** Obtiene un selector CSS de un elemento (para `closest`). */
    public static getSelectorFromElement(el: Element | null): string {
        if (!el || !(el instanceof Element)) return '';
        let selector = el.tagName.toLowerCase();
        if (el.id) return selector + '#' + el.id;
        if (el.className) selector += '.' + el.className.split(/\s+/).join('.');
        return selector;
    }
}