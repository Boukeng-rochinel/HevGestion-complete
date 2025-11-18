// src/utils/validators.ts
export class Validators {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidTaxNumber(taxNumber: string): boolean {
    // Cameroon tax number format: P + 9 digits
    const taxRegex = /^P\d{9}$/;
    return taxRegex.test(taxNumber);
  }

  static isValidNIU(niu: string): boolean {
    // NIU format validation
    return /^[A-Z]{1}\d{12}$/.test(niu);
  }

  static isValidPhoneNumber(phone: string): boolean {
    // International phone format
    const phoneRegex = /^\+?[1-9]\d{8,14}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  }

  static isValidCameroonPhoneNumber(phoneNumber: string): boolean {
    // Remove any spaces, dashes, or other non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, "");

    // Cameroon phone numbers should be 9 digits (without country code)
    if (cleanNumber.length !== 9) {
      return false;
    }

    // Check if it starts with valid prefixes for MTN and Orange
    const mtnPrefixes = ["67", "68", "69"]; // MTN Cameroon
    const orangePrefixes = ["65", "66"]; // Orange Cameroon

    const prefix = cleanNumber.substring(0, 2);

    return mtnPrefixes.includes(prefix) || orangePrefixes.includes(prefix);
  }

  static isValidAccountNumber(accountNumber: string): boolean {
    // OHADA account numbers: 6-8 digits
    return /^\d{6,8}$/.test(accountNumber);
  }

  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }
}