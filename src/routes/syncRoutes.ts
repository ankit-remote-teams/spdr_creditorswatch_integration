import express from 'express';
import { syncInitialSimproContactData, syncInitialInvoiceCreditNoteData, updateInvoiceCreditorNoteDataToCreditorsWatch } from '../controllers/syncController';
const router = express.Router();

router.get('/sync-initial-contact-data', syncInitialSimproContactData);
router.get('/sync-initial-invoice-creditnote-data', syncInitialInvoiceCreditNoteData);
router.put('/update-invoice-credit-note-data-to-creditors-watch', updateInvoiceCreditorNoteDataToCreditorsWatch)

export default router;
