import express from 'express';
const router = express.Router();
import { apiKeyAuth } from '../middlewares/apiAuth';
import {
    getJobCardReport,
    getMinimalJobReport,
    getQuotationReport,
    simproWebhookHandler,
    fetchJobCostCenterDetail,
    manualSyncWipRoofingSheet,
    manualSyncWipRoofingSheetForJobID,
    getJobCardReportByID
} from '../controllers/simproController';

router.get('/check-middleware', apiKeyAuth, async (req, res) => {
    res.status(200).json({ message: 'Middleware check passed' })
})

router.get('/get-minimal-data-schedule', getMinimalJobReport)
router.get('/ongoing-quotation-report', apiKeyAuth, getQuotationReport);
router.post('/webhooks', simproWebhookHandler)
router.get('/get-jobcostcenter-details/:incomeAccount', apiKeyAuth, fetchJobCostCenterDetail)

// Manual Sync routes 
// Route to update the job card v2 data in the smartsheet for  the previous 2 days to all future schedule for the data.
router.get('/get-job-card-report', apiKeyAuth, getJobCardReport);

// Route to manually sync the WIP Roofing sheet for the jobs updated in last 30 hours
router.get('/manual-sync-wip-roofing-sheet', apiKeyAuth, manualSyncWipRoofingSheet);

router.get('/get-job-card-report/:jobID/:sectionID/:costCenterID/:scheduleID', apiKeyAuth, getJobCardReportByID);
router.get('/manual-sync-wip-roofing-sheet/:jobID', apiKeyAuth, manualSyncWipRoofingSheetForJobID);


export default router;
