import { Request, Response } from 'express';
const SmartsheetClient = require('smartsheet');
import { Document } from 'mongoose';
import SmartsheetTaskTrackingModel from '../models/smartsheetTaskTrackingModel';
import {
    ExistingScheduleType,
    SmartsheetColumnType,
    SmartsheetRowCellType,
    SmartsheetSheetRowsType,
} from '../types/smartsheet.types';
import { ITaskHourRecord } from '../types/smartsheet.types';
import {
    SimproScheduleType,
    SimproQuotationType,
    SimproLeadType
} from '../types/simpro.types';
import { splitIntoChunks } from '../utils/helper';
import moment from 'moment';
import { AxiosError } from 'axios';
import { fetchScheduleDataForExistingScheduleIds } from './simproController';
import {
    convertSimproScheduleDataToSmartsheetFormat,
    convertSimproScheduleDataToSmartsheetFormatForUpdate,
    convertSimproQuotationDataToSmartsheetFormat,
    convertSimproLeadsDataToSmartsheetFormat,
} from '../utils/transformSimproToSmartsheetHelper';


const smartSheetAccessToken: string | undefined = process.env.SMARTSHEET_ACCESS_TOKEN;
const smartsheet = SmartsheetClient.createClient({ accessToken: smartSheetAccessToken });
const jobTrackerSheetId = process.env.TASK_TRACKER_SHEET_ID ? process.env.TASK_TRACKER_SHEET_ID : "";
const ongoingQuotationSheetId = process.env.SIMPRO_ONGOING_QUOTE_SHEET_ID ? process.env.SIMPRO_ONGOING_QUOTE_SHEET_ID : "";
const ongoingLeadsSheetId = process.env.SIMPRO_ONGOING_LEADS_SHEET_ID ? process.env.SIMPRO_ONGOING_LEADS_SHEET_ID : "";


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
    // console.log('Get column id for column name', columnName);
    try {
        const columns = await smartsheet.sheets.getColumns({ sheetId });

        // Specify the type of 'col' as 'Column' in the 'find' method callback
        const column = columns.data.find((col: SmartsheetColumnType) => col.title === columnName);

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
            if (scheduleIdToAdd.includes(row.ID)) {
                rowsToAdd.push(row);
            } else if (scheduleIdToUpdate.includes(row.ID)) {
                rowsToUpdate.push(row)
            }
        })

        if (rowsToAdd.length) {
            const rowsToAddToSmartSheet = convertSimproScheduleDataToSmartsheetFormat(rowsToAdd, columns, "full");
            if (rowsToAddToSmartSheet.length > 0) {
                console.log('Adding the rows to sheet', rowsToAddToSmartSheet.length)
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
            for (let i = 0; i < chunk.length; i++) {
                const row = chunk[i];
                for (let j = 0; j < row.cells.length; j++) {
                    const cell = row.cells[j];
                    if (cell.hasOwnProperty('formula')) {
                        row.cells.splice(j, 1);
                        j--;
                    } else {
                        if (!cell.hasOwnProperty('value')) {
                            cell.value = "";
                        }
                    }
                }
            }

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

        let quoteIdsNotPartOfSimproResponse = Array.isArray(fetchedQuoteIDs) ? existingQuoteIdsInSheet.filter(scheduleId => !fetchedQuoteIDs.includes(scheduleId)) : [];


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
                console.log('Adding the rows to sheet', rowsToAddToSmartSheet.length)
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

        // if (rowsToUpdate.length) {
        //     await updateExistingRecordsInJobCardSheet(rowsToUpdate, quoteIdsNotPartOfSimproResponse, ongoingQuotationSheetId)
        // }

        return { status: true, message: "Data added successfully" }
    } catch (err) {
        console.error('Error in adding job card data to Smartsheet:', err);
        return { status: false, message: "Error adding data to Smartsheet" }

    }
}

export const addOpenLeadsDataToSmartsheet = async (rows: SimproLeadType[]) => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: ongoingLeadsSheetId });
        const columns = sheetInfo.columns;
        let rowsToAdd: SimproLeadType[] = [];
        let rowsToUpdate: SimproLeadType[] = [];

        let fetchedQuoteIDs = rows.map(row => row.ID);

        let leadIdColumnId = await getColumnIdForColumnName("LeadID", ongoingLeadsSheetId);
        const existingRows = sheetInfo.rows;

        let existingQuoteIdsInSheet: number[] = existingRows
            .map((row: SmartsheetSheetRowsType) => {
                const cellData = row.cells.find((cellData) => cellData.columnId === leadIdColumnId);
                if (cellData) {
                    return cellData.value;
                }
                return null;
            })
            .filter((value: number | string | null) => value !== null);

        let quoteIdToUpdate = Array.isArray(existingQuoteIdsInSheet)
            ? existingQuoteIdsInSheet.filter(quoteId => fetchedQuoteIDs.includes(quoteId))
            : [];

        let quoteIdsNotPartOfSimproResponse = Array.isArray(fetchedQuoteIDs) ? existingQuoteIdsInSheet.filter(quoteId => !fetchedQuoteIDs.includes(quoteId)) : [];


        let quoteIdToAdd = Array.isArray(fetchedQuoteIDs) ? fetchedQuoteIDs.filter(quoteId => !existingQuoteIdsInSheet.includes(quoteId)) : [];


        rows.forEach((row) => {
            if (quoteIdToAdd.includes(row.ID)) {
                rowsToAdd.push(row);
            } else if (quoteIdToUpdate.includes(row.ID)) {
                rowsToUpdate.push(row)
            }
        })

        if (rowsToAdd.length) {
            const rowsToAddToSmartSheet = convertSimproLeadsDataToSmartsheetFormat(rowsToAdd, columns,);
            if (rowsToAddToSmartSheet.length > 0) {
                console.log('Adding the rows to sheet', rowsToAddToSmartSheet.length)
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

        // if (rowsToUpdate.length) {
        //     await updateExistingRecordsInJobCardSheet(rowsToUpdate, scheduleIdsNotPartOfSimproResponse, ongoingLeadsSheetId)
        // }




        return { status: true, message: "Data added successfully" }
    } catch (err) {
        console.error('Error in adding job card data to Smartsheet:', err);
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
                    console.log('Minimal : Adding the rows to sheet', rowsToAddToSmartSheet.length)
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
        console.error('Error in adding job card data to Smartsheet:', err);
        return { status: false, message: "Error adding data to Smartsheet" }

    }
}