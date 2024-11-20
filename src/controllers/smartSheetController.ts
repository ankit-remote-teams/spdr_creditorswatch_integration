import { Request, Response } from 'express';
const SmartsheetClient = require('smartsheet');
import { Document } from 'mongoose';
import SmartsheetTaskTrackingModel from '../models/smartsheetTaskTrackingModel';
import { ExistingScheduleType, SimproScheduleRowObjectType, SmartsheetColumnType, SmartsheetRowCellType, SmartsheetSheetRowsType } from '../types/smartsheet.types';
import { ITaskHourRecord } from '../types/smartsheet.types';
import { SimproScheduleType } from '../types/simpro.types';
import { splitIntoChunks } from '../utils/helper';
import moment from 'moment';
import { fetchedSimproSchedulesDataDump } from './jobCardData';
import { AxiosError } from 'axios';
import { fetchScheduleDataForExistingScheduleIds } from './simproController';
import { htmlToText } from 'html-to-text';


const smartSheetAccessToken: string | undefined = process.env.SMARTSHEET_ACCESS_TOKEN;
const smartsheet = SmartsheetClient.createClient({ accessToken: smartSheetAccessToken });
const jobTrackerSheetId = process.env.TASK_TRACKER_SHEET_ID ? process.env.TASK_TRACKER_SHEET_ID : "";
const jobCardReportSheetId = process.env.JOB_CARD_SHEET_ID ? process.env.JOB_CARD_SHEET_ID : "";
// const jobCardReportSheetId = 2238064088797060; // Old jobcard resport sheet id
// const jobCardReportSheetId = 5761564527251332;

console.log('jobCardReportSheetId', jobCardReportSheetId)

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
        console.log('columns', result.columns);
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
            console.log('statusCellData', statusCellData);
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

const convertSimproScheduleDataToSmartsheetFormatForUpdate = (
    rows: SimproScheduleType[],
    columns: SmartsheetColumnType[],
    scheduleIdRowIdMap?: { [key: string]: string }
) => {
    let convertedData: SmartsheetSheetRowsType[] = [];

    for (let i = 0; i < rows.length; i++) {
        let startTime = rows[i].Blocks.reduce(
            (minTime, block) => minTime < block.ISO8601StartTime ? minTime : block.ISO8601StartTime,
            rows[i].Blocks[0].ISO8601StartTime
        );
        let endTime = rows[i].Blocks.reduce(
            (maxTime, block) => maxTime > block.ISO8601EndTime ? maxTime : block.ISO8601EndTime,
            rows[i].Blocks[0].ISO8601EndTime
        );

        const rowObj: SimproScheduleRowObjectType = {
            "ScheduleID": rows[i].ID,
            "ScheduleType": rows[i].Type,
            "StaffName": rows[i].Staff?.Name,
            "ScheduleDate": rows[i].Date,
            "StartTime": startTime ? moment(startTime).format("HH:mm:ss") : "",
            "EndTime": endTime ? moment(endTime).format("HH:mm:ss") : "",
            "CustomerName": rows[i].Job?.Customer?.Type === "Company"
                ? rows[i].Job?.Customer?.CompanyName
                : `${rows[i].Job?.Customer?.GivenName} ${rows[i].Job?.Customer?.FamilyName}`,
            "CustomerPhone": rows[i]?.Job?.Customer?.Phone,
            "JobID": rows[i].Job?.ID,
            "SiteID": rows[i].Job?.Site?.ID,
            "SiteName": rows[i].Job?.Site?.Name,
            "SiteContact": rows[i].Job?.SiteContact?.CompanyName
                ? rows[i].Job?.SiteContact?.CompanyName
                : rows[i].Job?.SiteContact?.GivenName
                    ? `${rows[i].Job?.SiteContact?.GivenName} ${rows[i]?.Job?.SiteContact?.FamilyName}`
                    : rows[i].Job?.Customer?.Type === "Company"
                        ? rows[i].Job?.Customer?.CompanyName
                        : `${rows[i].Job?.Customer?.GivenName} ${rows[i].Job?.Customer?.FamilyName}`,
            "CostCenterName": rows[i].CostCenter?.[0]?.Name || "",
            "CustomerEmail": rows[i].Job?.Customer?.Email || "",
            "JobName": rows[i].Job?.Name || "",
            "ProjectManager": rows[i].Job?.ProjectManager?.Name || "",
            "Zone": rows[i].Job?.CustomFields?.find(field => field?.CustomField?.Name === "Zone (ie, North/East, West)")?.Value,
            "JobTrade": rows[i].Job?.CustomFields?.find(field => field?.CustomField?.Name === "Job Trade (ie, Plumbing, Drainage, Roofing)")?.Value,
            "ScheduleNotes": rows[i].Notes ? htmlToText(rows[i].Notes || "") : ''
        };

        const options: SmartsheetSheetRowsType = {
            cells: (Object.keys(rowObj) as (keyof SimproScheduleRowObjectType)[]).map(columnName => {
                const column = columns.find(i => i.title === columnName);
                return {
                    columnId: column?.id || null,
                    value: rowObj[columnName] || null,
                };
            }).filter(cell => cell.columnId !== null),
        };

        if (scheduleIdRowIdMap && Object.keys(scheduleIdRowIdMap).length) {
            const rowId = scheduleIdRowIdMap[rows[i]?.ID?.toString()];
            if (rowId) {
                options.id = parseInt(rowId, 10); // Ensure rowId is parsed as an integer
                convertedData.push(options); // Only push if rowId exists
            }
        }
    }

    return convertedData;
};


const convertSimproScheduleDataToSmartsheetFormat = (rows: SimproScheduleType[], columns: SmartsheetColumnType[]) => {
    let convertedData: SmartsheetSheetRowsType[] = [];

    for (let i = 0; i < rows.length; i++) {
        let startTime = rows[i].Blocks.reduce(
            (minTime, block) => minTime < block.ISO8601StartTime ? minTime : block.ISO8601StartTime,
            rows[i].Blocks[0].ISO8601StartTime
        )
        let endTime = rows[i].Blocks.reduce(
            (maxTime, block) => maxTime > block.ISO8601EndTime ? maxTime : block.ISO8601EndTime,
            rows[i].Blocks[0].ISO8601EndTime)

        const rowObj: SimproScheduleRowObjectType = {
            "ScheduleID": rows[i].ID,
            "ScheduleType": rows[i].Type,
            "StaffName": rows[i].Staff?.Name,
            "ScheduleDate": rows[i].Date,
            "StartTime": startTime ? moment(startTime).format("HH:mm:ss") : "",
            "EndTime": endTime ? moment(endTime).format("HH:mm:ss") : "",
            "CustomerName": rows[i].Job?.Customer?.Type === "Company" ? rows[i].Job?.Customer?.CompanyName : (rows[i].Job?.Customer?.GivenName + " " + rows[i].Job?.Customer?.FamilyName),
            "CustomerPhone": rows[i]?.Job?.Customer?.Phone,
            "JobID": rows[i].Job?.ID,
            "SiteID": rows[i].Job?.Site?.ID,
            "SiteName": rows[i].Job?.Site?.Name,
            "SiteContact": rows[i].Job?.SiteContact?.CompanyName
                ? rows[i].Job?.SiteContact?.CompanyName
                : rows[i].Job?.SiteContact?.GivenName
                    ? `${rows[i].Job?.SiteContact?.GivenName} ${rows[i]?.Job?.SiteContact?.FamilyName}`
                    : (rows[i].Job?.Customer?.Type === "Company"
                        ? rows[i].Job?.Customer?.CompanyName
                        : `${rows[i].Job?.Customer?.GivenName} ${rows[i].Job?.Customer?.FamilyName}`),
            "CostCenterName": rows[i].CostCenter?.[0]?.Name || "",
            "CustomerEmail": rows[i].Job?.Customer?.Email || "",
            "JobName": rows[i].Job?.Name || "",
            "ProjectManager": rows[i].Job?.ProjectManager?.Name || "",
            "Zone": rows[i].Job?.CustomFields?.find(field => field?.CustomField?.Name === "Zone (ie, North/East, West)")?.Value,
            "JobTrade": rows[i].Job?.CustomFields?.find(field => field?.CustomField?.Name === "Job Trade (ie, Plumbing, Drainage, Roofing)")?.Value,
            "ScheduleNotes": rows[i].Notes ? htmlToText(rows[i].Notes || "") : ''
        };


        const options: SmartsheetSheetRowsType = {
            cells: (Object.keys(rowObj) as (keyof SimproScheduleRowObjectType)[]).map(columnName => {
                const column = columns.find(i => i.title === columnName);
                return {
                    columnId: column?.id || null,
                    value: rowObj[columnName] || null,
                };
            }).filter(cell => cell.columnId !== null),
        };

        convertedData.push(options);
    }

    return convertedData;
};



export const addJobCardDataToSmartsheet = async (rows: SimproScheduleType[]) => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardReportSheetId });
        const columns = sheetInfo.columns;
        let rowsToAdd: SimproScheduleType[] = [];
        let rowsToUpdate: SimproScheduleType[] = [];

        let fetchedScheduleIDs = rows.map(row => row.ID);

        let scheduleIdColumnId = await getColumnIdForColumnName("ScheduleID", jobCardReportSheetId.toString());
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
            const rowsToAddToSmartSheet = convertSimproScheduleDataToSmartsheetFormat(rowsToAdd, columns);
            if (rowsToAddToSmartSheet.length > 0) {
                console.log('Adding the rows to sheet', rowsToAddToSmartSheet.length)
                const chunks = splitIntoChunks(rowsToAddToSmartSheet, 100);

                for (const chunk of chunks) {
                    try {
                        await smartsheet.sheets.addRows({
                            sheetId: jobCardReportSheetId,
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
            await updateExistingRecordsInJobCardSheet(rowsToUpdate, scheduleIdsNotPartOfSimproResponse)
        }




        return { status: true, message: "Data added successfully" }
    } catch (err) {
        console.error('Error in adding job card data to Smartsheet:', err);
        return { status: false, message: "Error adding data to Smartsheet" }

    }
}

const addDeleteCommentInChunks = async (rowIds: number[]) => {
    try {
        // console.log("Row IDs to update with comments: ", rowIds);

        // Get column ID for the 'ScheduleComment' column
        const columnIdForScheduleComment = await getColumnIdForColumnName('ScheduleComment', jobCardReportSheetId.toString());
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
                sheetId: jobCardReportSheetId,
                body: rowsToUpdate,
            });

            console.log('JOb CArd: Updated chunk with', chunk.length, 'rows');
        }
    } catch (err) {
        if (err instanceof AxiosError) {
            console.error("Error in addDeleteCommentInChunks as AxiosError");
            console.error("Error details:", err.response?.data);
        } else {
            console.error("Error in addDeleteCommentInChunks as other error");
            console.error("Error details:", err);
        }
    }
};

const updateTheSimproSchedulesData = async (updatedSimproData: SimproScheduleType[], columns: SmartsheetColumnType[], existingScheduleIdsData: ExistingScheduleType[]) => {
    try {
        let simproIdRowIdMap: { [key: string]: string } = {};

        updatedSimproData.forEach(simproScheduleItem => {
            const matchingSchedule = existingScheduleIdsData.find(scheduleData => scheduleData.scheduleId === simproScheduleItem.ID);
            if (matchingSchedule) {
                simproIdRowIdMap[simproScheduleItem.ID.toString()] = matchingSchedule.rowId.toString();
            }
        });


        let rowsToUpdateToSmartSheet = convertSimproScheduleDataToSmartsheetFormatForUpdate(updatedSimproData, columns, simproIdRowIdMap);

        const chunks = splitIntoChunks(rowsToUpdateToSmartSheet, 100);
        for (const chunk of chunks) {
            for (let i = 0; i < chunk.length; i++) {
                const row = chunk[i];
                for (let j = 0; j < row.cells.length; j++) {
                    const cell = row.cells[j];
                    // Check if the cell has a formula property
                    if (cell.hasOwnProperty('formula')) {
                        // If it has a formula property, remove the cell
                        row.cells.splice(j, 1);
                        // Decrement j to handle the removal of the cell
                        j--;
                    } else {
                        // Check if the cell has a value property
                        if (!cell.hasOwnProperty('value')) {
                            // If it doesn't have a value property, add an empty string value
                            cell.value = "";
                        }
                    }
                }
            }

            await smartsheet.sheets.updateRow({
                sheetId: jobCardReportSheetId,
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

export const updateExistingRecordsInJobCardSheet = async (rowsToUpdate: SimproScheduleType[], scheduleIdsNotPartOfSimproResponse: number[]) => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: jobCardReportSheetId });
        let scheduleIdColumnId = await getColumnIdForColumnName("ScheduleID", jobCardReportSheetId.toString());

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
        const fetchedScheduleDataForExistingData = await fetchScheduleDataForExistingScheduleIds(scheduleIdsNotPartOfSimproResponse);
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
            await addDeleteCommentInChunks(rowsToMarkDeleted.map(row => Number(row.rowId)));
        }

        if (updatedSimproData.length) {
            console.log("Update the ", updatedSimproData.length, "row fetched from simpro")
            await updateTheSimproSchedulesData(updatedSimproData, columns, existingScheduleIdsData);
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