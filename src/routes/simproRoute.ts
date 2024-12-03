import express from 'express';
const router = express.Router();
import { apiKeyAuth } from '../middlewares/apiAuth';
import { getJobCardReport, getQuotationReport } from '../controllers/simproController';

router.get('/check-middleware', apiKeyAuth, async (req, res) => {
    res.status(200).json({ message: 'Middleware check passed' })
})

router.get('/get-job-card-report', apiKeyAuth, getJobCardReport);

router.get('/ongoing-quotation-report', apiKeyAuth, getQuotationReport);

export default router;
