import express from 'express';
const router = express.Router();

import { handleSmartSheetWebhook, handleSmartSheetWebhookPost, updateAmountValuesInRoofingWipSheet, updateSuburbDataForSite } from '../controllers/smartSheetController';

// To update myob data to smartsheet, this is manual API call, that can be sent from postman or frontend whenever it needs to update the myob data to the smartsheet.
router.get("/webhooks", handleSmartSheetWebhook);

// This route handles the webhook API trigger from smartsheet.
router.post("/webhooks", handleSmartSheetWebhookPost);

router.put('/update-site-suburb',updateSuburbDataForSite);
router.put('/update-amount-values-in-wip', updateAmountValuesInRoofingWipSheet)


export default router;  // Use default export
