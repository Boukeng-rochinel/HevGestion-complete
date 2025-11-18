// src/routes/country.routes.ts
import { Router } from "express";
import { countryController } from "../controllers/country.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, countryController.getCountries);

export default router;
