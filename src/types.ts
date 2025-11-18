import { DateTime, Duration } from 'luxon';

/**
 * Define la estructura para la configuración regional (Locale) del DateRangePicker.
 */
export interface Locale {
    direction: 'ltr' | 'rtl';
    format: string; // Formato de fecha Luxon (ej: 'dd/MM/yyyy')
    separator: string;
    applyLabel: string;
    cancelLabel: string;
    weekLabel: string;
    customRangeLabel: string;
    daysOfWeek: string[]; // Nombres de los días, ajustados por firstDay (0=Sun, 1=Mon...)
    monthNames: string[]; // Nombres de los meses
    firstDay: number; // 0 para Domingo (Sunday), 1 para Lunes (Monday), etc.
}

/**
 * Define la estructura para las opciones de configuración del DateRangePicker.
 */
export interface Options {
    parentEl?: HTMLElement | string;
    startDate?: DateTime | string;
    endDate?: DateTime | string;
    minDate?: DateTime | string | false;
    maxDate?: DateTime | string | false;
    maxSpan?: Duration | false;
    autoApply?: boolean;
    singleDatePicker?: boolean;
    showDropdowns?: boolean;
    minYear?: number;
    maxYear?: number;
    showWeekNumbers?: boolean;
    showISOWeekNumbers?: boolean;
    showCustomRangeLabel?: boolean;
    timePicker?: boolean;
    timePicker24Hour?: boolean;
    timePickerIncrement?: number;
    timePickerSeconds?: boolean;
    linkedCalendars?: boolean;
    autoUpdateInput?: boolean;
    alwaysShowCalendars?: boolean;
    ranges?: { [key: string]: [DateTime | string, DateTime | string] };
    opens?: 'left' | 'right' | 'center';
    drops?: 'down' | 'up' | 'auto';
    buttonClasses?: string | string[];
    applyButtonClasses?: string;
    cancelButtonClasses?: string;
    locale?: Partial<Locale>;
    template?: string;
    isInvalidDate?: (date: DateTime) => boolean;
    isCustomDate?: (date: DateTime) => string | string[] | false;
}

/**
 * Estructura de datos para un calendario individual.
 */
export interface CalendarData {
    month: DateTime; // El mes actual del calendario (usado para la visualización)
    calendar: DateTime[][]; // La matriz 6x7 de fechas del calendario
}

export type RangeDates = [DateTime, DateTime];
export type Callback = (startDate: DateTime, endDate: DateTime, label: string | null) => void;