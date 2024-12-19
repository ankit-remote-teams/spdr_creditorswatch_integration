const cron = require('node-cron');
import { AxiosError } from "axios";
import moment from "moment";
// import { ses } from '../config/awsConfig'
import { SimproScheduleType } from "../types/simpro.types";
import { fetchCurrentDateScheduleData } from "../services/SimproServices/simproScheduleService";
import { addJobCardDataToSmartsheet } from "../controllers/smartSheetController";
const jobCardReportSheetId = process.env.JOB_CARD_SHEET_ID ? process.env.JOB_CARD_SHEET_ID : "";
console.log(`Current Date Job Card Scheduler : Server time ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

cron.schedule("*/30 * * * *", async () => {
    try {
        console.log(`JOBCARD SCHEDULER : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        try {
            console.log("Current Date Job Card Scheduler : Fetch started for new data")
            let fetchedSimproSchedulesData: SimproScheduleType[] = await fetchCurrentDateScheduleData();
            console.log("Current Date Job Card Scheduler : fetch completed for new data")

            console.log("Current Date Job Card Scheduler : Adding new records to smartsheet for sheet version 1 ")
            await addJobCardDataToSmartsheet(fetchedSimproSchedulesData, jobCardReportSheetId);
            console.log("Current Date Job Card Scheduler : Completed: Adding new records to smartsheet for sheet version 1 : COMPLETED ")

            console.log("Current Date Job Card Scheduler : Completed: Adding new records to smartsheet")
        } catch (err) {
            if (err instanceof AxiosError) {
                console.log("Current Date Job Card Scheduler : Error in job card scheduler as AxiosError");
                console.log("Current Date Job Card Scheduler : Error details: ", err.response?.data);
            } else {
                console.log("Current Date Job Card Scheduler : Error in job card scheduler as other error");
                console.log("Current Date Job Card Scheduler : Error details: ", err);
            }
        }

    } catch (err: any) {
        console.log('Error in job card scheduler. Error: ' + JSON.stringify(err));
    }
});
