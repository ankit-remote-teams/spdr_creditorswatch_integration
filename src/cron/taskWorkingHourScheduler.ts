import cron from 'node-cron';
const SmartsheetClient = require('smartsheet');
import moment from 'moment';
import SmartsheetTaskTrackingModel from '../models/smartsheetTaskTrackingModel';
import { SmartsheetColumnType, SmartsheetRowCellType, TaskData, TaskHourRecord } from '../types/smartsheet.types';

const smartSheetAccessToken = process.env.SMARTSHEET_ACCESS_TOKEN;
const smartsheet = SmartsheetClient.createClient({ accessToken: smartSheetAccessToken });
const sheetId = process.env.TASK_TRACKER_SHEET_ID ? process.env.TASK_TRACKER_SHEET_ID : "";
console.log("TASK HOUR SHEET : smartSheetAccessToken", smartSheetAccessToken);



// Function to get column id for column name
const getColumnIdForColumnName = async (columnName: string): Promise<number> => {
    console.log("TASK HOUR SHEET : Column name: " + columnName);
    try {
        const columns = await smartsheet.sheets.getColumns({ sheetId: sheetId });
        const rowIDColumn = columns.data.find((column: SmartsheetColumnType) => column.title === columnName);
        if (rowIDColumn) {
            return rowIDColumn.id;
        } else {
            throw new Error("TASK HOUR SHEET : Column name not found.");
        }
    } catch (err) {
        console.error('TASK HOUR SHEET : Error in getColumnIdForColumnName:', err);
        throw err;
    }
}

function calculateTimeSummaryAndTotal(task: TaskHourRecord): TaskData {
    let totalMinutes = 0;
    let summary = '';

    // Define work start and end hours for comparison
    const workStartHour = 6; // 6 AM
    const workEndHour = 18;  // 6 PM

    task?.timeIntervals?.forEach((interval) => {
        let startTime = interval.start ? new Date(interval.start) : null;
        let stopTime = interval.stop ? new Date(interval.stop) : null;

        // Proceed if both start and stop times are valid
        if (startTime && stopTime && !isNaN(startTime.getTime()) && !isNaN(stopTime.getTime())) {
            const formattedStart = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const formattedEnd = stopTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            summary += `${startTime.toLocaleDateString()}: ST_${formattedStart} - ${stopTime.toLocaleDateString()}: SP_${formattedEnd}\n`;

            let currentSegmentStart = new Date(startTime);

            // Loop through each day within the interval
            while (currentSegmentStart < stopTime) {
                // Check if the current day is a weekday (Monday to Friday)
                const dayOfWeek = currentSegmentStart.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    // If Saturday or Sunday, skip to the next day
                    currentSegmentStart.setDate(currentSegmentStart.getDate() + 1);
                    currentSegmentStart.setHours(workStartHour, 0, 0, 0);
                    continue;
                }

                const workStart = new Date(currentSegmentStart);
                workStart.setHours(workStartHour, 0, 0, 0);

                const workEnd = new Date(currentSegmentStart);
                workEnd.setHours(workEndHour, 0, 0, 0);

                // Determine the end of the current segment within the workday
                let endOfDay = new Date(Math.min(stopTime.getTime(), workEnd.getTime()));

                // Adjust start time if it's outside working hours
                if (currentSegmentStart < workStart) currentSegmentStart = workStart;

                // Calculate time only if within work hours
                if (currentSegmentStart < endOfDay) {
                    const timeDifference = (endOfDay.getTime() - currentSegmentStart.getTime()) / 1000 / 60; // in minutes
                    totalMinutes += timeDifference;
                }

                // Move to the next day segment if time remains
                currentSegmentStart = new Date(workEnd.getTime() + 60 * 60 * 1000 * 12); // Move to next day's 6 AM
            }
        }
    });

    const totalHours = Math.floor(totalMinutes / 60);
    const totalMinutesLeft = Math.floor(totalMinutes % 60);

    const totalTimeSpent = `${String(totalHours).padStart(2, '0')}:${String(totalMinutesLeft).padStart(2, '0')}`;

    return {
        summary: summary.trim(),
        totalTimeSpent,
    };
}

// Function to split an array into chunks of a specified size
function splitIntoChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

const updateRowsFromDatabase = async (): Promise<void> => {
    try {
        const sheetInfo = await smartsheet.sheets.getSheet({ id: sheetId });
        const columns = sheetInfo.columns;

        const rows = sheetInfo.rows;
        let rowsToUpdate: any[] = [];

        let recordNumberColumnId = await getColumnIdForColumnName("Record #");
        let totalHourSpentColumnId = await getColumnIdForColumnName("Total hours spent");
        let summaryOfHoursColumnId = await getColumnIdForColumnName("Summary of hours");

        let fetchedTaskData = await SmartsheetTaskTrackingModel.find({}).lean();

        for (let i = 0; i < rows.length; i++) {
            let rowData = rows[i];
            let recordNumber = rowData.cells.find((cell: SmartsheetRowCellType) => cell.columnId === recordNumberColumnId).value;
            let taskData = fetchedTaskData.find((data) => data.taskId == recordNumber);
            if (taskData) {
                let calculatedData = calculateTimeSummaryAndTotal(taskData);
                let totalHourSpentData = calculatedData.totalTimeSpent;
                let summaryOfHoursData = calculatedData.summary;
                let localRowData = {
                    id: rowData.id,
                    cells: [
                        {
                            columnId: totalHourSpentColumnId,
                            value: totalHourSpentData,
                        },
                        {
                            columnId: summaryOfHoursColumnId,
                            value: summaryOfHoursData,
                        },
                    ],
                };
                rowsToUpdate.push(localRowData);
            }
        }

        const chunks = splitIntoChunks(rowsToUpdate, 200);
        for (const chunk of chunks) {
            // Update rows in Smartsheet for the current chunk
            await smartsheet.sheets.updateRow({
                sheetId: sheetId,
                body: chunk.map((row) => ({
                    id: row.id,
                    cells: row.cells.filter((cell: { formula?: string }) => !cell.hasOwnProperty('formula')),
                })),
            });
            console.log(`TASK HOUR SHEET : Updated chunk of ${chunk.length} rows successfully.`);
        }

        console.log("TASK HOUR SHEET : Rows updated successfully");
    } catch (err) {
        console.log('TASK HOUR SHEET : err', err);
        throw err;
    }
}

const updateTaskHourInSmartSheet = async (): Promise<void> => {
    await updateRowsFromDatabase();
}

// Schedule the task using cron
cron.schedule("*/10 * * * *", async () => {
    console.log(`TASK HOUR SHEET : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    await updateTaskHourInSmartSheet();
});
