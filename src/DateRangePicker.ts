// src/DateRangePicker.ts

import { DateTime, Duration, Settings, Info } from 'luxon';
import { Utilities } from './Utilities';
import { CalendarRenderer } from './CalendarRenderer';
import { TimePickerRenderer } from './TimePickerRenderer';
import { Options, Locale, CalendarData, RangeDates, Callback } from './types';

// Establecer locale por defecto (Luxon es flexible, pero esto ayuda con Info.months/weekdays)
Settings.defaultLocale = 'es';

/**
 * Clase principal del DateRangePicker, refactorizada a TypeScript y Luxon.
 */
export class DateRangePicker {
    // [PROPIEDADES]
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
    private minYear: number = DateTime.local().minus({ years: 100 }).year;
    private maxYear: number = DateTime.local().plus({ years: 100 }).year;
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

        this.startDate = DateTime.local().startOf('day');
        this.endDate = DateTime.local().endOf('day');
        this.oldStartDate = this.startDate.setZone('local');
        this.oldEndDate = this.endDate.setZone('local');

        // El mes se inicializa al día 2 para evitar problemas de mes con menos de 2 días
        this.leftCalendar = { month: this.startDate.set({ day: 2 }), calendar: [] };
        this.rightCalendar = { month: this.startDate.set({ day: 2 }).plus({ months: 1 }), calendar: [] };

        // 2. Configuración Regional por Defecto (español)
        const currentLocaleInfo = Info.setLocale('es');
        this.locale = {
            direction: 'ltr',
            format: 'dd/MM/yyyy', // Formato estándar de Luxon para fecha en español
            separator: ' - ',
            applyLabel: 'Aplicar',
            cancelLabel: 'Cancelar',
            weekLabel: 'S',
            customRangeLabel: 'Rango Personalizado',
            daysOfWeek: currentLocaleInfo.weekdays('short', { locale: 'es' }),
            monthNames: currentLocaleInfo.months('short', { locale: 'es' }),
            firstDay: 1 // Lunes (1) por defecto, en lugar del domingo (0) del original.
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
        this.calendarRenderer = new CalendarRenderer(this.container, this.locale, this.showDropdowns, this.options.showWeekNumbers || false, this.options.showISOWeekNumbers || false, this.minYear, this.maxYear, this.isInvalidDate, this.isCustomDate, this.linkedCalendars, this.singleDatePicker);
        this.timePickerRenderer = new TimePickerRenderer(this.container, this.timePickerSeconds, this.timePickerIncrement, this.timePicker24Hour, this.locale);

        // 6. Configurar Eventos
        this.setupEventListeners();

        // 7. Actualizar el elemento de entrada
        this.updateElement();

        this.updateMonthsInView();
    }

    private applyOptions(options: Options): void {
        if (this.element.classList.contains('pull-right')) this.opens = 'left';
        if (this.element.classList.contains('dropup')) this.drops = 'up';
        if (typeof options.opens === 'string') this.opens = options.opens;
        if (typeof options.drops === 'string') this.drops = options.drops;

        if (typeof options.locale === 'object') {
            this.locale = { ...this.locale, ...options.locale as Locale };
            // Recalcular rotación de días de la semana si se cambia 'firstDay'
            if (options.locale.firstDay !== undefined) {
                this.locale.daysOfWeek = Info.weekdays('short', { locale: Settings.defaultLocale });
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
                return remainder !== 0 ? dt.minus({ minutes: remainder }) : dt; // Truncate minutes
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
            this.keydownProxy = this.keydown.bind(this);
            Utilities.on(this.element, 'keydown', this.keydownProxy);
        } else {
            this.toggleProxy = this.toggle.bind(this);
            Utilities.on(this.element, 'click', this.toggleProxy);
            Utilities.on(this.element, 'keydown', this.toggleProxy);
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
        // (Lógica de validación y truncamiento de tiempo omitida por brevedad, está en el constructor)
        this.startDate = newStartDate;
        if (!this.isShowing) this.updateElement();
        this.updateMonthsInView();
    }

    public setEndDate(endDate: DateTime | string): void {
        const newEndDate = typeof endDate === 'string' ? DateTime.fromFormat(endDate, this.locale.format) : endDate.setZone('local');
        // (Lógica de validación y truncamiento de tiempo omitida por brevedad, está en el constructor)
        this.endDate = newEndDate;
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

    // [MÉTODOS PRIVADOS]
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
            const formattedStart = this.startDate.toFormat(this.locale.format);
            const formattedEnd = this.endDate.toFormat(this.locale.format);
            Utilities.html(this.container.querySelector('.drp-selected'), formattedStart + this.locale.separator + formattedEnd);
        }
    }

    private updateMonthsInView(): void {
        if (this.endDate) {
            this.leftCalendar.month = this.startDate.set({ day: 2 });
            if (!this.linkedCalendars && (this.endDate.month !== this.startDate.month || this.endDate.year !== this.startDate.year)) {
                this.rightCalendar.month = this.endDate.set({ day: 2 });
            } else {
                this.rightCalendar.month = this.startDate.set({ day: 2 }).plus({ months: 1 });
            }
        }
        if (this.maxDate && this.linkedCalendars && !this.singleDatePicker && this.rightCalendar.month > this.maxDate) {
            this.rightCalendar.month = this.maxDate.set({ day: 2 });
            this.leftCalendar.month = this.maxDate.set({ day: 2 }).minus({ months: 1 });
        }
    }

    private updateCalendars(): void {
        const drpCalendarElList = this.container.querySelectorAll('.drp-calendar');
        // Limpiar eventos (omitiendo por brevedad)

        this.calendarRenderer.buildCalendar(this.leftCalendar);
        this.calendarRenderer.buildCalendar(this.rightCalendar);

        this.calendarRenderer.render('left', this.leftCalendar, this.startDate, this.endDate, this.minDate, this.maxDate, this.maxSpan);
        this.calendarRenderer.render('right', this.rightCalendar, this.startDate, this.endDate, this.minDate, this.maxDate, this.maxSpan);

        this.calculateChosenLabel();

        // Re-configurar eventos (omitiendo por brevedad)
    }

    private renderTimePickers(): void {
        this.timePickerRenderer.render('left', this.startDate, this.startDate, this.minDate, this.maxDate, this.maxSpan);
        if (this.endDate) {
            this.timePickerRenderer.render('right', this.endDate, this.startDate, this.startDate, this.maxDate, this.maxSpan);
        } else {
            this.timePickerRenderer.render('right', this.rightCalendar.month, this.startDate, this.startDate, this.maxDate, this.maxSpan);
            const selectElList = this.container.querySelectorAll('.right .calendar-time select');
            selectElList.forEach(el => {
                (el as HTMLSelectElement).disabled = true;
                el.classList.add('disabled');
            });
        }
    }

    private move(): void {
        // Lógica de posicionamiento (usando Utilities.offset y cálculos de Luxon)
        const elementOffset = Utilities.offset(this.element);
        let parentOffset = { top: 0, left: 0 };
        // ... (cálculos de move)
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

        const title = target.dataset.title!;
        const row = parseInt(title.substr(1, 1));
        const col = parseInt(title.substr(3, 1));
        const cal = target.closest('.drp-calendar')!;
        const date = cal.classList.contains('left') ? this.leftCalendar.calendar[row][col] : this.rightCalendar.calendar[row][col];

        this.container.querySelectorAll('.drp-calendar tbody td').forEach(td => {
            if (td.classList.contains('week')) return;

            const title = td.dataset.title!;
            const r = parseInt(title.substr(1, 1));
            const c = parseInt(title.substr(3, 1));
            const d = td.closest('.drp-calendar')!.classList.contains('left')
                ? this.leftCalendar.calendar[r][c]
                : this.rightCalendar.calendar[r][c];

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
            // (Lógica de obtención de hora y minuto omitida por brevedad)
            // Aplica la hora a 'date'
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
        // (Lógica de comparación de rango usando Luxon.hasSame y toFormat omitida por brevedad)
    }

    private clickApply(e: Event): void {
        this.hide();
        e.target!.dispatchEvent(new CustomEvent('apply.daterangepicker', { bubbles: true, detail: this }));
    }

    private clickCancel(e: Event): void {
        this.startDate = this.oldStartDate.setZone('local');
        this.endDate = this.oldEndDate.setZone('local');
        this.hide();
        e.target!.dispatchEvent(new CustomEvent('cancel.daterangepicker', { bubbles: true, detail: this }));
    }

    private monthOrYearChanged(e: Event): void {
        const cal = (e.target as HTMLElement).closest('.drp-calendar')!;
        const isLeft = cal.classList.contains('left');

        const month = parseInt((cal.querySelector('.monthselect') as HTMLSelectElement).value, 10) + 1; // +1 para Luxon (1-12)
        const year = parseInt((cal.querySelector('.yearselect') as HTMLSelectElement).value, 10);

        let newDate = DateTime.local(year, month, 1);
        // (Lógica de sanidad de fecha y actualización de calendarios omitida por brevedad)
        this.updateCalendars();
    }

    private timeChanged(e: Event): void {
        // (Lógica de actualización de hora usando setStartDate/setEndDate omitida por brevedad)
        this.updateCalendars();
        this.updateFormInputs();
        this.renderTimePickers();
    }

    private elementChanged(): void {
        // (Lógica de análisis de entrada de texto y actualización de fechas omitida por brevedad)
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

        if (this.singleDatePicker || (this.endDate && (this.startDate < this.endDate || this.startDate.hasSame(this.endDate, 'millisecond')))) {
            applyBtn.disabled = false;
        } else {
            applyBtn.disabled = true;
        }
    }

    private updateElement(): void {
        if (this.element.tagName === 'INPUT' && this.autoUpdateInput) {
            let newValue = this.startDate.toFormat(this.locale.format);
            if (!this.singleDatePicker) {
                newValue += this.locale.separator + this.endDate.toFormat(this.locale.format);
            }
            if (newValue !== (this.element as HTMLInputElement).value) {
                (this.element as HTMLInputElement).value = newValue;
                this.element.dispatchEvent(new Event('change'));
            }
        }
    }

    public updateRanges(newRanges: { [key: string]: [DateTime | string, DateTime | string] }): void {
        // (Lógica de actualización de rangos omitida por brevedad)
    }

    public remove(): void {
        // (Lógica de limpieza de event listeners y elementos DOM omitida por brevedad)
    }
}