import { Request, Response } from 'express';
const SmartsheetClient = require('smartsheet');
import { Document } from 'mongoose';
import SmartsheetTaskTrackingModel from '../models/smartsheetTaskTrackingModel';
import {
    ExistingCostCenterType,
    ExistingIncomeType,
    ExistingLeadsType,
    ExistingQuotationType,
    ExistingScheduleType,
    SmartsheetColumnType,
    SmartsheetRowCellType,
    SmartsheetSheetRowsType,
} from '../types/smartsheet.types';
import { ITaskHourRecord } from '../types/smartsheet.types';
import {
    SimproScheduleType,
    SimproQuotationType,
    SimproLeadType,
    SimproJobCostCenterType,
    CostCenterJobInfo,
    SimproJobCostCenterTypeForAmountUpdate
} from '../types/simpro.types';
import { splitIntoChunks } from '../utils/helper';
import moment from 'moment';
import { AxiosError } from 'axios';
import { fetchDataCostCenters, fetchScheduleDataForExistingScheduleIds } from './simproController';
import {
    convertSimproScheduleDataToSmartsheetFormat,
    convertSimproScheduleDataToSmartsheetFormatForUpdate,
    convertSimproQuotationDataToSmartsheetFormat,
    convertSimproLeadsDataToSmartsheetFormat,
    convertSimproQuotationDataToSmartsheetFormatForUpdate,
    convertSimproLeadsDataToSmartsheetFormatForUpdate,
    convertSimproRoofingDataToSmartsheetFormat,
    convertSimprocostCenterDataToSmartsheetFormatForUpdate,
    convertSimproCostCenterAmountUpdateToSmartsheetFormat,
} from '../utils/transformSimproToSmartsheetHelper';
import axiosSimPRO from '../config/axiosSimProConfig';
import { SmartsheetService } from '../services/SmartsheetServices/SmartsheetServices';


const smartSheetAccessToken: string | undefined = process.env.SMARTSHEET_ACCESS_TOKEN;
const smartsheet = SmartsheetClient.createClient({ accessToken: smartSheetAccessToken });
const jobTrackerSheetId = process.env.TASK_TRACKER_SHEET_ID ? process.env.TASK_TRACKER_SHEET_ID : "";
const ongoingQuotationSheetId = process.env.SIMPRO_ONGOING_QUOTE_SHEET_ID ? process.env.SIMPRO_ONGOING_QUOTE_SHEET_ID : "";
const ongoingLeadsSheetId = process.env.SIMPRO_ONGOING_LEADS_SHEET_ID ? process.env.SIMPRO_ONGOING_LEADS_SHEET_ID : "";
const jobCardSheetId = process.env.JOB_CARD_SHEET_ID ? process.env.JOB_CARD_SHEET_ID : "";
const jobCardRoofingDetailSheetId = process.env.JOB_CARD_SHEET_ROOFING_DETAIL_ID ?? "";
const wipJobArchivedSheetId = process.env.WIP_JOB_ARCHIVED_SHEET_ID ?? "";

// Define interfaces for Smartsheet events and cells
interface ISmartsheetEvent {
    rowId: number;
    columnId: number;
}


// Function to handle Smartsheet webhook
export const handleSmartSheetWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log("Smartsheet Controller: Smartsheet get webhook called");
        const result = await smartsheet.sheets.getSheet({ id: jobTrackerSheetId });
        // console.log('columns', result.columns);
        res.status(200).send("Hello from Smartsheet route");
    } catch (err) {
        console.error("Smartsheet Controller: Error in Smartsheet webhook:", err);
        res.status(500).json({ status: false, error: (err as Error).message, message: "Something went wrong" });
    }
};

// Function to handle Smartsheet webhook POST
export const handleSmartSheetWebhookPost = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log("Smartsheet Controller: Smartsheet post webhook called");
        const challenge = req.headers['smartsheet-hook-challenge'];
        if (challenge) {
            res.set('Smartsheet-Hook-Response', challenge as string);
            res.status(200).json({ smartsheetHookResponse: challenge });
            return;
        }

        console.log("Webhook event 1:", req.body);

        const events: ISmartsheetEvent[] = req.body.events;
        for (const event of events) {
            if (event.columnId && event.rowId) {
                await handleTotalHourWebhookEvent(event);
            }
        }

        res.status(200).send("Hello from Smartsheet route");
    } catch (err) {
        res.status(500).json({ status: false, error: (err as Error).message, message: "Something went wrong" });
    }
};

// Function to handle individual webhook events
export const handleTotalHourWebhookEvent = async (event: ISmartsheetEvent): Promise<void> => {
    try {
        const statusCellData = await getCellData(jobTrackerSheetId, event.rowId, event.columnId);
        const recordNumberColumnId = await getColumnIdForColumnName("Record #", jobTrackerSheetId);
        const recordNumberCellData = await getCellData(jobTrackerSheetId, event.rowId, recordNumberColumnId);
        const task = await SmartsheetTaskTrackingModel.findOne({ taskId: recordNumberCellData }) as (ITaskHourRecord & Document);

        if (!task) {
            const newTask = new SmartsheetTaskTrackingModel({
                taskId: recordNumberCellData,
                timeIntervals: []
            });

            if (statusCellData === 'Start') {
                newTask.timeIntervals.push({ start: new Date() });
            } else if (statusCellData === 'Stop' || statusCellData === 'Completed') {
                newTask.timeIntervals.push({ stop: new Date() });
            }

            await newTask.save();
            console.log('New task created:', newTask);
        } else {
            // console.log('statusCellData', statusCellData);
            if (statusCellData === 'Start') {
                await task.addStartTime(new Date());
            } else if (statusCellData === 'Stop' || statusCellData === 'Completed') {
                await task.addStopTime(new Date());
            }
        }
    } catch (err) {
        console.error("Smartsheet Controller: Error in webhook event handler.", err);
    }
};


// Function to get column ID for a column name
const getColumnIdForColumnName = async (columnName: string, sheetId: string): Promise<number> => {
    console.log('Get column id for column name', columnName);
    try {
        const columns = await smartsheet.sheets.getColumns({ sheetId });
        console.log('columns ', columns?.data?.length)
        // Specify the type of 'col' as 'Column' in the 'find' method callback
        const column = columns.data.find((col: SmartsheetColumnType) => col.title === columnName);
        console.log('column:', column)
        if (column) {
            return column.id;
        } else {
            throw new Error("Smartsheet Controller: Column name not found.");
        }
    } catch (err) {
        console.error('Smartsheet Controller: Error in getColumnIdForColumnName:', err);
        throw err;
    }
};

// Function to get cell data for a specific row and column
const getCellData = async (sheetId: string, rowId: number, columnId: number): Promise<string | null> => {
    try {
        const row = await smartsheet.sheets.getRow({ sheetId, rowId });

        const cell = row.cells.find((cell: SmartsheetRowCellType) => cell.columnId === columnId);

        return cell ? cell.value : null;
    } catch (error) {
        console.error(`Smartsheet Controller: Error fetching cell data: ${(error as Error).message}`);
        return null;
    }
};



export const addJobCardDataToSmartsheet = async (rows: SimproScheduleType[], smartsheetId: string) => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: smartsheetId });
        const columns = sheetInfo.columns;
        let rowsToAdd: SimproScheduleType[] = [];
        let rowsToUpdate: SimproScheduleType[] = [];

        let fetchedScheduleIDs = rows.map(row => row.ID);
        console.log('fetchedScheduleIDs: ', fetchedScheduleIDs.length)
        let scheduleIdColumnId = await getColumnIdForColumnName("ScheduleID", smartsheetId);
        console.log('scheduleIdColumnId', scheduleIdColumnId)
        const existingRows = sheetInfo.rows;

        let existingScheduleIdsInSheet: number[] = existingRows
            .map((row: SmartsheetSheetRowsType) => {
                const cellData = row.cells.find((cellData) => cellData.columnId === scheduleIdColumnId);
                if (cellData) {
                    return cellData.value;
                }
                return null;
            })
            .filter((value: number | string | null) => value !== null);

        let scheduleIdToUpdate = Array.isArray(existingScheduleIdsInSheet)
            ? existingScheduleIdsInSheet.filter(scheduleId => fetchedScheduleIDs.includes(scheduleId))
            : [];

        let scheduleIdsNotPartOfSimproResponse = Array.isArray(fetchedScheduleIDs) ? existingScheduleIdsInSheet.filter(scheduleId => !fetchedScheduleIDs.includes(scheduleId)) : [];

        let scheduleIdToAdd = Array.isArray(fetchedScheduleIDs) ? fetchedScheduleIDs.filter(scheduleId => !existingScheduleIdsInSheet.includes(scheduleId)) : [];

        rows.forEach((row) => {
            if (scheduleIdToAdd.includes(row.ID)) {
                rowsToAdd.push(row);
            } else if (scheduleIdToUpdate.includes(row.ID)) {
                rowsToUpdate.push(row)
            }
        })

        if (rowsToAdd.length) {
            const rowsToAddToSmartSheet = convertSimproScheduleDataToSmartsheetFormat(rowsToAdd, columns, "full");
            if (rowsToAddToSmartSheet.length > 0) {
                console.log('Adding the rows to sheet for jobcard', rowsToAddToSmartSheet.length)
                const chunks = splitIntoChunks(rowsToAddToSmartSheet, 100);

                for (const chunk of chunks) {
                    try {
                        await smartsheet.sheets.addRows({
                            sheetId: smartsheetId,
                            body: chunk,
                        });

                        console.log(` No. of records added in this chunk: ${chunk.length}`);
                    } catch (err) {
                        console.error(' Error in adding row chunk:', err);
                        throw err;
                    }
                }
            }
        }

        if (rowsToUpdate.length) {
            await updateExistingRecordsInJobCardSheet(rowsToUpdate, scheduleIdsNotPartOfSimproResponse, smartsheetId)
        }




        return { status: true, message: "Data added successfully" }
    } catch (err) {
        console.error('Error in adding job card data to Smartsheet:', err);
        return { status: false, message: "Error adding data to Smartsheet" }

    }
}

const addScheduleDeleteCommentInChunks = async (rowIds: number[], smartsheetId: string) => {
    try {
        // console.log("Row IDs to update with comments: ", rowIds);

        // Get column ID for the 'ScheduleComment' column
        const columnIdForScheduleComment = await getColumnIdForColumnName('ScheduleComment', smartsheetId);
        console.log('Column ID for ScheduleComment:', columnIdForScheduleComment);

        // Split the rows into manageable chunks
        const chunks = splitIntoChunks(rowIds, 300);

        for (const chunk of chunks) {
            // Prepare rows for batch update
            const rowsToUpdate = chunk.map(rowId => ({
                id: rowId,
                cells: [{ columnId: columnIdForScheduleComment, value: "Deleted from Simpro" }],
            }));

            // Batch update rows
            await smartsheet.sheets.updateRow({
                sheetId: smartsheetId,
                body: rowsToUpdate,
            });

            console.log('JOb CArd: Updated chunk with', chunk.length, 'rows');
        }
    } catch (err) {
        if (err instanceof AxiosError) {
            console.error("Error in addScheduleDeleteCommentInChunks as AxiosError");
            console.error("Error details:", err.response?.data);
        } else {
            console.error("Error in addScheduleDeleteCommentInChunks as other error");
            console.error("Error details:", err);
        }
    }
};

const updateTheSimproSchedulesData = async (
    updatedSimproData: SimproScheduleType[],
    columns: SmartsheetColumnType[],
    existingScheduleIdsData: ExistingScheduleType[],
    smartsheetId: string,
    updateType: string,
) => {
    try {
        let simproIdRowIdMap: { [key: string]: string } = {};

        updatedSimproData.forEach(simproScheduleItem => {
            const matchingSchedule = existingScheduleIdsData.find(scheduleData => scheduleData.scheduleId === simproScheduleItem.ID);
            if (matchingSchedule) {
                simproIdRowIdMap[simproScheduleItem.ID.toString()] = matchingSchedule.rowId.toString();
            }
        });


        let rowsToUpdateToSmartSheet = convertSimproScheduleDataToSmartsheetFormatForUpdate(updatedSimproData, columns, simproIdRowIdMap, updateType);

        const chunks = splitIntoChunks(rowsToUpdateToSmartSheet, 100);
        for (const chunk of chunks) {
            await smartsheet.sheets.updateRow({
                sheetId: smartsheetId,
                body: chunk
            })

            console.log("update chunk", chunk?.length)
        }

    } catch (err) {
        console.error("Error 2", err);
        throw {
            message: "Something went wrong in the updateTheSimproScheduleData"
        }
    }
}

export const updateExistingRecordsInJobCardSheet = async (
    rowsToUpdate: SimproScheduleType[],
    scheduleIdsNotPartOfSimproResponse: number[],
    smartsheetId: string,
) => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: smartsheetId });
        let scheduleIdColumnId = await getColumnIdForColumnName("ScheduleID", smartsheetId.toString());

        const existingRows = sheetInfo.rows || [];
        const columns = sheetInfo.columns || [];

        console.log("Getting exisitng schedule id")
        const existingScheduleIdsData: ExistingScheduleType[] = existingRows
            .map((row: SmartsheetSheetRowsType) => {
                const scheduleId = row.cells.find(cell => cell.columnId === scheduleIdColumnId)?.value;
                return scheduleId ? { scheduleId: Number(scheduleId), rowId: row.id } : null;

            })
            .filter(Boolean);

        // Fetch schedule data for existing IDs
        const fetchedScheduleDataForExistingData = await fetchScheduleDataForExistingScheduleIds(scheduleIdsNotPartOfSimproResponse, "full");
        console.log("Fetching exsting data is completed.")

        // Extract schedule data and IDs to mark as deleted
        const updatedSimproData: SimproScheduleType[] = [...(fetchedScheduleDataForExistingData?.scheduleDataFromSimpro || []), ...rowsToUpdate];
        const schedulesIdToMarkDeleted: string[] = fetchedScheduleDataForExistingData?.scheduleIdToMarkDeleted || [];

        // Find rows to delete based on the fetched schedule IDs to be marked as deleted
        const rowsToMarkDeleted = existingScheduleIdsData.filter(item =>
            schedulesIdToMarkDeleted.includes(item.scheduleId.toString())
        );

        // Delete rows in chunks if there are any rows to delete
        if (rowsToMarkDeleted.length) {
            console.log("Marking ", rowsToMarkDeleted.length, " rows as deleted")
            await addScheduleDeleteCommentInChunks(rowsToMarkDeleted.map(row => Number(row.rowId)), smartsheetId);
        }

        if (updatedSimproData.length) {
            console.log("Update the ", updatedSimproData.length, "row fetched from simpro")
            await updateTheSimproSchedulesData(updatedSimproData, columns, existingScheduleIdsData, smartsheetId, 'full');
        }

    } catch (err) {
        console.log("Error ", err)
        if (err instanceof AxiosError) {
            console.log("Error in updateExistingRecordsInJobCardSheet as AxiosError");
            console.log("Error details: ", err.response?.data);

        } else {
            console.log("Error in updateExistingRecordsInJobCardSheet as other error");
            console.log("Error details: ", err);
        }
        throw {
            message: "Error in updateExistingRecordsInJobCardSheet ub smartsheet controller."
        }
    }
}


export const addOpenQuotesDataToSmartsheet = async (rows: SimproQuotationType[]) => {
    try {
        console.log("Fethced Quotation data length: ", rows.length);
        const sheetInfo = await smartsheet.sheets.getSheet({ id: ongoingQuotationSheetId });
        const columns = sheetInfo.columns;
        let rowsToAdd: SimproQuotationType[] = [];
        let rowsToUpdate: SimproQuotationType[] = [];

        let fetchedQuoteIDs = rows.map(row => row.ID);

        let quoteIdColumnId = await getColumnIdForColumnName("QuoteID", ongoingQuotationSheetId);
        const existingRows = sheetInfo.rows;

        let existingQuoteIdsInSheet: number[] = existingRows
            .map((row: SmartsheetSheetRowsType) => {
                const cellData = row.cells.find((cellData) => cellData.columnId === quoteIdColumnId);
                if (cellData) {
                    return cellData.value;
                }
                return null;
            })
            .filter((value: number | string | null) => value !== null);

        let quoteIdToUpdate = Array.isArray(existingQuoteIdsInSheet)
            ? existingQuoteIdsInSheet.filter(scheduleId => fetchedQuoteIDs.includes(scheduleId))
            : [];

        let quoteIdNotPartOfSimproResponse = Array.isArray(fetchedQuoteIDs) ? existingQuoteIdsInSheet.filter(quoteId => !fetchedQuoteIDs.includes(quoteId)) : [];


        let quoteIdToAdd = Array.isArray(fetchedQuoteIDs) ? fetchedQuoteIDs.filter(scheduleId => !existingQuoteIdsInSheet.includes(scheduleId)) : [];


        rows.forEach((row) => {
            if (quoteIdToAdd.includes(row.ID)) {
                rowsToAdd.push(row);
            } else if (quoteIdToUpdate.includes(row.ID)) {
                rowsToUpdate.push(row)
            }
        })

        if (rowsToAdd.length) {
            const rowsToAddToSmartSheet = convertSimproQuotationDataToSmartsheetFormat(rowsToAdd, columns,);
            if (rowsToAddToSmartSheet.length > 0) {
                console.log('Adding the rows to sheet for quote data', rowsToAddToSmartSheet.length)
                const chunks = splitIntoChunks(rowsToAddToSmartSheet, 100);

                for (const chunk of chunks) {
                    try {
                        await smartsheet.sheets.addRows({
                            sheetId: ongoingQuotationSheetId,
                            body: chunk,
                        });

                        console.log(` No. of records added in this chunk: ${chunk.length}`);
                    } catch (err) {
                        console.error(' Error in adding row chunk:', err);
                        throw err;
                    }
                }
            }
        }



        let existingQuoteIdData: ExistingQuotationType[] = existingRows.map((row: SmartsheetSheetRowsType) => {
            const quoteId = row.cells.find(cell => cell.columnId === quoteIdColumnId)?.value;
            return quoteId ? { quoteId: Number(quoteId), rowId: row.id } : null;
        })
            .filter(Boolean);

        const rowIdsMarksAsDeleted: string[] = existingQuoteIdData
            .filter(item => quoteIdNotPartOfSimproResponse.includes(Number(item.quoteId))) // Ensure quoteId is a number
            .map(item => String(item.rowId));


        console.log("Quotatin to mark as deleted:", rowIdsMarksAsDeleted?.length)


        // logic to mark the quote comment
        if (rowIdsMarksAsDeleted.length) {
            let columnIdForQuoteComment = await getColumnIdForColumnName('QuoteComment', ongoingQuotationSheetId)
            console.log('ColumnId for quote comment:', columnIdForQuoteComment)
            const chunks = splitIntoChunks(rowIdsMarksAsDeleted, 300);
            for (const chunk of chunks) {
                // Prepare rows for batch update
                const rowsToUpdateComment = chunk.map(rowId => ({
                    id: rowId,
                    cells: [{ columnId: columnIdForQuoteComment, value: "Deleted From Simpro" }],
                }));

                console.log("rowsToUpdateComment", JSON.stringify(rowsToUpdateComment));

                // Batch update rows
                await smartsheet.sheets.updateRow({
                    sheetId: ongoingQuotationSheetId,
                    body: rowsToUpdateComment,
                });

                console.log('Quote ID: Updated chunk with', chunk.length, 'rows');
            }
            console.log("Marking ", rowIdsMarksAsDeleted.length, " rows as deleted")
        }

        if (rowsToUpdate.length) {
            //logic to update the data in sheet:
            let simproIdRowIdMap: { [key: string]: string } = {};
            rowsToUpdate.forEach(simproQuoteItem => {
                const matchingSchedule = existingQuoteIdData.find(quoteData => quoteData.quoteId === simproQuoteItem.ID);
                if (matchingSchedule) {
                    simproIdRowIdMap[simproQuoteItem.ID.toString()] = matchingSchedule.rowId.toString();
                }
            });

            let rowsToUpdateToSmartsheet = convertSimproQuotationDataToSmartsheetFormatForUpdate(rowsToUpdate, columns, simproIdRowIdMap);


            const chunks = splitIntoChunks(rowsToUpdateToSmartsheet, 100);
            for (const chunk of chunks) {
                await smartsheet.sheets.updateRow({
                    sheetId: ongoingQuotationSheetId,
                    body: chunk
                })

                console.log("update chunk", chunk?.length)
            }


        }

        return { status: true, message: "Data added successfully" }
    } catch (err) {
        console.error('Error in adding quotes data to Smartsheet:', err);
        return { status: false, message: "Error adding data to Smartsheet" }

    }
}

export const addOpenLeadsDataToSmartsheet = async (rows: SimproLeadType[]) => {
    try {
        console.log("Number of rows of leads fetch:", rows?.length)
        const sheetInfo = await smartsheet.sheets.getSheet({ id: ongoingLeadsSheetId });
        const columns = sheetInfo.columns;
        let rowsToAdd: SimproLeadType[] = [];
        let rowsToUpdate: SimproLeadType[] = [];

        let fetchedLeadsIds = rows.map(row => row.ID);

        let leadIdColumnId = await getColumnIdForColumnName("LeadID", ongoingLeadsSheetId);
        const existingRows = sheetInfo.rows;

        let existingLeadIdsInSheet: number[] = existingRows
            .map((row: SmartsheetSheetRowsType) => {
                const cellData = row.cells.find((cellData) => cellData.columnId === leadIdColumnId);
                if (cellData) {
                    return cellData.value;
                }
                return null;
            })
            .filter((value: number | string | null) => value !== null);

        let leadIdsToUpdate = Array.isArray(existingLeadIdsInSheet)
            ? existingLeadIdsInSheet.filter(leadId => fetchedLeadsIds.includes(leadId))
            : [];

        let leadIdNotPartOfSimproResponse = Array.isArray(fetchedLeadsIds) ? existingLeadIdsInSheet.filter(leadId => !fetchedLeadsIds.includes(leadId)) : [];
        console.log("LeadIdNotPartOfSimproResponse", JSON.stringify(leadIdNotPartOfSimproResponse))

        let leadIdToAdd = Array.isArray(fetchedLeadsIds) ? fetchedLeadsIds.filter(leadId => !existingLeadIdsInSheet.includes(leadId)) : [];


        rows.forEach((row) => {
            if (leadIdToAdd.includes(row.ID)) {
                rowsToAdd.push(row);
            } else if (leadIdsToUpdate.includes(row.ID)) {
                rowsToUpdate.push(row)
            }
        })

        if (rowsToAdd.length) {
            const rowsToAddToSmartSheet = convertSimproLeadsDataToSmartsheetFormat(rowsToAdd, columns,);
            if (rowsToAddToSmartSheet.length > 0) {
                console.log('Adding the rows to sheet open lead data', rowsToAddToSmartSheet.length)
                const chunks = splitIntoChunks(rowsToAddToSmartSheet, 100);

                for (const chunk of chunks) {
                    try {
                        await smartsheet.sheets.addRows({
                            sheetId: ongoingLeadsSheetId,
                            body: chunk,
                        });

                        console.log(` No. of records added in this chunk: ${chunk.length}`);
                    } catch (err) {
                        console.error(' Error in adding row chunk:', err);
                        throw err;
                    }
                }
            }
        }




        let existingLeadIdData: ExistingLeadsType[] = existingRows.map((row: SmartsheetSheetRowsType) => {
            const leadId = row.cells.find(cell => cell.columnId === leadIdColumnId)?.value;
            return leadId ? { leadId: Number(leadId), rowId: row.id } : null;
        })
            .filter(Boolean);



        const rowIdsMarksAsDeleted: string[] = existingLeadIdData
            .filter(item => leadIdNotPartOfSimproResponse.includes(Number(item.leadId)))
            .map(item => String(item.rowId));


        console.log("Quotatin to mark as deleted:", rowIdsMarksAsDeleted?.length)



        // logic to mark the quote comment
        if (rowIdsMarksAsDeleted.length) {
            let columnIdForLeadComment = await getColumnIdForColumnName('LeadComment', ongoingLeadsSheetId)
            console.log('ColumnId for lead comment:', columnIdForLeadComment)
            const chunks = splitIntoChunks(rowIdsMarksAsDeleted, 300);
            for (const chunk of chunks) {
                // Prepare rows for batch update
                const rowsToUpdateComment = chunk.map(rowId => ({
                    id: rowId,
                    cells: [{ columnId: columnIdForLeadComment, value: "Deleted From Simpro" }],
                }));

                // Batch update rows
                await smartsheet.sheets.updateRow({
                    sheetId: ongoingLeadsSheetId,
                    body: rowsToUpdateComment,
                });

                console.log('Quote ID: Updated chunk with', chunk.length, 'rows');
            }
            console.log("Marking ", rowIdsMarksAsDeleted.length, " rows as deleted")
        }

        if (rowsToUpdate.length) {
            //logic to update the data in sheet:
            let simproIdRowIdMap: { [key: string]: string } = {};
            rowsToUpdate.forEach(simproQuoteItem => {
                const matchingSchedule = existingLeadIdData.find(quoteData => quoteData.leadId === simproQuoteItem.ID);
                if (matchingSchedule) {
                    simproIdRowIdMap[simproQuoteItem.ID.toString()] = matchingSchedule.rowId.toString();
                }
            });

            let rowsToUpdateToSmartsheet = convertSimproLeadsDataToSmartsheetFormatForUpdate(rowsToUpdate, columns, simproIdRowIdMap);


            const chunks = splitIntoChunks(rowsToUpdateToSmartsheet, 100);
            for (const chunk of chunks) {
                await smartsheet.sheets.updateRow({
                    sheetId: ongoingLeadsSheetId,
                    body: chunk
                })

                console.log("update chunk", chunk?.length)
            }


        }


        return { status: true, message: "Data added successfully" }
    } catch (err) {
        console.error('Error in adding leads data to Smartsheet:', err);
        return { status: false, message: "Error adding data to Smartsheet" }

    }
}


export const updateMinimalExistingRecordsInJobCardSheet = async (
    rowsToUpdate: SimproScheduleType[],
    scheduleIdsNotPartOfSimproResponse: number[],
    smartsheetId: string,
) => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: smartsheetId });
        let scheduleIdColumnId = await getColumnIdForColumnName("ScheduleID", smartsheetId.toString());

        const existingRows = sheetInfo.rows || [];
        const columns = sheetInfo.columns || [];

        console.log("Getting exisitng schedule id")
        const existingScheduleIdsData: ExistingScheduleType[] = existingRows
            .map((row: SmartsheetSheetRowsType) => {
                const scheduleId = row.cells.find(cell => cell.columnId === scheduleIdColumnId)?.value;
                return scheduleId ? { scheduleId: Number(scheduleId), rowId: row.id } : null;

            })
            .filter(Boolean);

        // Fetch schedule data for existing IDs
        const fetchedScheduleDataForExistingData = await fetchScheduleDataForExistingScheduleIds(scheduleIdsNotPartOfSimproResponse, "minimal");
        console.log("Fetching exsting data is completed.")

        // Extract schedule data and IDs to mark as deleted
        const updatedSimproData: SimproScheduleType[] = [...(fetchedScheduleDataForExistingData?.scheduleDataFromSimpro || []), ...rowsToUpdate];
        const schedulesIdToMarkDeleted: string[] = fetchedScheduleDataForExistingData?.scheduleIdToMarkDeleted || [];

        // Find rows to delete based on the fetched schedule IDs to be marked as deleted
        const rowsToMarkDeleted = existingScheduleIdsData.filter(item =>
            schedulesIdToMarkDeleted.includes(item.scheduleId.toString())
        );

        // Delete rows in chunks if there are any rows to delete
        if (rowsToMarkDeleted.length) {
            console.log("Marking ", rowsToMarkDeleted.length, " rows as deleted")
            await addScheduleDeleteCommentInChunks(rowsToMarkDeleted.map(row => Number(row.rowId)), smartsheetId);
        }

        if (updatedSimproData.length) {
            console.log("Update the ", updatedSimproData.length, "row fetched from simpro")
            await updateTheSimproSchedulesData(updatedSimproData, columns, existingScheduleIdsData, smartsheetId, 'minimal');
        }

    } catch (err) {
        console.log("Error ", err)
        if (err instanceof AxiosError) {
            console.log("Error in updateExistingRecordsInJobCardSheet as AxiosError");
            console.log("Error details: ", err.response?.data);

        } else {
            console.log("Error in updateExistingRecordsInJobCardSheet as other error");
            console.log("Error details: ", err);
        }
        throw {
            message: "Error in updateExistingRecordsInJobCardSheet ub smartsheet controller."
        }
    }
}



export const addMinimalJobCardDataToSmartsheet = async (rows: SimproScheduleType[], smartsheetId: string, updateType: string) => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: smartsheetId });
        const columns = sheetInfo.columns;
        let rowsToUpdate: SimproScheduleType[] = [];

        let fetchedScheduleIDs = rows.map(row => row.ID);

        let scheduleIdColumnId = await getColumnIdForColumnName("ScheduleID", smartsheetId);
        const existingRows = sheetInfo.rows;

        let existingScheduleIdsInSheet: number[] = existingRows
            .map((row: SmartsheetSheetRowsType) => {
                const cellData = row.cells.find((cellData) => cellData.columnId === scheduleIdColumnId);
                if (cellData) {
                    return cellData.value;
                }
                return null;
            })
            .filter((value: number | string | null) => value !== null);

        let scheduleIdToUpdate = Array.isArray(existingScheduleIdsInSheet)
            ? existingScheduleIdsInSheet.filter(scheduleId => fetchedScheduleIDs.includes(scheduleId))
            : [];

        let scheduleIdsNotPartOfSimproResponse = Array.isArray(fetchedScheduleIDs) ? existingScheduleIdsInSheet.filter(scheduleId => !fetchedScheduleIDs.includes(scheduleId)) : [];

        let scheduleIdToAdd = Array.isArray(fetchedScheduleIDs) ? fetchedScheduleIDs.filter(scheduleId => !existingScheduleIdsInSheet.includes(scheduleId)) : [];

        rows.forEach((row) => {
            if (scheduleIdToUpdate.includes(row.ID)) {
                rowsToUpdate.push(row)
            }
        })

        if (scheduleIdToAdd.length) {
            const fetchedScheduleDataForAddNewData = await fetchScheduleDataForExistingScheduleIds(scheduleIdToAdd, "full");
            let rowsToAddToSmartSheet;
            if (fetchedScheduleDataForAddNewData && fetchedScheduleDataForAddNewData?.scheduleDataFromSimpro?.length) {
                rowsToAddToSmartSheet = convertSimproScheduleDataToSmartsheetFormat(fetchedScheduleDataForAddNewData.scheduleDataFromSimpro || [], columns, "full");
                if (rowsToAddToSmartSheet.length > 0) {
                    console.log('Minimal : Adding the rows to sheet for min job card', rowsToAddToSmartSheet.length)
                    const chunks = splitIntoChunks(rowsToAddToSmartSheet, 100);

                    for (const chunk of chunks) {
                        try {
                            await smartsheet.sheets.addRows({
                                sheetId: smartsheetId,
                                body: chunk,
                            });

                            console.log(`Minimal : No. of records added in this chunk: ${chunk.length}`);
                        } catch (err) {
                            console.error('Minimal : Error in adding row chunk:', err);
                            throw err;
                        }
                    }
                }
            }

        }

        if (rowsToUpdate.length) {
            await updateMinimalExistingRecordsInJobCardSheet(rowsToUpdate, scheduleIdsNotPartOfSimproResponse, smartsheetId)
        }


        return { status: true, message: "Data added successfully" }
    } catch (err) {
        console.error('Error in adding minimal job card data to Smartsheet:', err);
        return { status: false, message: "Error adding data to Smartsheet" }

    }
}

console.log('jobCardSheetId', jobCardSheetId)
// This is to test the site suburb information
export const updateSuburbDataForSite = async (req: Request, res: Response) => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardSheetId });

        let suburbColumnId = await getColumnIdForColumnName("Suburb", jobCardSheetId.toString());
        console.log('suburbColumnId', suburbColumnId)
        let siteIDColumnId = await getColumnIdForColumnName("SiteID", jobCardSheetId.toString());
        const existingRows: SmartsheetSheetRowsType[] = sheetInfo.rows;
        let dataToUpdate = [];
        for (let i = 0; i < existingRows.length; i++) {
            let rowIdForRow = existingRows[i].id;
            let siteId = existingRows[i].cells.find(cell => cell.columnId === siteIDColumnId)?.value;
            if (siteId) {
                const siteResponse = await axiosSimPRO.get(`/sites/${siteId}?columns=ID,Name,Address`);
                let siteResponseData = siteResponse.data;
                console.log('Site response', siteResponseData)

                let cellsData = [{ columnId: suburbColumnId, value: siteResponseData?.Address?.City || "" }]
                let dataToPush: SmartsheetSheetRowsType = { id: rowIdForRow, cells: cellsData };
                dataToUpdate.push(dataToPush)
            }

        }
        console.log('dataToUpdate: ', JSON.stringify(dataToUpdate))

        const chunks = splitIntoChunks(dataToUpdate, 150);
        for (const chunk of chunks) {

            await smartsheet.sheets.updateRow({
                sheetId: jobCardSheetId,
                body: chunk,
            });
            console.log("no of chunks updated", chunk.length)
        }

        res.status(200).json({ message: "updated the row data" });
    } catch (err) {
        res.status(500).json({ err: err })
    }
}

export const addJobRoofingDetailsToSmartSheet = async (rows: SimproJobCostCenterType[], smartsheetId: string) => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: smartsheetId });
        const columns = sheetInfo.columns;

        let fetchedCostCenters = rows;
        let costCenterIdColumnId = await getColumnIdForColumnName("Cost_Center.ID", smartsheetId);
        let jobIdColumnId = await getColumnIdForColumnName("JobID", smartsheetId);
        let jobSectionIdColumnId = await getColumnIdForColumnName("Job_Section.ID", smartsheetId);
        const existingRows = sheetInfo.rows;

        let existingCostcenterIdsInSheet: ExistingIncomeType[] = existingRows
            .map((row: SmartsheetSheetRowsType) => {
                const cellDataCostCenter = row.cells.find((cellData) => cellData.columnId === costCenterIdColumnId);
                const cellDataJob = row.cells.find((cellData) => cellData.columnId === jobIdColumnId);
                const cellDataSection = row.cells.find((cellData) => cellData.columnId === jobSectionIdColumnId);
                if (cellDataCostCenter && cellDataJob && cellDataSection) {
                    return {
                        JobID: cellDataJob.value,
                        CostCenterID: cellDataCostCenter.value,
                        SectionID: cellDataSection.value
                    };
                }
                return null;
            })
            .filter((value: number | string | null) => value !== null);

        let constCentersToUpdate = Array.isArray(existingCostcenterIdsInSheet)
            ?
            fetchedCostCenters.filter(fetched =>
                existingCostcenterIdsInSheet.some(existing =>
                    existing.CostCenterID == fetched.CostCenter.ID
                    && existing.JobID == fetched.Job.ID
                    && existing.SectionID == fetched.Section.ID))
            : [];

        let constCentersNotPartOfSimproResponse: SimproJobCostCenterType[] = [];
        existingCostcenterIdsInSheet.forEach(existing => {
            if (!fetchedCostCenters.some(costCenter =>
                costCenter.CostCenter.ID == existing.CostCenterID
                && costCenter.Job.ID == existing.JobID
                && costCenter.Section.ID == existing.SectionID))
                constCentersNotPartOfSimproResponse.push({
                    CostCenter: {
                        ID: existing.CostCenterID,
                        Name: ''
                    },
                    Job: {
                        ID: existing.JobID,
                        Type: ''
                    },
                    Section: {
                        ID: existing.SectionID,
                        Name: ''
                    },
                    ID: 0,
                    ccRecordId: 0,
                    Name: '',
                    DateModified: '',
                    _href: ''
                })
        })

        let constCentersToAdd = Array.isArray(existingCostcenterIdsInSheet) ? fetchedCostCenters.filter(costCenter =>
            !existingCostcenterIdsInSheet.some(existing =>
                costCenter.CostCenter.ID == existing.CostCenterID
                && costCenter.Job.ID == existing.JobID
                && costCenter.Section.ID == existing.SectionID)) : [];



        if (constCentersToAdd.length) {
            const rowsToAddToSmartSheet = convertSimproRoofingDataToSmartsheetFormat(constCentersToAdd, columns, "full");
            if (rowsToAddToSmartSheet.length > 0) {
                console.log('Adding the rows to sheet for roofing details', rowsToAddToSmartSheet.length)
                const chunks = splitIntoChunks(rowsToAddToSmartSheet, 100);

                for (const chunk of chunks) {
                    try {
                        await smartsheet.sheets.addRows({
                            sheetId: smartsheetId,
                            body: chunk,
                        });

                        console.log(` No. of records added in this chunk: ${chunk.length}`);
                    } catch (err) {
                        console.error(' Error in adding row chunk:', err);
                        throw err;
                    }
                }
            }
        }

        if (constCentersToUpdate.length) {
            await updateJobRoofingDetailsToSmartSheet(constCentersToUpdate, constCentersNotPartOfSimproResponse, smartsheetId)
        }

        return { status: true, message: "Data added successfully" }
    } catch (err) {
        console.error('Error in adding job card data to Smartsheet:', err);
        return { status: false, message: "Error adding data to Smartsheet" }

    }
}

export const updateJobRoofingDetailsToSmartSheet = async (rowsToUpdate: SimproJobCostCenterType[],
    costCentersNotPartOfSimproResponse: SimproJobCostCenterType[],
    smartsheetId: string,) => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: smartsheetId });
        let costCenterIdColumnId = await getColumnIdForColumnName("Cost_Center.ID", smartsheetId);
        let jobIdColumnId = await getColumnIdForColumnName("JobID", smartsheetId);
        let jobSectionIdColumnId = await getColumnIdForColumnName("Job_Section.ID", smartsheetId);
        const existingRows = sheetInfo.rows || [];
        const columns = sheetInfo.columns || [];

        console.log("Getting exisitng costcenter id")
        const existingcostCenterIdsData: ExistingCostCenterType[] = existingRows
            .map((row: SmartsheetSheetRowsType) => {
                const costCenterId = row.cells.find(cell => cell.columnId === costCenterIdColumnId)?.value;
                const jobId = row.cells.find(cell => cell.columnId === jobIdColumnId)?.value;
                const jobSectionId = row.cells.find(cell => cell.columnId === jobSectionIdColumnId)?.value;
                return costCenterId && jobId && jobSectionId ? { costCenterId: Number(costCenterId), jobId: Number(jobId), jobSectionId: Number(jobSectionId), rowId: row.id } : null;
            })
            .filter(Boolean);

        // Fetch costCenter data for existing IDs
        fetchDataCostCenters(costCentersNotPartOfSimproResponse, 'full', async (costCenterIdToMarkDeleted: string[], costCenterDataFromSimpro: SimproJobCostCenterType[]) => {
            // Extract costCenter data and IDs to mark as deleted
            const updatedSimproData: SimproJobCostCenterType[] = [...(costCenterDataFromSimpro || []), ...rowsToUpdate];
            const costCentersIdToMarkDeleted: string[] = costCenterIdToMarkDeleted || [];

            console.dir(updatedSimproData, { depth: null })

            // Find rows to delete based on the fetched costCenter IDs to be marked as deleted
            const rowsToMarkDeleted = existingcostCenterIdsData.filter(item =>
                costCentersIdToMarkDeleted.includes(item.costCenterId.toString())
            );

            // Delete rows in chunks if there are any rows to delete
            if (rowsToMarkDeleted.length) {
                console.log("Marking ", rowsToMarkDeleted.length, " rows as deleted")
                await addCostCenterDeleteCommentInChunks(rowsToMarkDeleted.map(row => Number(row.rowId)), smartsheetId);
            }

            if (updatedSimproData.length) {
                console.log("Update the ", updatedSimproData.length, "row fetched from simpro")
                await updateSimproRoofingJobData(updatedSimproData, columns, existingcostCenterIdsData, smartsheetId, 'full');
            }
        });


    } catch (err) {
        console.log("Error ", err)
        if (err instanceof AxiosError) {
            console.log("Error in updateExistingRecordsInJobCardSheet as AxiosError");
            console.log("Error details: ", err.response?.data);

        } else {
            console.log("Error in updateExistingRecordsInJobCardSheet as other error");
            console.log("Error details: ", err);
        }
        throw err;
    }
}

const updateSimproRoofingJobData = async (
    updatedSimproData: SimproJobCostCenterType[],
    columns: SmartsheetColumnType[],
    existingcostCenterIdsData: ExistingCostCenterType[],
    smartsheetId: string,
    updateType: string,
) => {
    try {
        let simproIdRowIdMap: { [key: string]: string } = {};

        updatedSimproData.forEach(simprocostCenterItem => {
            const matchingcostCenter = existingcostCenterIdsData.find(costCenterData => costCenterData.costCenterId === simprocostCenterItem.CostCenter.ID);
            if (matchingcostCenter) {
                simproIdRowIdMap[simprocostCenterItem.ID.toString()] = matchingcostCenter.rowId.toString();
            }
        });

        let rowsToUpdateToSmartSheet = convertSimprocostCenterDataToSmartsheetFormatForUpdate(updatedSimproData, columns, simproIdRowIdMap, updateType);

        console.log('rowsToUpdateToSmartSheet: ', rowsToUpdateToSmartSheet)
        const chunks = splitIntoChunks(rowsToUpdateToSmartSheet, 100);
        for (const chunk of chunks) {
            await smartsheet.sheets.updateRow({
                sheetId: smartsheetId,
                body: chunk
            })

            console.log("update chunk", chunk?.length)
        }

    } catch (err) {
        console.error("Error 2", err);
        throw {
            message: "Something went wrong in the updateTheSimprocostCenterData"
        }
    }
}

const addCostCenterDeleteCommentInChunks = async (rowIds: number[], smartsheetId: string) => {
    try {
        // console.log("Row IDs to update with comments: ", rowIds);

        // Get column ID for the 'ScheduleComment' column
        const columnIdForScheduleComment = await getColumnIdForColumnName('ScheduleComment', smartsheetId);
        console.log('Column ID for Comment:', columnIdForScheduleComment);

        // Split the rows into manageable chunks
        const chunks = splitIntoChunks(rowIds, 300);

        for (const chunk of chunks) {
            // Prepare rows for batch update
            const rowsToUpdate = chunk.map(rowId => ({
                id: rowId,
                cells: [{ columnId: columnIdForScheduleComment, value: "Deleted from Simpro" }],
            }));

            // Batch update rows
            await smartsheet.sheets.updateRow({
                sheetId: smartsheetId,
                body: rowsToUpdate,
            });

            console.log('JOb CArd: Updated chunk with', chunk.length, 'rows');
        }
    } catch (err) {
        if (err instanceof AxiosError) {
            console.error("Error in addScheduleDeleteCommentInChunks as AxiosError");
            console.error("Error details:", err.response?.data);
        } else {
            console.error("Error in addScheduleDeleteCommentInChunks as other error");
            console.error("Error details:", err);
        }
    }
};

export const updateAmountValuesInRoofingWipSheet = async (req: Request, res: Response) => {
    try {
        const activeSheetInfo = await smartsheet.sheets.getSheet({ id: jobCardRoofingDetailSheetId });
        const activeRows = activeSheetInfo.rows;
        let costCenterIdColumnId = await getColumnIdForColumnName("Cost_Center.ID", jobCardRoofingDetailSheetId);
        let sectionIdColumnId = await getColumnIdForColumnName("Job_Section.ID", jobCardRoofingDetailSheetId);
        const jobIdColumnId = await getColumnIdForColumnName("JobID", jobCardRoofingDetailSheetId)
        const existingActiveCostcenterJobsInSheet: CostCenterJobInfo[] = activeRows
            .map((row: SmartsheetSheetRowsType) => {
                const cellDataCostCenter = row.cells.find(
                    (cellData) => cellData.columnId === costCenterIdColumnId
                );
                const cellDataJobSection = row.cells.find(
                    (cellData) => cellData.columnId === sectionIdColumnId
                );
                const cellDataJobId = row.cells.find(
                    (cellData) => cellData.columnId === jobIdColumnId
                );

                if (cellDataCostCenter && cellDataJobSection && cellDataJobId) {
                    return {
                        costCenterId: cellDataCostCenter.value,
                        sectionId: cellDataJobSection.value,
                        cellDataJobId: cellDataJobId.value,
                    };
                }

                return null;
            })
            .filter(
                (value: CostCenterJobInfo | null): value is CostCenterJobInfo =>
                    value !== null
            );


        let allCostCenterIdsData = Array.from(new Set([...existingActiveCostcenterJobsInSheet]))
        console.log("allCostCenterIdsData", allCostCenterIdsData);
        if (allCostCenterIdsData.length) {
            const fetchedCostCenterData: SimproJobCostCenterTypeForAmountUpdate[] =
                await SmartsheetService.fetchCostCenterDataForGivenCostCenterIds(allCostCenterIdsData);

            const activeJobSheetInfo = await smartsheet.sheets.getSheet({ id: jobCardRoofingDetailSheetId });
            const activeJobSheetColumns = activeJobSheetInfo.columns;
            const costCenterIdColumn = activeJobSheetColumns.find(
                (col: SmartsheetColumnType) => col.title === "Cost_Center.ID"
            );

            if (!costCenterIdColumn) {
                throw new Error("Cost_Center.ID column not found in the sheet");
            }

            const costCenterIdColumnId = costCenterIdColumn.id;
            const existingRowInActiveJobsSheet: SmartsheetSheetRowsType[] = activeJobSheetInfo.rows;

            // 🔹 Collect all updates here
            let allConvertedData: any[] = [];

            for (const jobCostCenterForAmountUpdate of fetchedCostCenterData) {
                const costCenterRowDataForActiveJobsSheet = existingRowInActiveJobsSheet.find((element) => {
                    const cellData = element.cells.find(
                        (cell: { columnId: string; value: any }) => cell.columnId === costCenterIdColumnId
                    );
                    return cellData?.value === jobCostCenterForAmountUpdate.CostCenter.ID;
                });

                if (costCenterRowDataForActiveJobsSheet) {
                    const rowIdMap = {
                        [jobCostCenterForAmountUpdate.CostCenter.ID.toString()]:
                            costCenterRowDataForActiveJobsSheet.id?.toString() || "",
                    };

                    const convertedData = convertSimproCostCenterAmountUpdateToSmartsheetFormat(
                        [jobCostCenterForAmountUpdate],
                        activeJobSheetColumns,
                        rowIdMap
                    );

                    allConvertedData.push(...convertedData); // ✅ accumulate
                }
            }

            console.log("Total updates to send:", allConvertedData.length);

            // 🔹 Now send updates in chunks of 100
            const chunks = splitIntoChunks(allConvertedData, 100);
            console.log("Chunks length", chunks.length);

            for (const chunk of chunks) {
                console.log("Updating chunk of size", chunk.length);
                await smartsheet.sheets.updateRow({
                    sheetId: jobCardRoofingDetailSheetId,
                    body: chunk,
                });
            }
        }

        console.log("Amount values updated in both the sheets successfully.");
        res.status(200).json({ message: "Amount values updated in both the sheets successfully." });
    } catch (err) {
        console.log("ERror",err)
        res.status(500).json({ err: err })
    }
}
