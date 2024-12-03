const cron = require('node-cron');
import { AxiosError } from "axios";
import moment from "moment";
import { SimproScheduleType } from "../types/simpro.types";
import { fetchScheduleMinimal } from "../services/SimproServices/simproScheduleService";
import { addMinimalJobCardDataToSmartsheet } from "../controllers/smartSheetController";
const jobCardReportSheetId = process.env.JOB_CARD_SHEET_ID ? process.env.JOB_CARD_SHEET_ID : "";
console.log(`JOBCARD SCHEDULER : Server time ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

console.log('jobCardReportSheetId', jobCardReportSheetId);

cron.schedule("24 12 * * *", async () => {
    try {
        console.log(`JOBCARD SCHEDULER : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        try {
            console.log(" JOBCARD SCHEDULER : Fetch started for new data")
            let fetchedSimproSchedulesMinimalData: SimproScheduleType[] = await fetchScheduleMinimal();
            console.log(" JOBCARD SCHEDULER : fetch completed for new data")

            console.log(" JOBCARD SCHEDULER : Adding new records to smartsheet for sheet version 1 ")
            await addMinimalJobCardDataToSmartsheet(fetchedSimproSchedulesMinimalData, jobCardReportSheetId, "minimal");
            console.log(" JOBCARD SCHEDULER : Completed: Adding new records to smartsheet for sheet version 1 : COMPLETED ")

            console.log(" JOBCARD SCHEDULER : Completed: Adding new records to smartsheet")
        } catch (err) {
            if (err instanceof AxiosError) {
                console.log(" JOBCARD SCHEDULER : Error in getJobCardReport as AxiosError");
                console.log(" JOBCARD SCHEDULER : Error details: ", err.response?.data);
            } else {
                console.log(" JOBCARD SCHEDULER : Error in getJobCardReport as other error");
                console.log(" JOBCARD SCHEDULER : Error details: ", err);
            }
        }

    } catch (err: any) {
        console.log('Error in job card scheduler. Error: ' + JSON.stringify(err));
    }
});
