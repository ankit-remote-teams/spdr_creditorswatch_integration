import express from 'express';
import { syncInitialSimproContactData, syncInitialInvoiceCreditNoteData, updateInvoiceCreditorNoteDataToCreditorsWatch, updateInvoiceLateFee } from '../controllers/syncController';
const router = express.Router();
import { apiKeyAuth } from '../middlewares/apiAuth';

router.get('/check-middleware', apiKeyAuth, async (req, res) => {
    res.status(200).json({ message: 'Middleware check passed' })
})

router.get('/sync-initial-contact-data', apiKeyAuth, syncInitialSimproContactData);
router.get('/sync-initial-invoice-creditnote-data', apiKeyAuth, syncInitialInvoiceCreditNoteData);
router.put('/update-invoice-credit-note-data-to-creditors-watch', apiKeyAuth, updateInvoiceCreditorNoteDataToCreditorsWatch);
router.put('/update-late-fee-for-invoice', apiKeyAuth, updateInvoiceLateFee);

export default router;
