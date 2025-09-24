// src/queue.ts
import Queue from 'bull';
import { SmartsheetService } from '../services/SmartsheetServices/SmartsheetServices';
import { SimproWebhookType } from '../types/simpro.types';

// Create a Bull queue
const simproWebhookQueue = new Queue('simproWebhookQueue', {
    redis: {
        host: 'localhost',
        port: 6379,
    },
});

// Process jobs in the queue
simproWebhookQueue.process(async (job) => {
    const { webhookData } = job.data;

    console.log("Processing Simpro webhook job:", webhookData);

    try {
        switch (webhookData.ID) {
            case "job.schedule.created":
            case "job.schedule.updated":
                // console.log("Schedule Create/Update ", webhookData);
                await SmartsheetService.handleAddUpdateScheduleToSmartsheet(webhookData);
                break;

            case "contractor.job.updated":
            case "contractor.job.created":
                await SmartsheetService.handleAddUpdateWorkOrderLineItemsToSmartsheet(webhookData);
                break;

            case "job.schedule.deleted":
                // console.log("Schedule Deleted ", webhookData);
                await SmartsheetService.handleDeleteScheduleInSmartsheet(webhookData);
                break;

            case "job.created":
            case "job.updated":
                // console.log("Job Created/Updated ", webhookData);
                await SmartsheetService.handleAddUpdateCostcenterRoofingToSmartSheet(webhookData);
                // console.log("Job processed successfully");
                break;

            case "invoice.created":
            case "invoice.updated":
                // console.log("Invoice Created/Updated ", webhookData);
                await SmartsheetService.handleAddUpdateRoofingCostcenterForInvoiceSmartsheet(webhookData);
                // console.log("Invoice processed successfully");
                break;

            case "job.stage.pending":
            case "job.stage.progress":
            case "job.stage.complete":
            case "job.stage.invoiced":
            case "job.stage.archived":
                // console.log("Job Stage Change ", webhookData);
                await SmartsheetService.handleAddUpdateCostcenterRoofingToSmartSheet(webhookData);
                break;


            default:
                console.warn("Unhandled webhook ID:", webhookData.ID);
        }
    } catch (error) {
        console.error("Error processing job:", {
            jobId: job.id,
            webhookID: webhookData.ID,
            error: error instanceof Error ? error.message : JSON.stringify(error),
            stack: error instanceof Error ? error.stack : undefined,
        });

        // Optionally rethrow so the job is marked as failed and retried if configured
        throw error;
    }
});

// Handle errors in the queue globally
simproWebhookQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error:`, {
        message: err.message,
        stack: err.stack,
        data: job.data,
    });
});

// Export the queue for use in other files
export { simproWebhookQueue };