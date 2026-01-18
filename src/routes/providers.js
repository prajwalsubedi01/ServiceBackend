import express from 'express';
import { providerController } from '../controllers/providerController.js';

const router = express.Router();

router.get('/', providerController.getProviders);
router.get('/:id', providerController.getProviderById);
router.get('/category/:category', providerController.getProvidersByCategory);

export default router;