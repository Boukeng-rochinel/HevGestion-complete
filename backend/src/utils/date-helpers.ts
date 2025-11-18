// src/utils/date-helpers.ts
export class DateHelpers {
  static formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    switch (format) {
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  static isWithinDateRange(date: Date, startDate: Date, endDate: Date): boolean {
    const d = new Date(date).getTime();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return d >= start && d <= end;
  }

  static addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  static getMonthsDifference(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return (
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth())
    );
  }

  static getFiscalYear(date: Date): number {
    return new Date(date).getFullYear();
  }

  static isValidFiscalPeriod(startDate: Date, endDate: Date): boolean {
    const months = this.getMonthsDifference(startDate, endDate);
    // Fiscal period should be 12 months (can be adjusted)
    return months === 12;
  }
}