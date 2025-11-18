import { DateTime, Duration } from 'luxon';
import { Utilities } from './Utilities';
import { Locale } from './types';

/**
 * Clase responsable de renderizar el selector de tiempo (horas, minutos, segundos, AM/PM).
 */
export class TimePickerRenderer {

    constructor(private container: HTMLElement, private timePickerSeconds: boolean, private timePickerIncrement: number, private timePicker24Hour: boolean, private locale: Locale) {}

    /**
     * Renderiza el selector de tiempo para un lado (left/right) con la fecha dada.
     */
    public render(side: 'left' | 'right', selected: DateTime, startDate: DateTime, minDate: DateTime | false, maxDate: DateTime | false, maxSpan: Duration | false): void {

        const timeSelector = this.container.querySelector(`.drp-calendar.${side} .calendar-time`) as HTMLElement;
        if (!timeSelector) return;

        let html = '';

        let currentSelected = selected.setZone('local');
        let currentMinDate = side === 'left' ? minDate : (startDate.setZone('local'));

        if (maxSpan) {
            const maxLimit = startDate.plus(maxSpan);
            if (!maxDate || maxLimit < maxDate) {
                maxDate = maxLimit;
            }
        }

        // --- Hours ---
        html += '<select class="hourselect">';

        const startHour = this.timePicker24Hour ? 0 : 1;
        const endHour = this.timePicker24Hour ? 23 : 12;
        const selectedHour = currentSelected.hour;

        for (let i = startHour; i <= endHour; i++) {
            let iIn24 = i;
            if (!this.timePicker24Hour) {
                iIn24 = selectedHour >= 12 ? (i === 12 ? 12 : i + 12) : (i === 12 ? 0 : i);
            }

            const time = currentSelected.set({ hour: iIn24 }).set({ minute: 0 }).set({ second: 0 });
            let disabled = false;

            if (currentMinDate && time.set({ minute: 59 }).set({ second: 59 }) < currentMinDate) disabled = true;
            if (maxDate && time.set({ minute: 0 }).set({ second: 0 }) > maxDate) disabled = true;

            const isSelected = iIn24 === selectedHour && !disabled;
            html += `<option value="${i}" ${isSelected ? 'selected="selected"' : ''} ${disabled ? 'disabled="disabled" class="disabled"' : ''}>${i}</option>`;
        }
        html += '</select> ';

        // --- Minutes ---
        html += ': <select class="minuteselect">';
        const selectedMinute = currentSelected.minute;

        for (let i = 0; i < 60; i += this.timePickerIncrement) {
            const padded = i < 10 ? '0' + i : String(i);
            const time = currentSelected.set({ minute: i }).set({ second: 0 });

            let disabled = false;
            if (currentMinDate && time.set({ second: 59 }) < currentMinDate) disabled = true;
            if (maxDate && time.set({ second: 0 }) > maxDate) disabled = true;

            const isSelected = selectedMinute >= i && selectedMinute < i + this.timePickerIncrement && !disabled;
            html += `<option value="${i}" ${isSelected ? 'selected="selected"' : ''} ${disabled ? 'disabled="disabled" class="disabled"' : ''}>${padded}</option>`;
        }
        html += '</select> ';

        // --- Seconds ---
        if (this.timePickerSeconds) {
            html += ': <select class="secondselect">';
            const selectedSecond = currentSelected.second;

            for (let i = 0; i < 60; i++) {
                const padded = i < 10 ? '0' + i : String(i);
                const time = currentSelected.set({ second: i });

                let disabled = false;
                if (currentMinDate && time < currentMinDate) disabled = true;
                if (maxDate && time > maxDate) disabled = true;

                const isSelected = selectedSecond === i && !disabled;
                html += `<option value="${i}" ${isSelected ? 'selected="selected"' : ''} ${disabled ? 'disabled="disabled" class="disabled"' : ''}>${padded}</option>`;
            }
            html += '</select> ';
        }

        // --- AM/PM ---
        if (!this.timePicker24Hour) {
            html += '<select class="ampmselect">';

            const am = currentSelected.set({ hour: 0 }).set({ minute: 0 }).set({ second: 0 });
            const pm = currentSelected.set({ hour: 12 }).set({ minute: 0 }).set({ second: 0 });

            let amHtml = '';
            let pmHtml = '';

            if (currentMinDate && pm < currentMinDate) amHtml = ' disabled="disabled" class="disabled"';
            if (maxDate && am > maxDate) pmHtml = ' disabled="disabled" class="disabled"';

            if (selectedHour >= 12) {
                html += `<option value="AM"${amHtml}>AM</option><option value="PM" selected="selected"${pmHtml}>PM</option>`;
            } else {
                html += `<option value="AM" selected="selected"${amHtml}>AM</option><option value="PM"${pmHtml}>PM</option>`;
            }

            html += '</select>';
        }

        Utilities.html(timeSelector, html);
    }
}