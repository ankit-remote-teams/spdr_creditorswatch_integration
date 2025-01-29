import axiosSimPRO from "../../config/axiosSimProConfig";
import { SimproAccountType, SimproJobType, SimproScheduleType, SimproWebhookType } from "../../types/simpro.types";
import { SmartsheetColumnType, SmartsheetSheetRowsType } from "../../types/smartsheet.types";
import { convertSimproScheduleDataToSmartsheetFormat, convertSimproScheduleDataToSmartsheetFormatForUpdate } from "../../utils/transformSimproToSmartsheetHelper";
const SmartsheetClient = require('smartsheet');
const smartSheetAccessToken: string | undefined = process.env.SMARTSHEET_ACCESS_TOKEN;
const smartsheet = SmartsheetClient.createClient({ accessToken: smartSheetAccessToken });
const jobCardReportSheetId = process.env.JOB_CARD_SHEET_ID ? process.env.JOB_CARD_SHEET_ID : "";
const jobCardV2SheetId = process.env.JOB_CARD_SHEET_V2_ID ? process.env.JOB_CARD_SHEET_V2_ID : "";
// const jobCardSheetId = "398991237795716";


export class SmartsheetService {


    static async handleAddUpdateScheduleToSmartsheet(webhookData: SimproWebhookType) {
        try {
            let isInvoiceAccountNameRoofing = false;
            const { scheduleID, jobID, sectionID, costCenterID } = webhookData.reference;
            let fetchedChartOfAccounts = await axiosSimPRO.get('/setup/accounts/chartOfAccounts/?pageSize=250&columns=ID,Name,Number');
            let chartOfAccountsArray: SimproAccountType[] = fetchedChartOfAccounts?.data;
            console.log('scheduleID, jobID, sectionID, costCenterID', scheduleID, jobID, sectionID, costCenterID)
            let simPROScheduleUpdateUrl = `/schedules/${scheduleID}`
            console.log('simPROScheduleUpdateUrl', simPROScheduleUpdateUrl)
            let individualScheduleResponse = await axiosSimPRO(`${simPROScheduleUpdateUrl}?columns=ID,Type,Reference,Staff,Date,Blocks,Notes`)
            let jobForScheduleResponse = await axiosSimPRO(`/jobs/${jobID}?columns=ID,Type,Site,SiteContact,DateIssued,Status,Total,Customer,Name,ProjectManager,CustomFields`)
            let schedule: SimproScheduleType = individualScheduleResponse?.data;
            console.log('Shceuld Blocks', schedule.Blocks)
            let fetchedJobData: SimproJobType = jobForScheduleResponse?.data;
            let siteId = fetchedJobData?.Site?.ID;
            if (siteId) {
                const siteResponse = await axiosSimPRO.get(`/sites/${siteId}?columns=ID,Name,Address`);
                let siteResponseData = siteResponse.data;
                fetchedJobData.Site = siteResponseData;
            }

            schedule.Job = fetchedJobData;
            if (schedule?.Job?.Customer) {
                const customerId = schedule.Job.Customer.ID?.toString();
                try {
                    // This will always fail
                    const customerResponse = await axiosSimPRO.get(`/customers/${customerId}`)
                    console.log("customerResponse: ", customerResponse)
                } catch (err: any) {
                    // console.log("Error getting customer", )
                    let endpoint = err?.response?.data?._href;

                    // Extract the part starting from "/customers"
                    const startFromCustomers = endpoint.substring(endpoint.indexOf("/customers"));

                    console.log("startFromCustomers: ", startFromCustomers);

                    // Check if it's "/customers/companies" or "/customers/individuals"
                    if (startFromCustomers.includes("/companies")) {
                        // Handle the case for companies
                        const companyResponse = await axiosSimPRO.get(
                            `${startFromCustomers}?columns=ID,CompanyName,Phone,Address,Email`
                        );
                        console.log("Company Response: ", companyResponse?.data);
                        schedule.Job.Customer = { ...companyResponse.data, Type: "Company" };
                    } else if (startFromCustomers.includes("/individuals")) {
                        // Handle the case for individuals
                        const individualResponse = await axiosSimPRO.get(
                            `${startFromCustomers}?columns=ID,GivenName,FamilyName,Phone,Address,Email`
                        );
                        console.log("Individual Response: ", individualResponse?.data);
                        schedule.Job.Customer = { ...individualResponse.data, Type: "Individual" };
                    } else {
                        console.error("Unknown customer type in the endpoint");
                    }
                }
            }


            console.log('costCenterDataForSchedule', `/jobCostCenters/?ID=${costCenterID}&columns=ID,Name,Job,Section,CostCente`)
            const costCenterDataForSchedule = await axiosSimPRO.get(`/jobCostCenters/?ID=${costCenterID}&columns=ID,Name,Job,Section,CostCenter`);
            let setupCostCenterID = costCenterDataForSchedule.data[0]?.CostCenter?.ID;
            let fetchedSetupCostCenterData = await axiosSimPRO.get(`/setup/accounts/costCenters/${setupCostCenterID}?columns=ID,Name,IncomeAccountNo`);
            let setupCostCenterData = fetchedSetupCostCenterData.data;

            if (setupCostCenterData?.IncomeAccountNo) {
                let incomeAccountName = chartOfAccountsArray?.find(account => account?.Number == setupCostCenterData?.IncomeAccountNo)?.Name;
                if (incomeAccountName == "Roofing Income") {
                    isInvoiceAccountNameRoofing = true;
                }
            }

            let costCenterResponse = await axiosSimPRO.get(`jobs/${jobID}/sections/${sectionID}/costCenters/${costCenterID}?columns=Name,ID,Claimed`);
            if (costCenterResponse) {
                schedule.CostCenter = costCenterResponse.data;
            }

            if (isInvoiceAccountNameRoofing) {

                if (jobCardReportSheetId) {
                    const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardReportSheetId });
                    const columns = sheetInfo.columns;
                    const column = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleID");

                    // console.log('convertedDataForSmartsheet', convertedDataForSmartsheet)
                    if (!column) {
                        throw {
                            message: "ScheduleID column not found in the sheet",
                            status: 400
                        }
                    }
                    const scheduleIdColumnId = column.id;
                    const existingRows: SmartsheetSheetRowsType[] = sheetInfo.rows;
                    let scheduleDataForSmartsheet: SmartsheetSheetRowsType | undefined;

                    for (let i = 0; i < existingRows.length; i++) {
                        let currentRow = existingRows[i];
                        const cellData = currentRow.cells.find(
                            (cell: { columnId: string; value: any }) => cell.columnId === scheduleIdColumnId
                        );
                        if (cellData?.value === schedule.ID) {
                            scheduleDataForSmartsheet = currentRow;
                            break;
                        }
                    }

                    if (scheduleDataForSmartsheet) {
                        let rowIdMap: { [key: string]: string } = {};
                        rowIdMap = {
                            [schedule.ID.toString()]: scheduleDataForSmartsheet?.id?.toString() || "",
                        };
                        const convertedData = convertSimproScheduleDataToSmartsheetFormatForUpdate([schedule], columns, rowIdMap, 'full');

                        await smartsheet.sheets.updateRow({
                            sheetId: jobCardReportSheetId,
                            body: convertedData,
                        });
                        // console.log('Updated row in smartsheet')
                        console.log('Updated row in smartsheet in sheet ', jobCardReportSheetId)

                    } else {
                        const convertedDataForSmartsheet = convertSimproScheduleDataToSmartsheetFormat([schedule], columns, 'full');
                        const newRow = convertedDataForSmartsheet[0];
                        await smartsheet.sheets.addRows({
                            sheetId: jobCardReportSheetId,
                            body: convertedDataForSmartsheet,
                        });
                        console.log('Added row in smartsheet in sheeet', jobCardReportSheetId)
                    }
                }

                if (jobCardV2SheetId) {
                    const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardV2SheetId });
                    const columns = sheetInfo.columns;
                    const column = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleID");

                    // console.log('convertedDataForSmartsheet', convertedDataForSmartsheet)
                    if (!column) {
                        throw {
                            message: "ScheduleID column not found in the sheet",
                            status: 400
                        }
                    }
                    const scheduleIdColumnId = column.id;
                    const existingRows: SmartsheetSheetRowsType[] = sheetInfo.rows;
                    let scheduleDataForSmartsheet: SmartsheetSheetRowsType | undefined;

                    for (let i = 0; i < existingRows.length; i++) {
                        let currentRow = existingRows[i];
                        const cellData = currentRow.cells.find(
                            (cell: { columnId: string; value: any }) => cell.columnId === scheduleIdColumnId
                        );
                        if (cellData?.value === schedule.ID) {
                            scheduleDataForSmartsheet = currentRow;
                            break;
                        }
                    }

                    if (scheduleDataForSmartsheet) {
                        let rowIdMap: { [key: string]: string } = {};
                        rowIdMap = {
                            [schedule.ID.toString()]: scheduleDataForSmartsheet?.id?.toString() || "",
                        };
                        const convertedData = convertSimproScheduleDataToSmartsheetFormatForUpdate([schedule], columns, rowIdMap, 'full');

                        await smartsheet.sheets.updateRow({
                            sheetId: jobCardV2SheetId,
                            body: convertedData,
                        });
                        console.log('Updated row in smartsheet in sheet ', jobCardV2SheetId)
                    } else {
                        const convertedDataForSmartsheet = convertSimproScheduleDataToSmartsheetFormat([schedule], columns, 'full');
                        const newRow = convertedDataForSmartsheet[0];
                        await smartsheet.sheets.addRows({
                            sheetId: jobCardV2SheetId,
                            body: convertedDataForSmartsheet,
                        });
                        console.log('Added row in smartsheet in sheeet', jobCardV2SheetId)

                    }
                }
            }

            // console.log('schedule', schedule)
        } catch (err) {
            console.log("Error in the update schedule simpro webhook", err);
            throw {
                message: "Error in the update schedule simpro webhook"
            }
        }
    }

    static async handleDeleteScheduleInSmartsheet(webhookData: SimproWebhookType) {
        try {
            const { scheduleID, jobID, sectionID } = webhookData.reference;

            if (jobCardReportSheetId) {
                const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardReportSheetId });
                const columns = sheetInfo.columns;
                const scheduleColumn = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleID");
                const scheduleIdColumnId = scheduleColumn.id;
                const scheduleCommentColumn = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleComment");
                const scheduleCommentColumnId = scheduleCommentColumn.id;
                let scheduleDataForSmartsheet: SmartsheetSheetRowsType | undefined;
                const existingRows: SmartsheetSheetRowsType[] = sheetInfo.rows;


                for (let i = 0; i < existingRows.length; i++) {
                    let currentRow = existingRows[i];
                    const cellData = currentRow.cells.find(
                        (cell: { columnId: string; value: any }) => cell.columnId === scheduleIdColumnId
                    );
                    if (cellData?.value === scheduleID) {
                        scheduleDataForSmartsheet = currentRow;
                        break;
                    }
                }

                const rowsToUpdate = [{
                    id: scheduleDataForSmartsheet?.id,
                    cells: [{ columnId: scheduleCommentColumnId, value: "Deleted from Simpro" }],
                }]

                await smartsheet.sheets.updateRow({
                    sheetId: jobCardReportSheetId,
                    body: rowsToUpdate,
                });

                console.log('delete comment added to the schedule in smartsheet', jobCardReportSheetId)

            }



            if (jobCardV2SheetId) {
                const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardV2SheetId });
                const columns = sheetInfo.columns;
                const scheduleColumn = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleID");
                const scheduleIdColumnId = scheduleColumn.id;
                const scheduleCommentColumn = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleComment");
                const scheduleCommentColumnId = scheduleCommentColumn.id;
                let scheduleDataForSmartsheet: SmartsheetSheetRowsType | undefined;
                const existingRows: SmartsheetSheetRowsType[] = sheetInfo.rows;


                for (let i = 0; i < existingRows.length; i++) {
                    let currentRow = existingRows[i];
                    const cellData = currentRow.cells.find(
                        (cell: { columnId: string; value: any }) => cell.columnId === scheduleIdColumnId
                    );
                    if (cellData?.value === scheduleID) {
                        scheduleDataForSmartsheet = currentRow;
                        break;
                    }
                }

                const rowsToUpdate = [{
                    id: scheduleDataForSmartsheet?.id,
                    cells: [{ columnId: scheduleCommentColumnId, value: "Deleted from Simpro" }],
                }]

                await smartsheet.sheets.updateRow({
                    sheetId: jobCardV2SheetId,
                    body: rowsToUpdate,
                });

                console.log('delete comment added to the schedule in smartsheet', jobCardV2SheetId)
            }

        } catch (err) {
            console.log("Error in the delete schedule simpro webhook", err);
            throw {
                message: "Error in the delete schedule simpro webhook"
            }
        }

    }
}