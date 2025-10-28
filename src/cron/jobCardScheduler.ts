const cron = require('node-cron');
import { AxiosError } from "axios";
import moment from "moment";
import { SimproJobCostCenterType, SimproScheduleType } from "../types/simpro.types";
import { fetchScheduleData } from "../services/SimproServices/simproScheduleService";
import { addJobCardDataToSmartsheet, addJobRoofingDetailsToSmartSheet } from "../controllers/smartSheetController";
import { fetchDataCostCenters } from "../controllers/simproController";
const jobCardReportSheetId = process.env.JOB_CARD_SHEET_ID ? process.env.JOB_CARD_SHEET_ID : "";
const jobCardV2SheetId = process.env.JOB_CARD_SHEET_V2_ID ? process.env.JOB_CARD_SHEET_V2_ID : "";
const jobCardRoofingDetailSheetId = process.env.JOB_CARD_SHEET_ROOFING_DETAIL_ID ?? "";
console.log(`JOBCARD SCHEDULER : Server time 1 ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

// Job card scheduler deprecated. 

// cron.schedule("0 0/2 * * * ", async () => {
//     executeJob();
// });

// export const executeJob = async () => {
//     try {
//         console.log(`JOBCARD SCHEDULER : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
//         try {
//             console.log(" JOBCARD SCHEDULER : Fetch started for new data")
//             let fetchedSimproSchedulesData: SimproScheduleType[] = await fetchScheduleData();
//             console.log(" JOBCARD SCHEDULER : fetch completed for new data")

//             console.log(" JOBCARD SCHEDULER : Adding new records to smartsheet for sheet version 1 ")
//             await addJobCardDataToSmartsheet(fetchedSimproSchedulesData, jobCardReportSheetId);
//             console.log(" JOBCARD SCHEDULER : Completed: Adding new records to smartsheet for sheet version 1 : COMPLETED ")

//             console.log(" JOBCARD SCHEDULER : Adding new records to smartsheet for sheet version 2 ")
//             await addJobCardDataToSmartsheet(fetchedSimproSchedulesData, jobCardV2SheetId);
//             console.log(" JOBCARD SCHEDULER : Completed: Adding new records to smartsheet for sheet version 2 : COMPLETED ")

//             console.log(" JOBCARD SCHEDULER : Completed: Adding new records to smartsheet")
//         } catch (err) {
//             if (err instanceof AxiosError) {
//                 console.log(" JOBCARD SCHEDULER : Error in job card scheduler as AxiosError");
//                 console.log(" JOBCARD SCHEDULER : Error details: ", err.response?.data);
//             } else {
//                 console.log(" JOBCARD SCHEDULER : Error in job card scheduler as other error");
//                 console.log(" JOBCARD SCHEDULER : Error details: ", err);
//             }
//         }

//     } catch (err: any) {
//         console.log('Error in job card scheduler. Error: ' + JSON.stringify(err));
//     }
// }

// export const executeJobForRoofingDetail = async () => {
//     try {
//         const startTime = moment().unix();
//         console.log(`JOBCARD detail SCHEDULER : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
//         try {
//             console.log(" JOBCARD detail SCHEDULER : Fetch started for new data")
//             fetchDataCostCenters([], 'full', async (costCenterIdToMarkDeleted: string[], costCenterDataFromSimpro: SimproJobCostCenterType[]) => {
//                 console.log(" JOBCARD detail SCHEDULER : fetch completed for new data")
//                 console.log(" JOBCARD SCHEDULER : Adding new records to smartsheet for sheet version 1 ")
//                 addJobRoofingDetailsToSmartSheet(costCenterDataFromSimpro, jobCardRoofingDetailSheetId);
//                 console.log(" JOBCARD SCHEDULER : Completed: Adding new records to smartsheet for sheet version 1 : COMPLETED ")
//                 console.log("Time taken to fill the sheet in ms", (moment().unix() - startTime));
//             });

//             // console.log(" JOBCARD SCHEDULER : Completed: Adding new records to smartsheet")
//         } catch (err) {
//             if (err instanceof AxiosError) {
//                 console.log(" JOBCARD SCHEDULER : Error in job card scheduler as AxiosError");
//                 console.log(" JOBCARD SCHEDULER : Error details: ", err.response?.data);
//             } else {
//                 console.log(" JOBCARD SCHEDULER : Error in job card scheduler as other error");
//                 console.log(" JOBCARD SCHEDULER : Error details: ", err);
//             }
//         }

//     } catch (err: any) {
//         console.log('Error in job card scheduler. Error: ' + JSON.stringify(err));
//     }
// }

