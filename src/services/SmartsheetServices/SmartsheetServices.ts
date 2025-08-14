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
const wipJobArchivedSheetId = process.env.WIP_JOB_ARCHIVED_SHEET_ID ?? "";
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
                console.log('jobCardReportSheetId', jobCardReportSheetId)
                if (jobCardReportSheetId) {
                    const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardReportSheetId });
                    const columns = sheetInfo.columns;
                    const column = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleID");

                    console.log("schedule column", column)

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

                console.log('jobCardV2SheetId', jobCardV2SheetId)

                if (jobCardV2SheetId) {
                    const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardV2SheetId });
                    const columns = sheetInfo.columns;
                    const column = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleID");

                    console.log("schedule column in v2", column)
                    if (!column) {
                        throw {
                            message: "ScheduleID column not found in the sheet",
                            status: 400
                        }
                    }

                    const scheduleIdColumnId = column.id;
                    const existingRows: SmartsheetSheetRowsType[] = sheetInfo.rows;
                    let scheduleDataForSmartsheet: SmartsheetSheetRowsType | undefined;
                    console.log('existingRows', existingRows.length)
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

                    // console.log('scheduleDataForSmartsheet', scheduleDataForSmartsheet)
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
            console.log('scheduleID, jobID, sectionID', scheduleID, jobID, sectionID)

            // if (jobCardReportSheetId) {
            //     const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardReportSheetId });
            //     const columns = sheetInfo.columns;
            //     const scheduleColumn = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleID");
            //     const scheduleIdColumnId = scheduleColumn.id;
            //     const scheduleCommentColumn = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleComment");
            //     const scheduleCommentColumnId = scheduleCommentColumn.id;
            //     let scheduleDataForSmartsheet: SmartsheetSheetRowsType | undefined;
            //     const existingRows: SmartsheetSheetRowsType[] = sheetInfo.rows;


            //     for (let i = 0; i < existingRows.length; i++) {
            //         let currentRow = existingRows[i];
            //         const cellData = currentRow.cells.find(
            //             (cell: { columnId: string; value: any }) => cell.columnId === scheduleIdColumnId
            //         );
            //         if (cellData?.value === scheduleID) {
            //             scheduleDataForSmartsheet = currentRow;
            //             break;
            //         }
            //     }

            //     const rowsToUpdate = [{
            //         id: scheduleDataForSmartsheet?.id,
            //         cells: [{ columnId: scheduleCommentColumnId, value: "Deleted from Simpro" }],
            //     }]

            //     await smartsheet.sheets.updateRow({
            //         sheetId: jobCardReportSheetId,
            //         body: rowsToUpdate,
            //     });

            //     console.log('delete comment added to the schedule in smartsheet', jobCardReportSheetId)

            // }

            console.log('jobCardV2SheetId', jobCardV2SheetId)

            if (jobCardV2SheetId) {
                const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardV2SheetId });
                const columns = sheetInfo.columns;
                const scheduleColumn = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleID");
                const scheduleIdColumnId = scheduleColumn.id;

                console.log("schedule column in v2 for delete", scheduleColumn)

                const scheduleCommentColumn = columns.find((col: SmartsheetColumnType) => col.title === "ScheduleComment");
                console.log("schedule comment column in v2 for delete", scheduleCommentColumn)
                const scheduleCommentColumnId = scheduleCommentColumn.id;
                let scheduleDataForSmartsheet: SmartsheetSheetRowsType | undefined;
                const existingRows: SmartsheetSheetRowsType[] = sheetInfo.rows;

                console.log("Scheudle ID", scheduleID)
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

                // console.log('scheduleDataForSmartsheet for delete', scheduleDataForSmartsheet)

                if (scheduleDataForSmartsheet) {
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

            }

        } catch (err) {
            console.log("Error in the delete schedule simpro webhook", err);
            throw {
                message: "Error in the delete schedule simpro webhook"
            }
        }

    }

    static async handleAddUpdateRoofingCostcenterForInvoiceSmartsheet(webhookData: SimproWebhookType) {
        try {
            const { invoiceID } = webhookData.reference;
            if (invoiceID) {
                console.log("Invoice ID: ", invoiceID);
                const url = `/invoices/${invoiceID}?columns=ID,Jobs`;
                const invoiceData = await axiosSimPRO.get(url);
                const invoice = invoiceData.data;
                console.log("Invoice Data: ", invoice);
                let jobIDsForInvoice: number[] = invoice?.Jobs?.map((job: any) => job.ID) || [];

                for (const jobID of jobIDsForInvoice) {
                    console.log("Processing Job ID for invoice id: ", jobID);
                    await SmartsheetService.handleAddUpdateCostcenterRoofingToSmartSheet({
                        ID: webhookData.ID,
                        build: webhookData.build,
                        description: webhookData.description,
                        name: webhookData.name,
                        action: webhookData.action,
                        reference: {
                            companyID: webhookData.reference?.companyID || 0,
                            scheduleID: webhookData.reference?.scheduleID || 0,
                            jobID: jobID,
                            sectionID: webhookData.reference?.sectionID || 0,
                            costCenterID: webhookData.reference?.costCenterID || 0,
                            invoiceID: webhookData.reference?.invoiceID || 0,
                        },
                        date_triggered: new Date().toISOString()
                    });
                }
            }

        }
        catch (err) {
            console.log("Error in the update roofing cost center simpro webhook", err);
            throw {
                message: "Error in the update roofing cost center simpro webhook"
            }
        }
    }


    static async handleAddUpdateCostcenterRoofingToSmartSheet(webhookData: SimproWebhookType) {
        const { jobID } = webhookData.reference;
        console.log("Processing Job ID in handleAddUpdateCostcenterRoofingToSmartSheet: ", jobID);
        let costCenterIdToMarkDeleted: string[] = [];
        let costCenterDataFromSimpro: SimproJobCostCenterType[] = [];
        const url = `/jobCostCenters/?Job.ID=${jobID}`;
        const costCenters: SimproJobCostCenterType[] = await fetchSimproPaginatedData(url, "ID,CostCenter,Name,Job,Section,DateModified,_href");
        let fetchedChartOfAccounts = await axiosSimPRO.get('/setup/accounts/chartOfAccounts/?pageSize=250&columns=ID,Name,Number');
        let chartOfAccountsArray: SimproAccountType[] = fetchedChartOfAccounts?.data;
        let foundCostCenters = 0;
        let notFoundCostCenters = 0;
        const jobDataForCostCentre = await axiosSimPRO.get(`/jobs/${jobID}?columns=ID,Type,Site,SiteContact,DateIssued,Status,Total,Customer,Name,ProjectManager,CustomFields,Totals,Stage`);
        let fetchedJobData: SimproJobType = jobDataForCostCentre?.data;
        for (const jobCostCenter of costCenters) {
            console.dir(jobCostCenter, { depth: null })
            jobCostCenter.Job = fetchedJobData;
            try {
                const ccRecordId = jobCostCenter?.CostCenter?.ID;
                let fetchedSetupCostCenterData = await axiosSimPRO.get(`/setup/accounts/costCenters/${ccRecordId}?columns=ID,Name,IncomeAccountNo`);
                let setupCostCenterData = fetchedSetupCostCenterData.data;
                if (setupCostCenterData?.IncomeAccountNo) {
                    let incomeAccountName = chartOfAccountsArray?.find(account => account?.Number == setupCostCenterData?.IncomeAccountNo)?.Name;
                    if (incomeAccountName == "Roofing Income") {
                        console.log("Roofing income  1", jobCostCenter?.ID, jobCostCenter?.Job?.ID);
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
                } else if (err instanceof Error) {
                    console.error("Unexpected error:", err.message);
                } else {
                    // Handle non-Error objects
                    console.error("Non-error rejection:", JSON.stringify(err));
                }
            }
        }
        console.log(`Found ${foundCostCenters} cost centers and ${notFoundCostCenters} not found cost centers for job ${jobID}`);
        await SmartsheetService.updateCostcenterRoofingToSmartSheet(costCenterIdToMarkDeleted, costCenterDataFromSimpro);
        console.log(`Completed processing for job ${jobID}`);
    }

    static async updateCostcenterRoofingToSmartSheet(
        costCenterIdToMarkDeleted: string[],
        costCenterDataFromSimpro: SimproJobCostCenterType[]
    ) {
        try {
            console.log('costCenterIdToMarkDeleted', costCenterIdToMarkDeleted);

            if (!jobCardRoofingDetailSheetId) {
                throw new Error("Job Card Roofing Detail Sheet ID is undefined");
            }

            if (!wipJobArchivedSheetId) {
                throw new Error("WIP Job Archived Sheet ID is undefined");
            }

            let archivedJobSheetInfo: any;
            let archivedJobSheetColumns: any;

            const activeJobSheetInfo = await smartsheet.sheets.getSheet({ id: jobCardRoofingDetailSheetId });
            const activeJobSheetColumns = activeJobSheetInfo.columns;
            const costCenterIdColumn = activeJobSheetColumns.find((col: SmartsheetColumnType) => col.title === "Cost_Center.ID");

            if (!costCenterIdColumn) {
                throw new Error("Cost_Center.ID column not found in the sheet");
            }

            const costCenterIdColumnId = costCenterIdColumn.id;
            const existingRowInActiveJobsSheet: SmartsheetSheetRowsType[] = activeJobSheetInfo.rows;

            for (const jobCostCenter of costCenterDataFromSimpro) {
                try {
                    let costCenterRowDataForActiveJobsSheet: SmartsheetSheetRowsType | undefined;
                    let costCenterRowDataForArchivedJobsSheet: SmartsheetSheetRowsType | undefined;

                    for (const element of existingRowInActiveJobsSheet) {
                        const cellData = element.cells.find(
                            (cell: { columnId: string; value: any }) => cell.columnId === costCenterIdColumnId
                        );
                        if (cellData?.value === jobCostCenter.CostCenter.ID) {
                            costCenterRowDataForActiveJobsSheet = element;
                            break;
                        }
                    }

                    if (!costCenterRowDataForActiveJobsSheet) {
                        archivedJobSheetInfo = await smartsheet.sheets.getSheet({ id: wipJobArchivedSheetId });
                        archivedJobSheetColumns = archivedJobSheetInfo.columns;
                        const costCenterIdColumnInArchivedSheet = archivedJobSheetColumns.find((col: SmartsheetColumnType) => col.title === "Cost_Center.ID");

                        if (!costCenterIdColumnInArchivedSheet) {
                            throw new Error("Cost_Center.ID column not found in the Archived Job sheet");
                        }

                        const costCenterIdColumnIdInArchivedSheet = costCenterIdColumnInArchivedSheet.id;
                        const existingRowInArchivedJobsSheet: SmartsheetSheetRowsType[] = archivedJobSheetInfo.rows;
                        for (const element of existingRowInArchivedJobsSheet) {
                            const costCenterCellData = element.cells.find(
                                (cell: { columnId: string; value: any }) => cell.columnId === costCenterIdColumnIdInArchivedSheet
                            );
                            if (costCenterCellData?.value === jobCostCenter.CostCenter.ID) {
                                costCenterRowDataForArchivedJobsSheet = element;
                                break;
                            }
                        }
                    }

                    if (costCenterRowDataForActiveJobsSheet) {
                        const rowIdMap = {
                            [jobCostCenter.CostCenter.ID.toString()]: costCenterRowDataForActiveJobsSheet.id?.toString() || "",
                        };

                        const convertedData = convertSimprocostCenterDataToSmartsheetFormatForUpdate(
                            [jobCostCenter],
                            activeJobSheetColumns,
                            rowIdMap,
                            'full'
                        );

                        await smartsheet.sheets.updateRow({
                            sheetId: jobCardRoofingDetailSheetId,
                            body: convertedData,
                        });

                        console.log('✅ Updated row in Smartsheet in Active Jobs Sheet (Sheet ID:', jobCardRoofingDetailSheetId, ')');
                    } else if (costCenterRowDataForArchivedJobsSheet) {
                        const rowIdMap = {
                            [jobCostCenter.CostCenter.ID.toString()]: costCenterRowDataForArchivedJobsSheet.id?.toString() || "",
                        };

                        const convertedData = convertSimprocostCenterDataToSmartsheetFormatForUpdate(
                            [jobCostCenter],
                            archivedJobSheetColumns,
                            rowIdMap,
                            'full'
                        );

                        await smartsheet.sheets.updateRow({
                            sheetId: wipJobArchivedSheetId,
                            body: convertedData,
                        });

                        console.log('✅ Updated row in Smartsheet in Archived Jobs Sheet (Sheet ID:', wipJobArchivedSheetId, ')');
                    } else {
                        const convertedDataForSmartsheet = convertSimproRoofingDataToSmartsheetFormat(
                            [jobCostCenter],
                            activeJobSheetColumns,
                            'full'
                        );

                        await smartsheet.sheets.addRows({
                            sheetId: jobCardRoofingDetailSheetId,
                            body: convertedDataForSmartsheet,
                        });

                        console.log('✅ Added row in Smartsheet (Sheet ID:', jobCardRoofingDetailSheetId, ')');
                    }
                } catch (rowError) {
                    console.error(
                        `❌ Error processing cost center ID ${jobCostCenter?.CostCenter?.ID}:`,
                        rowError
                    );
                }
            }
        } catch (error) {
            console.error("❌ Failed to update cost center roofing in Smartsheet:", error);
            throw error; // rethrow so caller can handle if needed
        }
    }

}

