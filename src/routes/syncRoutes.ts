import express from 'express';
import { syncInitialSimproContactData, syncInitialInvoiceData } from '../controllers/syncController';
const router = express.Router();

router.get('/sync-contact-data', syncInitialSimproContactData);
router.get('/sync-invoice-data', syncInitialInvoiceData);

export default router;
