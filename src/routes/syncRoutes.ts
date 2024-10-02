import express from 'express';
import { syncInitialSimproContactData, syncInitialInvoiceData } from '../controllers/syncController';
const router = express.Router();

router.get('/sync-initial-contact-data', syncInitialSimproContactData);
router.get('/sync-initial-invoice-data', syncInitialInvoiceData);

export default router;
