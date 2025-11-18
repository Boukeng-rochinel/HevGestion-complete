// src/controllers/country.controller.ts
import { Request, Response, NextFunction } from 'express';

const COUNTRIES = [
    { code: 'CM', name: 'Cameroun', currency: 'XAF' },
    { code: 'CI', name: 'Côte d\'Ivoire', currency: 'XOF' },
  { code: 'SN', name: 'Sénégal', currency: 'XOF' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF' },
  { code: 'TG', name: 'Togo', currency: 'XOF' },
  { code: 'BJ', name: 'Bénin', currency: 'XOF' },
];

class CountryController {
  async getCountries(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        countries: COUNTRIES,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const countryController = new CountryController();
