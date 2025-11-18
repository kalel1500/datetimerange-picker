import { DateTime, Info, Duration } from 'luxon';
import { Utilities } from './Utilities';
import { Locale, CalendarData } from './types';

/**
 * Clase responsable de renderizar el calendario (matriz de fechas, navegación y selección).
 */
export class CalendarRenderer {

    constructor(
        private container: HTMLElement,
        private locale: Locale,
        private showDropdowns: boolean,
        private showWeekNumbers: boolean,
        private showISOWeekNumbers: boolean,
        private minYear: number,
        private maxYear: number,
        private isInvalidDate: (date: DateTime) => boolean,
        private isCustomDate: (date: DateTime) => string | string[] | false,
        private linkedCalendars: boolean,
        private singleDatePicker: boolean
    ) {}

    /**
     * Genera la matriz de fechas 6x7 para el mes dado y la asigna a CalendarData.
     * @param calendarData Objeto con el mes a renderizar.
     */
    public buildCalendar(calendarData: CalendarData): void {
        const monthDT = calendarData.month;
        const month = monthDT.month;
        const year = monthDT.year;
        const hour = monthDT.hour;
        const minute = monthDT.minute;
        const second = monthDT.second;

        const firstDayOfMonth = DateTime.local(year, month, 1);

        // Luxon weekday: 1=Mon, 7=Sun. JS Date day: 0=Sun, 6=Sat. locale.firstDay: 0=Sun, 6=Sat (as per original code).
        // Convertir Luxon weekday (1-7) a 0-6 (domingo=0)
        const dayOfWeek = monthDT.set({ day: 1 }).weekday % 7;

        // Calcular la diferencia para empezar en el día correcto de la semana (0-6)
        const firstDayOfWeekInLocale = (dayOfWeek - this.locale.firstDay + 7) % 7;

        // Fecha que será el punto de partida (día de la semana en la fila 0, columna 0)
        let curDate = firstDayOfMonth.minus({ days: firstDayOfWeekInLocale });

        const calendar: DateTime[][] = [];
        for (let i = 0; i < 6; i++) {
            calendar[i] = [];
        }

        for (let i = 0, col = 0, row = 0; i < 42; i++, col++, curDate = curDate.plus({ days: 1 })) {
            if (i > 0 && col % 7 === 0) {
                col = 0;
                row++;
            }
            // Importante: clonar y aplicar hora/minuto/segundo del mes de referencia
            calendar[row][col] = curDate.set({ hour, minute, second }).setZone('local');
        }

        calendarData.calendar = calendar;
    }

    /**
     * Renderiza el HTML del calendario en el contenedor.
     */
    public render(side: 'left' | 'right', calendarData: CalendarData, startDate: DateTime, endDate: DateTime | null, minDate: DateTime | false, maxDate: DateTime | false, maxSpan: Duration | false): void {
        const calendar = calendarData.calendar;
        const firstDay = calendar[0][0];
        const lastDay = calendar[5][6];

        let minDateLimit = side === 'left' ? minDate : startDate.startOf('day');
        let maxDateLimit = maxDate;

        // Ajustar maxDate para reflejar el maxSpan (límite superior)
        if (endDate === null && maxSpan) {
            const maxLimit = startDate.plus(maxSpan).endOf('day');
            if (!maxDateLimit || maxLimit > maxDateLimit) { // Luxon uses > for greater than
                maxDateLimit = maxLimit;
            }
        }

        let html = '<table class="table-condensed">';
        html += '<thead>';
        html += '<tr>';

        // Celda para el número de semana
        if (this.showWeekNumbers || this.showISOWeekNumbers)
            html += '<th></th>';

        // Flecha "Prev" (anterior)
        const isPrevAvailable = (!minDateLimit || firstDay.startOf('day') > minDateLimit.startOf('day')) && (side === 'left' || !this.linkedCalendars);
        html += isPrevAvailable ? '<th class="prev available"><span></span></th>' : '<th></th>';

        // Título del mes/año o Dropdowns
        let dateHtml = calendar[1][1].toFormat('MMMM yyyy');

        if (this.showDropdowns) {
            const currentMonth = calendar[1][1].month; // 1-12
            const currentYear = calendar[1][1].year;
            const maxYearLimit = maxDateLimit ? maxDateLimit.year : this.maxYear;
            const minYearLimit = minDateLimit ? minDateLimit.year : this.minYear;
            const inMinYear = currentYear === minYearLimit;
            const inMaxYear = currentYear === maxYearLimit;

            let monthHtml = '<select class="monthselect">';
            for (let m = 1; m <= 12; m++) { // Luxon month is 1-12
                const monthName = this.locale.monthNames[m - 1]; // Usar 0-indexed locale array
                const isDisabled = (inMinYear && minDateLimit && m < minDateLimit.month) || (inMaxYear && maxDateLimit && m > maxDateLimit.month);
                monthHtml += `<option value="${m - 1}" ${m === currentMonth ? 'selected="selected"' : ''} ${isDisabled ? 'disabled="disabled"' : ''}>${monthName}</option>`;
            }
            monthHtml += "</select>";

            let yearHtml = '<select class="yearselect">';
            for (let y = minYearLimit; y <= maxYearLimit; y++) {
                yearHtml += `<option value="${y}" ${y === currentYear ? 'selected="selected"' : ''}>${y}</option>`;
            }
            yearHtml += '</select>';

            dateHtml = monthHtml + yearHtml;
        }

        html += `<th colspan="5" class="month">${dateHtml}</th>`;

        // Flecha "Next" (siguiente)
        const isNextAvailable = (!maxDateLimit || lastDay.endOf('day') < maxDateLimit.endOf('day')) && (side === 'right' || !this.linkedCalendars || this.singleDatePicker);
        html += isNextAvailable ? '<th class="next available"><span></span></th>' : '<th></th>';

        html += '</tr>';
        html += '<tr>';

        // Etiquetas de número de semana
        if (this.showWeekNumbers || this.showISOWeekNumbers)
            html += `<th class="week">${this.locale.weekLabel}</th>`;

        // Etiquetas de días de la semana
        this.locale.daysOfWeek.forEach(day => {
            html += `<th>${day}</th>`;
        });

        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';

        // Celdas de días
        for (let row = 0; row < 6; row++) {
            html += '<tr>';

            // Número de semana (Luxon weekNumber)
            if (this.showWeekNumbers || this.showISOWeekNumbers)
                html += `<td class="week">${calendar[row][0].weekNumber}</td>`;

            for (let col = 0; col < 7; col++) {
                const date = calendar[row][col];
                let classes: string[] = [];
                let isDisabled = false;

                // Día de hoy
                if (date.hasSame(DateTime.local(), "day"))
                    classes.push('today');

                // Fines de semana (Luxon weekday: 1=Mon, 7=Sun)
                if (date.weekday === 6 || date.weekday === 7)
                    classes.push('weekend');

                // Días fuera del mes actual
                if (date.month !== calendar[1][1].month)
                    classes.push('off', 'ends');

                // Días deshabilitados por minDate
                if (minDateLimit && date.startOf('day') < minDateLimit.startOf('day')) {
                    classes.push('off', 'disabled');
                    isDisabled = true;
                }

                // Días deshabilitados por maxDate
                if (maxDateLimit && date.endOf('day') > maxDateLimit.endOf('day')) {
                    classes.push('off', 'disabled');
                    isDisabled = true;
                }

                // Días deshabilitados por función personalizada
                if (this.isInvalidDate(date)) {
                    classes.push('off', 'disabled');
                    isDisabled = true;
                }

                // Inicio/Fin de la selección
                if (date.hasSame(startDate, 'day'))
                    classes.push('active', 'start-date');

                if (endDate && date.hasSame(endDate, 'day'))
                    classes.push('active', 'end-date');

                // Rango seleccionado: si la fecha está entre (después del inicio y antes del fin)
                if (endDate && date > startDate.endOf('day') && date < endDate.startOf('day'))
                    classes.push('in-range');

                // Clases personalizadas
                const isCustom = this.isCustomDate(date);
                if (isCustom !== false) {
                    Array.isArray(isCustom) ? classes.push(...isCustom) : classes.push(isCustom);
                }

                if (!isDisabled)
                    classes.push('available');

                const cname = classes.join(' ');
                html += `<td class="${cname.trim()}" data-title="r${row}c${col}">${date.day}</td>`;
            }
            html += '</tr>';
        }

        html += '</tbody>';
        html += '</table>';

        const calendarTableEl = this.container.querySelector(`.drp-calendar.${side} .calendar-table`);
        Utilities.html(calendarTableEl, html);
    }
}