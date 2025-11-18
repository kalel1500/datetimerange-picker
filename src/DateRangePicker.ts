import { DateTime, Duration, Settings, Info } from 'luxon';
import { Utilities } from './Utilities';
import { CalendarRenderer } from './CalendarRenderer';
import { TimePickerRenderer } from './TimePickerRenderer';
import { Options, Locale, CalendarData, RangeDates, Callback } from './types';

/**
 * Clase principal del DateRangePicker, refactorizada a TypeScript y Luxon.
 */
export class DateRangePicker {
    // [PROPIEDADES - Estado y Configuración]
    private element: HTMLElement;
    private container: HTMLElement;
    private parentEl: HTMLElement;
    private options: Options;
    private locale: Locale;
    private ranges: { [key: string]: RangeDates } = {};
    private opens: 'left' | 'right' | 'center' = 'right';
    private drops: 'down' | 'up' | 'auto' = 'down';
    private buttonClasses: string = 'btn btn-sm';
    private applyButtonClasses: string = 'btn-primary';
    private cancelButtonClasses: string = 'btn-default';
    private autoApply: boolean = false;
    private singleDatePicker: boolean = false;
    private timePicker: boolean = false;
    private timePickerSeconds: boolean = false;
    private timePickerIncrement: number = 1;
    private timePicker24Hour: boolean = false;
    private linkedCalendars: boolean = true;
    private autoUpdateInput: boolean = true;
    private alwaysShowCalendars: boolean = false;
    private showCustomRangeLabel: boolean = true;
    private showDropdowns: boolean = false;
    private minYear: number;
    private maxYear: number;
    private startDate: DateTime;
    private endDate: DateTime;
    private minDate: DateTime | false = false;
    private maxDate: DateTime | false = false;
    private maxSpan: Duration | false = false;
    private oldStartDate: DateTime;
    private oldEndDate: DateTime;
    private chosenLabel: string | null = null;
    private isShowing: boolean = false;
    private callback: Callback;
    private leftCalendar: CalendarData;
    private rightCalendar: CalendarData;
    private calendarRenderer: CalendarRenderer;
    private timePickerRenderer: TimePickerRenderer;
    private isInvalidDate: (date: DateTime) => boolean = () => false;
    private isCustomDate: (date: DateTime) => string | string[] | false = () => false;

    // [PROXIES DE EVENTOS]
    private _outsideClickProxy: EventListener | null = null;
    private moveProxy: EventListener | null = null;
    private clickRangeProxy: EventListener | null = null;
    private clickApplyProxy: EventListener | null = null;
    private clickCancelProxy: EventListener | null = null;
    private showProxy: EventListener | null = null;
    private elementChangedProxy: EventListener | null = null;
    private keydownProxy: EventListener | null = null;
    private toggleProxy: EventListener | null = null;
    private clickPrevProxy: EventListener | null = null;
    private clickNextProxy: EventListener | null = null;
    private clickDateProxy: EventListener | null = null;
    private hoverDateProxy: EventListener | null = null;
    private monthOrYearChangedProxy: EventListener | null = null;
    private timeChangedProxy: EventListener | null = null;

    constructor(element: HTMLElement | string, options: Options = {}, cb: Callback = () => {}) {
        // 1. Inicialización de Elemento y Estado Básico
        this.element = typeof element === 'string' ? document.getElementById(element)! : element;
        this.parentEl = document.body;
        this.callback = cb;

        // Inicializar años por defecto
        this.minYear = DateTime.local().minus({ years: 100 }).year;
        this.maxYear = DateTime.local().plus({ years: 100 }).year;

        // Inicializar fechas
        this.startDate = DateTime.local().startOf('day');
        this.endDate = DateTime.local().endOf('day');
        this.oldStartDate = this.startDate.setZone('local');
        this.oldEndDate = this.endDate.setZone('local');

        // El mes se inicializa al día 2 para evitar problemas de mes con menos de 2 días
        this.leftCalendar = { month: this.startDate.set({ day: 2 }), calendar: [] };
        this.rightCalendar = { month: this.startDate.set({ day: 2 }).plus({ months: 1 }), calendar: [] };

        // 2. Configuración Regional por Defecto (español)
        // Usamos 'es' como locale para obtener los nombres correctos.
        Settings.defaultLocale = 'es';

        this.locale = {
            direction: 'ltr',
            format: 'dd/MM/yyyy',
            separator: ' - ',
            applyLabel: 'Aplicar',
            cancelLabel: 'Cancelar',
            weekLabel: 'S',
            customRangeLabel: 'Rango Personalizado',
            // Info.weekdays() devuelve la lista completa. La rotación se hace más abajo.
            daysOfWeek: Info.weekdays('short'),
            monthNames: Info.months('short'),
            firstDay: 1 // Lunes (1)
        };
        // Rotar daysOfWeek según firstDay
        let iterator = this.locale.firstDay;
        while (iterator > 0) {
            this.locale.daysOfWeek.push(this.locale.daysOfWeek.shift()!);
            iterator--;
        }

        // 3. Aplicar Opciones
        this.options = Object.assign(Object.assign({}, this.element.dataset), options);
        this.applyOptions(this.options);

        // 4. Inicializar la UI
        this.container = this.createContainer(this.options.template);

        // 5. Inicializar Renderizadores (pasan el estado actual)
        this.calendarRenderer = new CalendarRenderer(
            this.container,
            this.locale,
            this.showDropdowns,
            this.options.showWeekNumbers || false,
            this.options.showISOWeekNumbers || false,
            this.minYear,
            this.maxYear,
            this.isInvalidDate,
            this.isCustomDate,
            this.linkedCalendars,
            this.singleDatePicker
        );
        this.timePickerRenderer = new TimePickerRenderer(this.container, this.timePickerSeconds, this.timePickerIncrement, this.timePicker24Hour, this.locale);

        // 6. Configurar Eventos
        this.setupEventListeners();

        // 7. Actualizar el elemento de entrada
        this.updateElement();
        this.updateMonthsInView();
    }

    // ====================================================================
    // LÓGICA COMPLETA DE MÉTODOS PRIVADOS
    // ====================================================================

    private applyOptions(options: Options): void {
        if (this.element.classList.contains('pull-right')) this.opens = 'left';
        if (this.element.classList.contains('dropup')) this.drops = 'up';
        if (typeof options.opens === 'string') this.opens = options.opens;
        if (typeof options.drops === 'string') this.drops = options.drops;

        if (typeof options.locale === 'object') {
            this.locale = { ...this.locale, ...options.locale as Locale };
            if (options.locale.firstDay !== undefined) {
                // Reiniciar y rotar daysOfWeek
                this.locale.daysOfWeek = Info.weekdays('short');
                let iterator = this.locale.firstDay;
                while (iterator > 0) {
                    this.locale.daysOfWeek.push(this.locale.daysOfWeek.shift()!);
                    iterator--;
                }
            }
        }
        this.container?.classList.add(this.locale.direction);

        const parseDate = (date: DateTime | string | false | undefined, format: string) =>
            typeof date === 'string' ? DateTime.fromFormat(date, format) : (date instanceof DateTime ? date : false);

        this.startDate = (parseDate(options.startDate, this.locale.format) as DateTime) || this.startDate;
        this.endDate = (parseDate(options.endDate, this.locale.format) as DateTime) || this.endDate;
        this.minDate = parseDate(options.minDate, this.locale.format);
        this.maxDate = parseDate(options.maxDate, this.locale.format);

        // Propiedades booleanas/numéricas
        this.singleDatePicker = !!options.singleDatePicker;
        if (this.singleDatePicker) this.endDate = this.startDate.setZone('local');
        this.timePicker = !!options.timePicker;
        this.timePickerSeconds = !!options.timePickerSeconds;
        if (options.timePickerIncrement !== undefined) this.timePickerIncrement = options.timePickerIncrement;
        this.timePicker24Hour = !!options.timePicker24Hour;
        this.autoApply = !!options.autoApply;
        this.autoUpdateInput = !!options.autoUpdateInput;
        this.linkedCalendars = !!options.linkedCalendars;
        this.alwaysShowCalendars = !!options.alwaysShowCalendars;
        this.showCustomRangeLabel = !!options.showCustomRangeLabel;
        this.showDropdowns = !!options.showDropdowns;
        if (options.minYear !== undefined) this.minYear = options.minYear;
        if (options.maxYear !== undefined) this.maxYear = options.maxYear;
        if (options.maxSpan && typeof options.maxSpan !== 'boolean') this.maxSpan = options.maxSpan;
        if (options.isInvalidDate) this.isInvalidDate = options.isInvalidDate;
        if (options.isCustomDate) this.isCustomDate = options.isCustomDate;

        if (typeof options.ranges === 'object') {
            this.updateRanges(options.ranges as any);
        }

        // Sanity checks:
        if (this.minDate && this.startDate < this.minDate) this.startDate = this.minDate.setZone('local');
        if (this.maxDate && this.endDate > this.maxDate) this.endDate = this.maxDate.setZone('local');

        if (!this.timePicker) {
            this.startDate = this.startDate.startOf('day');
            this.endDate = this.endDate.endOf('day');
        } else if (this.timePickerIncrement) {
            const roundMinutes = (dt: DateTime) => {
                const remainder = dt.minute % this.timePickerIncrement;
                return remainder !== 0 ? dt.minus({ minutes: remainder }) : dt;
            };
            this.startDate = roundMinutes(this.startDate);
            this.endDate = roundMinutes(this.endDate);
        }
    }

    private createContainer(template: string = ''): HTMLElement {
        const defaultTemplate =
            '<div class="daterangepicker">' +
            '<div class="ranges"></div>' +
            '<div class="drp-calendar left">' +
            '<div class="calendar-table"></div>' +
            '<div class="calendar-time"></div>' +
            '</div>' +
            '<div class="drp-calendar right">' +
            '<div class="calendar-table"></div>' +
            '<div class="calendar-time"></div>' +
            '</div>' +
            '<div class="drp-buttons">' +
            '<span class="drp-selected"></span>' +
            '<button class="cancelBtn" type="button"></button>' +
            '<button class="applyBtn" disabled="disabled" type="button"></button> ' +
            '</div>' +
            '</div>';

        const finalTemplate = this.options.template || defaultTemplate;
        const templateWrapEl = document.createElement('div');
        templateWrapEl.innerHTML = finalTemplate.trim();
        const container = templateWrapEl.firstElementChild as HTMLElement;
        this.parentEl.insertAdjacentElement('beforeend', container);

        container.classList.add(this.locale.direction, `opens${this.opens}`);
        if (this.singleDatePicker) container.classList.add('single');
        if ((!this.options.ranges && !this.singleDatePicker) || this.alwaysShowCalendars) {
            container.classList.add('show-calendar');
        }
        if (this.options.ranges) container.classList.add('show-ranges');
        if (this.autoApply) container.classList.add('auto-apply');

        const applyBtnEl = container.querySelector('.applyBtn') as HTMLButtonElement;
        const cancelBtnEl = container.querySelector('.cancelBtn') as HTMLButtonElement;
        Utilities.addClass(applyBtnEl, this.buttonClasses);
        Utilities.addClass(cancelBtnEl, this.buttonClasses);
        if (this.applyButtonClasses.length) Utilities.addClass(applyBtnEl, this.applyButtonClasses);
        if (this.cancelButtonClasses.length) Utilities.addClass(cancelBtnEl, this.cancelButtonClasses);
        Utilities.html(applyBtnEl, this.locale.applyLabel);
        Utilities.html(cancelBtnEl, this.locale.cancelLabel);

        return container;
    }

    private setupEventListeners(): void {
        this.clickRangeProxy = this.clickRange.bind(this);
        Utilities.on(this.container.querySelector('.ranges'), 'click', 'li', this.clickRangeProxy);

        const drpButtonsEl = this.container.querySelector('.drp-buttons');
        this.clickApplyProxy = this.clickApply.bind(this);
        Utilities.on(drpButtonsEl, 'click', 'button.applyBtn', this.clickApplyProxy);
        this.clickCancelProxy = this.clickCancel.bind(this);
        Utilities.on(drpButtonsEl, 'click', 'button.cancelBtn', this.clickCancelProxy);

        if (this.element.tagName === 'INPUT' || this.element.tagName === 'BUTTON') {
            this.showProxy = this.show.bind(this);
            Utilities.on(this.element, 'click', this.showProxy);
            Utilities.on(this.element, 'focus', this.showProxy);
            this.elementChangedProxy = this.elementChanged.bind(this);
            Utilities.on(this.element, 'keyup', this.elementChangedProxy);
            // Uso de EventListener para compatibilidad con el tipo 'addEventListener'
            this.keydownProxy = this.keydown.bind(this) as EventListener;
            Utilities.on(this.element, 'keydown', this.keydownProxy);
        } else {
            this.toggleProxy = this.toggle.bind(this);
            Utilities.on(this.element, 'click', this.toggleProxy);
            this.keydownProxy = this.keydown.bind(this) as EventListener;
            Utilities.on(this.element, 'keydown', this.keydownProxy);
        }

        this.clickPrevProxy = this.clickPrev.bind(this);
        this.clickNextProxy = this.clickNext.bind(this);
        this.clickDateProxy = this.clickDate.bind(this);
        this.hoverDateProxy = this.hoverDate.bind(this);
        this.monthOrYearChangedProxy = this.monthOrYearChanged.bind(this);
        this.timeChangedProxy = this.timeChanged.bind(this);
    }

    // [MÉTODOS PÚBLICOS]
    public setStartDate(startDate: DateTime | string): void {
        const newStartDate = typeof startDate === 'string' ? DateTime.fromFormat(startDate, this.locale.format) : startDate.setZone('local');
        this.startDate = newStartDate;
        if (!this.timePicker) this.startDate = this.startDate.startOf('day');
        // ... (Validaciones de minDate y timePickerIncrement)
        if (!this.isShowing) this.updateElement();
        this.updateMonthsInView();
    }

    public setEndDate(endDate: DateTime | string): void {
        const newEndDate = typeof endDate === 'string' ? DateTime.fromFormat(endDate, this.locale.format) : endDate.setZone('local');
        this.endDate = newEndDate;
        if (!this.timePicker) this.endDate = this.endDate.endOf('day');
        // ... (Validaciones de maxDate y timePickerIncrement)
        this.updateSelectedDisplay();
        if (!this.isShowing) this.updateElement();
        this.updateMonthsInView();
    }

    public show(): void {
        if (this.isShowing) return;
        this._outsideClickProxy = this.outsideClick.bind(this);
        document.addEventListener('mousedown', this._outsideClickProxy);
        document.addEventListener('touchend', this._outsideClickProxy);
        document.addEventListener('focusin', this._outsideClickProxy);
        Utilities.on(document, 'click', '[data-toggle=dropdown]', this._outsideClickProxy);
        this.moveProxy = this.move.bind(this);
        window.addEventListener('resize', this.moveProxy);
        this.oldStartDate = this.startDate.setZone('local');
        this.oldEndDate = this.endDate.setZone('local');
        this.updateView();
        this.container.style.display = 'block';
        this.move();
        this.isShowing = true;
        this.element.dispatchEvent(new CustomEvent('show.daterangepicker', { bubbles: true, detail: this }));
    }

    public hide(): void {
        if (!this.isShowing) return;
        if (!this.endDate) {
            this.startDate = this.oldStartDate.setZone('local');
            this.endDate = this.oldEndDate.setZone('local');
        }
        if (!this.startDate.equals(this.oldStartDate) || !this.endDate.equals(this.oldEndDate))
            this.callback(this.startDate.setZone('local'), this.endDate.setZone('local'), this.chosenLabel);

        this.updateElement();

        if (this._outsideClickProxy) {
            document.removeEventListener('mousedown', this._outsideClickProxy);
            document.removeEventListener('touchend', this._outsideClickProxy);
            Utilities.off(document, 'click', '[data-toggle=dropdown]', this._outsideClickProxy);
            document.removeEventListener('focusin', this._outsideClickProxy);
        }
        if (this.moveProxy) window.removeEventListener('resize', this.moveProxy);

        this.container.style.display = 'none';
        this.isShowing = false;
        this.element.dispatchEvent(new CustomEvent('hide.daterangepicker', { bubbles: true, detail: this }));
    }

    public toggle(): void {
        this.isShowing ? this.hide() : this.show();
    }

    // [MÉTODOS PRIVADOS DE LÓGICA]

    private updateView(): void {
        if (this.timePicker) {
            this.renderTimePickers();
        }
        this.updateSelectedDisplay();
        this.updateMonthsInView();
        this.updateCalendars();
        this.updateFormInputs();
    }

    private updateSelectedDisplay(): void {
        if (this.endDate) {
            const formattedStart = this.startDate.toFormat(this.locale.format + (this.timePicker ? ' ' + (this.timePicker24Hour ? 'HH:mm' : 'h:mm a') + (this.timePickerSeconds ? ':ss' : '') : ''));
            const formattedEnd = this.endDate.toFormat(this.locale.format + (this.timePicker ? ' ' + (this.timePicker24Hour ? 'HH:mm' : 'h:mm a') + (this.timePickerSeconds ? ':ss' : '') : ''));
            Utilities.html(this.container.querySelector('.drp-selected'), formattedStart + this.locale.separator + formattedEnd);
        }
    }

    private updateMonthsInView(): void {
        if (this.endDate) {
            // El mes de inicio siempre es el de la fecha de inicio
            this.leftCalendar.month = this.startDate.set({ day: 2 });

            // Si no están vinculados o los meses son diferentes, el derecho es la fecha de fin
            if (!this.linkedCalendars && (this.endDate.month !== this.startDate.month || this.endDate.year !== this.startDate.year)) {
                this.rightCalendar.month = this.endDate.set({ day: 2 });
            } else {
                // Si están vinculados o es el mismo mes, el derecho es un mes después del izquierdo
                this.rightCalendar.month = this.startDate.set({ day: 2 }).plus({ months: 1 });
            }
        }
        // Ajustar si el calendario derecho excede maxDate o si es el mismo mes y singleDatePicker es falso
        if (this.maxDate && this.linkedCalendars && !this.singleDatePicker && this.rightCalendar.month > this.maxDate) {
            this.rightCalendar.month = this.maxDate.set({ day: 2 });
            this.leftCalendar.month = this.maxDate.set({ day: 2 }).minus({ months: 1 });
        }
    }

    private updateCalendars(): void {
        const drpCalendarElList = this.container.querySelectorAll('.drp-calendar');
        // Limpiar eventos anteriores del calendario
        Utilities.off(drpCalendarElList, 'click', '.prev', this.clickPrevProxy!);
        Utilities.off(drpCalendarElList, 'click', '.next', this.clickNextProxy!);
        Utilities.off(drpCalendarElList, 'click', 'td.available', this.clickDateProxy!);
        Utilities.off(drpCalendarElList, 'mouseover', 'td.available', this.hoverDateProxy!);
        Utilities.off(drpCalendarElList, 'change', '.monthselect', this.monthOrYearChangedProxy!);
        Utilities.off(drpCalendarElList, 'change', '.yearselect', this.monthOrYearChangedProxy!);
        Utilities.off(drpCalendarElList, 'change', '.hourselect, .minuteselect, .secondselect, .ampmselect', this.timeChangedProxy!);

        this.calendarRenderer.buildCalendar(this.leftCalendar);
        this.calendarRenderer.buildCalendar(this.rightCalendar);

        this.calendarRenderer.render('left', this.leftCalendar, this.startDate, this.endDate, this.minDate, this.maxDate, this.maxSpan);
        this.calendarRenderer.render('right', this.rightCalendar, this.startDate, this.endDate, this.minDate, this.maxDate, this.maxSpan);

        this.calculateChosenLabel();

        // Re-configurar eventos para los nuevos elementos del calendario
        Utilities.on(drpCalendarElList, 'click', '.prev', this.clickPrevProxy!);
        Utilities.on(drpCalendarElList, 'click', '.next', this.clickNextProxy!);
        Utilities.on(drpCalendarElList, 'click', 'td.available', this.clickDateProxy!);
        Utilities.on(drpCalendarElList, 'mouseover', 'td.available', this.hoverDateProxy!);
        Utilities.on(drpCalendarElList, 'change', '.monthselect', this.monthOrYearChangedProxy!);
        Utilities.on(drpCalendarElList, 'change', '.yearselect', this.monthOrYearChangedProxy!);
        Utilities.on(drpCalendarElList, 'change', '.hourselect, .minuteselect, .secondselect, .ampmselect', this.timeChangedProxy!);
    }

    private renderTimePickers(): void {
        this.timePickerRenderer.render('left', this.startDate, this.startDate, this.minDate, this.maxDate, this.maxSpan);
        if (this.endDate) {
            // El minDate para el selector de hora derecho es la fecha de inicio
            this.timePickerRenderer.render('right', this.endDate, this.startDate, this.startDate, this.maxDate, this.maxSpan);
        } else {
            // Si no hay fecha de fin, el selector derecho usa el mes de referencia pero está deshabilitado
            this.timePickerRenderer.render('right', this.rightCalendar.month, this.startDate, this.startDate, this.maxDate, this.maxSpan);
            const selectElList = this.container.querySelectorAll('.right .calendar-time select');
            selectElList.forEach(el => {
                (el as HTMLSelectElement).disabled = true;
                el.classList.add('disabled');
            });
        }
    }

    private move(): void {
        const parentEl = this.parentEl;
        const elementOffset = Utilities.offset(this.element);
        const container = this.container;
        const parentOffset = Utilities.offset(parentEl);
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;

        let containerTop = elementOffset.top;
        let containerLeft = elementOffset.left;

        // Posicionamiento vertical (drops)
        if (this.drops === 'up') {
            containerTop = elementOffset.top - containerHeight;
        } else if (this.drops === 'auto') {
            const viewportH = window.innerHeight;
            const scrollT = window.scrollY;
            if (elementOffset.top + this.element.offsetHeight + containerHeight > viewportH + scrollT) {
                containerTop = elementOffset.top - containerHeight;
                this.container.classList.add('dropup');
            }
        }

        // Posicionamiento horizontal (opens)
        if (this.opens === 'left') {
            containerLeft = elementOffset.left - containerWidth + this.element.offsetWidth;
        } else if (this.opens === 'center') {
            containerLeft = elementOffset.left + (this.element.offsetWidth / 2) - (containerWidth / 2);
        }

        // Aplicar posiciones finales
        container.style.top = (containerTop - parentOffset.top) + 'px';
        container.style.left = (containerLeft - parentOffset.left) + 'px';
        container.style.right = 'auto'; // Limpiar derecho por si acaso
    }

    private outsideClick(e: Event): void {
        const target = e.target as HTMLElement;
        if (
            (e.type === "focusin") ||
            target.closest(Utilities.getSelectorFromElement(this.element)) ||
            target.closest(Utilities.getSelectorFromElement(this.container)) ||
            target.closest('.calendar-table')
        ) return;
        this.hide();
        this.element.dispatchEvent(new CustomEvent('outsideClick.daterangepicker', { bubbles: true, detail: this }));
    }

    private clickRange(e: Event): void {
        const target = e.target as HTMLElement;
        const label = target.dataset.rangeKey!;
        this.chosenLabel = label;

        if (label === this.locale.customRangeLabel) {
            this.container.classList.add('show-calendar');
        } else {
            const dates = this.ranges[label];
            this.setStartDate(dates[0].setZone('local'));
            this.setEndDate(dates[1].setZone('local'));
            if (!this.alwaysShowCalendars) this.container.classList.remove('show-calendar');
            this.clickApply(e);
        }
    }

    private clickPrev(e: Event): void {
        const cal = (e.target as HTMLElement).closest('.drp-calendar')!;
        if (cal.classList.contains('left')) {
            this.leftCalendar.month = this.leftCalendar.month.minus({ months: 1 });
            if (this.linkedCalendars)
                this.rightCalendar.month = this.rightCalendar.month.minus({ months: 1 });
        } else {
            this.rightCalendar.month = this.rightCalendar.month.minus({ months: 1 });
        }
        this.updateCalendars();
    }

    private clickNext(e: Event): void {
        const cal = (e.target as HTMLElement).closest('.drp-calendar')!;
        if (cal.classList.contains('left')) {
            this.leftCalendar.month = this.leftCalendar.month.plus({ months: 1 });
        } else {
            this.rightCalendar.month = this.rightCalendar.month.plus({ months: 1 });
            if (this.linkedCalendars)
                this.leftCalendar.month = this.leftCalendar.month.plus({ months: 1 });
        }
        this.updateCalendars();
    }

    private hoverDate(e: Event): void {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('available') || this.endDate) return;

        this.container.querySelectorAll<HTMLElement>('.drp-calendar tbody td').forEach(td => {
            if (td.classList.contains('week')) return;

            const title = td.dataset.title!;
            const r = parseInt(title.substr(1, 1));
            const c = parseInt(title.substr(3, 1));
            const d = td.closest('.drp-calendar')!.classList.contains('left')
                ? this.leftCalendar.calendar[r][c]
                : this.rightCalendar.calendar[r][c];

            const date = target.closest('.drp-calendar')!.classList.contains('left')
                ? this.leftCalendar.calendar[parseInt(target.dataset.title!.substr(1, 1))][parseInt(target.dataset.title!.substr(3, 1))]
                : this.rightCalendar.calendar[parseInt(target.dataset.title!.substr(1, 1))][parseInt(target.dataset.title!.substr(3, 1))];

            if ((d > this.startDate.endOf('day') && d < date.startOf('day')) || d.hasSame(date, 'day')) {
                td.classList.add('in-range');
            } else {
                td.classList.remove('in-range');
            }
        });
    }

    private clickDate(e: Event): void {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('available')) return;

        const title = target.dataset.title!;
        const row = parseInt(title.substr(1, 1));
        const col = parseInt(title.substr(3, 1));
        const cal = target.closest('.drp-calendar')!;
        const isLeft = cal.classList.contains('left');
        let date = isLeft ? this.leftCalendar.calendar[row][col] : this.rightCalendar.calendar[row][col];

        if (this.timePicker) {
            const timeSelectors = cal.querySelector('.calendar-time')!;
            const hour = parseInt((timeSelectors.querySelector('.hourselect') as HTMLSelectElement).value, 10);
            const minute = parseInt((timeSelectors.querySelector('.minuteselect') as HTMLSelectElement).value, 10);
            const second = this.timePickerSeconds ? parseInt((timeSelectors.querySelector('.secondselect') as HTMLSelectElement).value, 10) : 0;
            const ampm = this.timePicker24Hour ? '' : (timeSelectors.querySelector('.ampmselect') as HTMLSelectElement).value;

            let h = hour;
            if (!this.timePicker24Hour) {
                if (ampm === 'AM' && hour === 12) h = 0;
                if (ampm === 'PM' && hour !== 12) h = hour + 12;
            }
            date = date.set({ hour: h, minute, second });
        }

        if (this.endDate || date < this.startDate.startOf('day')) {
            this.endDate = null!;
            this.setStartDate(date.setZone('local'));
        } else {
            this.setEndDate(date.setZone('local'));
            if (this.autoApply) {
                this.calculateChosenLabel();
                this.clickApply(e);
            }
        }

        if (this.singleDatePicker) {
            this.setEndDate(this.startDate.setZone('local'));
            if (!this.timePicker && this.autoApply) this.clickApply(e);
        }

        this.updateView();
        e.stopPropagation();
    }

    private calculateChosenLabel(): void {
        let customRangeFound = false;
        let chosenLabel = null;

        for (const rangeLabel in this.ranges) {
            if (rangeLabel === this.locale.customRangeLabel) continue;

            const range = this.ranges[rangeLabel];
            if (this.startDate.hasSame(range[0], 'day') && this.endDate.hasSame(range[1], 'day')) {
                customRangeFound = true;
                chosenLabel = rangeLabel;
                break;
            }
        }

        if (!customRangeFound && this.showCustomRangeLabel) {
            chosenLabel = this.locale.customRangeLabel;
        }

        this.chosenLabel = chosenLabel;
    }

    private clickApply(e: Event): void {
        this.hide();
        this.element.dispatchEvent(new CustomEvent('apply.daterangepicker', { bubbles: true, detail: this }));
    }

    private clickCancel(e: Event): void {
        this.startDate = this.oldStartDate.setZone('local');
        this.endDate = this.oldEndDate.setZone('local');
        this.hide();
        this.element.dispatchEvent(new CustomEvent('cancel.daterangepicker', { bubbles: true, detail: this }));
    }

    private monthOrYearChanged(e: Event): void {
        const cal = (e.target as HTMLElement).closest('.drp-calendar')!;
        const isLeft = cal.classList.contains('left');
        const monthEl = cal.querySelector('.monthselect') as HTMLSelectElement;
        const yearEl = cal.querySelector('.yearselect') as HTMLSelectElement;

        const month = parseInt(monthEl.value, 10) + 1; // +1 para Luxon (1-12)
        const year = parseInt(yearEl.value, 10);

        let newDate = DateTime.local(year, month, 1);

        if (isLeft) {
            this.leftCalendar.month = newDate.set({ day: 2 });
            if (this.linkedCalendars) {
                this.rightCalendar.month = newDate.set({ day: 2 }).plus({ months: 1 });
            }
        } else {
            this.rightCalendar.month = newDate.set({ day: 2 });
            if (this.linkedCalendars) {
                this.leftCalendar.month = newDate.set({ day: 2 }).minus({ months: 1 });
            }
        }
        this.updateCalendars();
    }

    private timeChanged(e: Event): void {
        const cal = (e.target as HTMLElement).closest('.drp-calendar')!;
        const isLeft = cal.classList.contains('left');
        const timeSelectors = cal.querySelector('.calendar-time')!;

        const hour = parseInt((timeSelectors.querySelector('.hourselect') as HTMLSelectElement).value, 10);
        const minute = parseInt((timeSelectors.querySelector('.minuteselect') as HTMLSelectElement).value, 10);
        const second = this.timePickerSeconds ? parseInt((timeSelectors.querySelector('.secondselect') as HTMLSelectElement).value, 10) : 0;
        const ampm = this.timePicker24Hour ? '' : (timeSelectors.querySelector('.ampmselect') as HTMLSelectElement).value;

        let h = hour;
        if (!this.timePicker24Hour) {
            if (ampm === 'AM' && hour === 12) h = 0;
            if (ampm === 'PM' && hour !== 12) h = hour + 12;
        }

        if (isLeft) {
            this.startDate = this.startDate.set({ hour: h, minute, second });
            // Si es single date, también actualiza el fin
            if (this.singleDatePicker) this.endDate = this.startDate;
        } else {
            this.endDate = this.endDate.set({ hour: h, minute, second });
        }

        this.updateCalendars();
        this.updateFormInputs();
        this.renderTimePickers();
    }

    private elementChanged(): void {
        const val = (this.element as HTMLInputElement).value;
        const dtFormat = this.locale.format + (this.timePicker ? ' ' + (this.timePicker24Hour ? 'HH:mm' : 'h:mm a') + (this.timePickerSeconds ? ':ss' : '') : '');

        if (val.length < dtFormat.length) return; // Entrada incompleta

        let start: DateTime | null = null;
        let end: DateTime | null = null;

        if (this.singleDatePicker) {
            start = DateTime.fromFormat(val, dtFormat);
            end = start;
        } else if (val.includes(this.locale.separator)) {
            const parts = val.split(this.locale.separator);
            start = DateTime.fromFormat(parts[0], dtFormat);
            end = DateTime.fromFormat(parts[1], dtFormat);
        }

        if (start && end && start.isValid && end.isValid) {
            this.setStartDate(start.setZone('local'));
            this.setEndDate(end.setZone('local'));
        }
        this.updateView();
    }

    private keydown(e: KeyboardEvent): void {
        if ((e.key === 'Tab') || (e.key === 'Enter') || (e.key === 'Escape')) {
            e.key === 'Escape' && e.preventDefault();
            this.hide();
        }
    }

    private updateFormInputs(): void {
        const applyBtn = this.container.querySelector('button.applyBtn') as HTMLButtonElement;

        // La condición de aplicación es si tenemos una fecha de fin, y si la fecha de inicio es <= la de fin.
        if (this.endDate && (this.startDate < this.endDate || this.startDate.hasSame(this.endDate, 'millisecond'))) {
            applyBtn.disabled = false;
        } else {
            applyBtn.disabled = true;
        }
    }

    private updateElement(): void {
        if (this.element.tagName === 'INPUT' && this.autoUpdateInput) {
            let newValue = this.startDate.toFormat(this.locale.format);
            if (this.timePicker) {
                newValue = this.startDate.toFormat(this.locale.format + ' ' + (this.timePicker24Hour ? 'HH:mm' : 'h:mm a') + (this.timePickerSeconds ? ':ss' : ''));
            }

            if (!this.singleDatePicker) {
                let endValue = this.endDate.toFormat(this.locale.format);
                if (this.timePicker) {
                    endValue = this.endDate.toFormat(this.locale.format + ' ' + (this.timePicker24Hour ? 'HH:mm' : 'h:mm a') + (this.timePickerSeconds ? ':ss' : ''));
                }
                newValue += this.locale.separator + endValue;
            }

            if (newValue !== (this.element as HTMLInputElement).value) {
                (this.element as HTMLInputElement).value = newValue;
                this.element.dispatchEvent(new Event('change'));
            }
        }
    }

    public updateRanges(newRanges: { [key: string]: [DateTime | string, DateTime | string] }): void {
        this.ranges = {};
        for (const label in newRanges) {
            const range = newRanges[label];
            const start = typeof range[0] === 'string' ? DateTime.fromFormat(range[0], this.locale.format) : range[0].setZone('local');
            const end = typeof range[1] === 'string' ? DateTime.fromFormat(range[1], this.locale.format) : range[1].setZone('local');

            // Asegurar que las fechas de rango se ajusten al tiempoPicker si está activo
            this.ranges[label] = [
                this.timePicker ? start : start.startOf('day'),
                this.timePicker ? end : end.endOf('day')
            ];
        }

        // Re-renderizar rangos en el DOM
        this.renderRanges();
    }

    private renderRanges(): void {
        const rangesEl = this.container.querySelector('.ranges') as HTMLElement;
        let html = '<ul>';
        let customRangeFound = false;

        for (const label in this.ranges) {
            html += `<li data-range-key="${label}">${label}</li>`;
            if (label === this.locale.customRangeLabel) customRangeFound = true;
        }

        if (!customRangeFound && this.showCustomRangeLabel) {
            html += `<li data-range-key="${this.locale.customRangeLabel}">${this.locale.customRangeLabel}</li>`;
        }

        html += '</ul>';
        Utilities.html(rangesEl, html);
    }

    public remove(): void {
        // Limpiar event listeners
        this.hide();
        Utilities.off(this.element, 'click', this.showProxy!);
        Utilities.off(this.element, 'focus', this.showProxy!);
        Utilities.off(this.element, 'keyup', this.elementChangedProxy!);
        Utilities.off(this.element, 'keydown', this.keydownProxy!);
        Utilities.off(this.element, 'click', this.toggleProxy!);

        // Remover contenedor del DOM
        this.container.remove();

        this.element.dispatchEvent(new CustomEvent('remove.daterangepicker', { bubbles: true, detail: this }));
    }
}