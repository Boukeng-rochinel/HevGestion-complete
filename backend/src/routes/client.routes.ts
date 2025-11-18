// // src/routes/client.routes.ts
// import { Router } from 'express';
// import { clientController } from '../controllers/client.controller';
// import { authenticate } from '../middleware/auth.middleware';
// import { validate } from '../middleware/validation.middleware';
// import { createClientSchema } from '../validators/client.validator';

// const router = Router();

// router.get('/', authenticate, clientController.getClients);
// router.get('/:id', authenticate, clientController.getClientById);
// router.post('/', authenticate, validate(createClientSchema), clientController.createClient);
// router.put('/:id', authenticate, clientController.updateClient);

// export default router;


// src/routes/client.routes.ts
import { Router } from 'express';
import { clientController } from '../controllers/client.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { 
  createClientSchema, 
  updateClientSchema 
} from '../validators/client.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Client routes
router.get('/', clientController.getClients);
router.get('/countries', clientController.getCountries);
router.post('/', validate(createClientSchema), clientController.createClient);
router.get('/:id', clientController.getClientById);
router.put('/:id', validate(updateClientSchema), clientController.updateClient);
router.delete('/:id', clientController.deleteClient);
router.get('/:id/users', clientController.getClientUsers);

export default router;