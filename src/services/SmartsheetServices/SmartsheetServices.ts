import { AxiosError } from "axios";
import axiosSimPRO from "../../config/axiosSimProConfig";
import { SimproAccountType, SimproJobCostCenterType, SimproJobType, SimproScheduleType, SimproWebhookType } from "../../types/simpro.types";
import { SmartsheetColumnType, SmartsheetSheetRowsType } from "../../types/smartsheet.types";
import { convertSimprocostCenterDataToSmartsheetFormatForUpdate, convertSimproRoofingDataToSmartsheetFormat, convertSimproScheduleDataToSmartsheetFormat, convertSimproScheduleDataToSmartsheetFormatForUpdate } from "../../utils/transformSimproToSmartsheetHelper";
import { fetchSimproPaginatedData } from "../SimproServices/simproPaginationService";
const SmartsheetClient = require('smartsheet');
const smartSheetAccessToken: string | undefined = process.env.SMARTSHEET_ACCESS_TOKEN;
const smartsheet = SmartsheetClient.createClient({ accessToken: smartSheetAccessToken });
const jobCardReportSheetId = process.env.JOB_CARD_SHEET_ID ? process.env.JOB_CARD_SHEET_ID : "";
const jobCardV2SheetId = process.env.JOB_CARD_SHEET_V2_ID ? process.env.JOB_CARD_SHEET_V2_ID : "";
const jobCardRoofingDetailSheetId = process.env.JOB_CARD_SHEET_ROOFING_DETAIL_ID ?? "";
// const jobCardReportSheetId = "398991237795716";
console.log('jobCardReportSheetId', jobCardReportSheetId)


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
            let jobForScheduleResponse = await axiosSimPRO(`/jobs/${jobID}?columns=ID,Type,Site,SiteContact,DateIssued,Status,Total,Customer,Name,ProjectManager,CustomFields,Totals`)
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


            console.log('costCenterDataForSchedule', `/jobCostCenters/?ID=${costCenterID}&columns=ID,Name,Job,Section,CostCenter`)
            const costCenterDataForSchedule = await axiosSimPRO.get(`/jobCostCenters/?ID=${costCenterID}&columns=ID,Name,Job,Section,CostCenter`);
            let setupCostCenterID = costCenterDataForSchedule.data[0]?.CostCenter?.ID;
            let fetchedSetupCostCenterData = await axiosSimPRO.get(`/setup/accounts/costCenters/${setupCostCenterID}?columns=ID,Name,IncomeAccountNo`);
            let setupCostCenterData = fetchedSetupCostCenterData.data;
            console.log('CostCenterId IncomeAccountNo', costCenterID, setupCostCenterData);

            if (setupCostCenterData?.IncomeAccountNo) {
                let incomeAccountName = chartOfAccountsArray?.find(account => account?.Number == setupCostCenterData?.IncomeAccountNo)?.Name;
                console.log("Income Account Name: " + incomeAccountName)
                if (incomeAccountName == "Roofing Income") {
                    isInvoiceAccountNameRoofing = true;
                }
            }

            let costCenterResponse = await axiosSimPRO.get(`jobs/${jobID}/sections/${sectionID}/costCenters/${costCenterID}?columns=Name,ID,Claimed,Total,Totals`);
            if (costCenterResponse) {
                schedule.CostCenter = costCenterResponse.data;
            }

            console.log('IsInvoiceAccountNameRoofing: ' + isInvoiceAccountNameRoofing, costCenterID, scheduleID)
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

    static async handleAddUpdateCostcenterRoofingToSmartSheet(webhookData: SimproWebhookType) {
        const { jobID } = webhookData.reference;
        let costCenterIdToMarkDeleted: string[] = [];
        let costCenterDataFromSimpro: SimproJobCostCenterType[] = [];
        const url = `/jobCostCenters/?Job.ID=${jobID}`;
        const costCenters: SimproJobCostCenterType[] = await fetchSimproPaginatedData(url, "ID,CostCenter,Name,Job,Section,DateModified,_href");
        let fetchedChartOfAccounts = await axiosSimPRO.get('/setup/accounts/chartOfAccounts/?pageSize=250&columns=ID,Name,Number');
            let chartOfAccountsArray: SimproAccountType[] = fetchedChartOfAccounts?.data;
            let foundCostCenters = 0;
            let notFoundCostCenters = 0;
            const jobDataForSchedule = await axiosSimPRO.get(`/jobs/${jobID}?columns=ID,Type,Site,SiteContact,DateIssued,Status,Total,Customer,Name,ProjectManager,CustomFields,Totals,Stage`);
            let fetchedJobData: SimproJobType = jobDataForSchedule?.data;
        for (const jobCostCenter of costCenters) {
            console.dir(jobCostCenter, {depth: null})
            jobCostCenter.Job = fetchedJobData;
            try {
                const ccRecordId = jobCostCenter?.CostCenter?.ID;
                let fetchedSetupCostCenterData = await axiosSimPRO.get(`/setup/accounts/costCenters/${ccRecordId}?columns=ID,Name,IncomeAccountNo`);
                let setupCostCenterData = fetchedSetupCostCenterData.data;
                if (setupCostCenterData?.IncomeAccountNo) {
                    let incomeAccountName = chartOfAccountsArray?.find(account => account?.Number == setupCostCenterData?.IncomeAccountNo)?.Name;
                    if (incomeAccountName == "Roofing Income") {
                        console.log("Roofing income  ", jobCostCenter?.ID, jobCostCenter?.Job?.ID);
                        try {
                            const jcUrl = jobCostCenter?._href?.substring(jobCostCenter?._href?.indexOf('jobs'), jobCostCenter?._href.length);
                            let costCenterResponse = await axiosSimPRO.get(`${jcUrl}?columns=Name,ID,Claimed,Total,Totals`);
                            if (costCenterResponse) {
                                jobCostCenter.CostCenter = costCenterResponse.data;
                                jobCostCenter.ccRecordId = ccRecordId;
                                foundCostCenters++;
                                costCenterDataFromSimpro.push(jobCostCenter);
                            }
                        } catch (error) {
                            console.log("Error in costCenterFetch : ", error)
                        }
                    }
                }
            } catch (err) {
                if (err instanceof AxiosError) {
                    console.log("Error in fetch Const center from setup");
                    console.log("Error details: ", err.response?.data);
                    notFoundCostCenters++;
                    costCenterIdToMarkDeleted.push(jobCostCenter?.CostCenter?.ID.toString());
                } else {
                    console.log("Error in fetch Const center from setup");
                }
            }
        }

        SmartsheetService.updateCostcenterRoofingToSmartSheet(costCenterIdToMarkDeleted, costCenterDataFromSimpro);
    }

    static async updateCostcenterRoofingToSmartSheet (costCenterIdToMarkDeleted: string[],
        costCenterDataFromSimpro: SimproJobCostCenterType[]) {
        if (jobCardRoofingDetailSheetId) {
            const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardRoofingDetailSheetId });
            const columns = sheetInfo.columns;
            const column = columns.find((col: SmartsheetColumnType) => col.title === "Cost_Center.ID");

            // console.log('convertedDataForSmartsheet', convertedDataForSmartsheet)
            if (!column) {
                const error = new Error("Cost_Center.ID column not found in the sheet");
                throw error;
            }
            const scheduleIdColumnId = column.id;
            const existingRows: SmartsheetSheetRowsType[] = sheetInfo.rows;
            let scheduleDataForSmartsheet: SmartsheetSheetRowsType | undefined;
            for (const jobCostCenter of costCenterDataFromSimpro) {
                for (const element of existingRows) {
                    let currentRow = element;
                    const cellData = currentRow.cells.find(
                        (cell: { columnId: string; value: any }) => cell.columnId === scheduleIdColumnId
                    );
                    if (cellData?.value === jobCostCenter.CostCenter.ID) {
                        scheduleDataForSmartsheet = currentRow;
                        break;
                    }
                }

                if (scheduleDataForSmartsheet) {
                    let rowIdMap: { [key: string]: string } = {};
                    rowIdMap = {
                        [jobCostCenter.CostCenter.ID.toString()]: scheduleDataForSmartsheet?.id?.toString() || "",
                    };
                    const convertedData = convertSimprocostCenterDataToSmartsheetFormatForUpdate([jobCostCenter], columns, rowIdMap, 'full');

                    await smartsheet.sheets.updateRow({
                        sheetId: jobCardRoofingDetailSheetId,
                        body: convertedData,
                    });
                    // console.log('Updated row in smartsheet')
                    console.log('Updated row in smartsheet in sheet ', jobCardRoofingDetailSheetId)

                } else {
                    const convertedDataForSmartsheet = convertSimproRoofingDataToSmartsheetFormat([jobCostCenter], columns, 'full');
                    await smartsheet.sheets.addRows({
                        sheetId: jobCardRoofingDetailSheetId,
                        body: convertedDataForSmartsheet,
                    });
                    console.log('Added row in smartsheet in sheeet', jobCardRoofingDetailSheetId)
                }
            }
        }
    }
}

