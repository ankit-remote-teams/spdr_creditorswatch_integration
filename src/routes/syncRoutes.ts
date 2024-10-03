import express from 'express';
import { syncInitialSimproContactData, syncInitialInvoiceCreditNoteData } from '../controllers/syncController';
const router = express.Router();

router.get('/sync-initial-contact-data', syncInitialSimproContactData);
router.get('/sync-initial-invoice-creditnote-data', syncInitialInvoiceCreditNoteData);

export default router;
