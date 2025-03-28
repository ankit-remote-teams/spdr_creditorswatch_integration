import express from 'express';
const router = express.Router();
import { apiKeyAuth } from '../middlewares/apiAuth';
import { getJobCardReport, getMinimalJobReport, getQuotationReport, simproWebhookHandler, fetchJobCostCenterDetail } from '../controllers/simproController';

router.get('/check-middleware', apiKeyAuth, async (req, res) => {
    res.status(200).json({ message: 'Middleware check passed' })
})

router.get('/get-job-card-report', apiKeyAuth, getJobCardReport);
router.get('/get-minimal-data-schedule', getMinimalJobReport)

router.get('/ongoing-quotation-report', apiKeyAuth, getQuotationReport);

router.post('/webhooks', simproWebhookHandler)

router.get('/get-jobcostcenter-details/:incomeAccount', apiKeyAuth, fetchJobCostCenterDetail)

export default router;
