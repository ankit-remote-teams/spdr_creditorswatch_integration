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

    if (webhookData.ID === "job.schedule.created" || webhookData.ID === "job.schedule.updated") {
        console.log("Schedule Create/Update ", webhookData);
        await SmartsheetService.handleAddUpdateScheduleToSmartsheet(webhookData);
    } else if (webhookData.ID === "job.schedule.deleted") {
        console.log("Schedule Deleted ", webhookData);
        await SmartsheetService.handleDeleteScheduleInSmartsheet(webhookData);
    }
});

// Handle errors in the queue
simproWebhookQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error:`, err);
});

// Export the queue for use in other files
export { simproWebhookQueue };