import { Document } from 'mongoose';

export type SmartsheetRowCellType = {
    columnId: number;
    value: string;
};

export type SmartsheetColumnType = {
    id: number;
    title: string;
};


// Define the TimeInterval type
export type TimeInterval = {
    start?: Date;
    stop?: Date;
};


export type TaskHourRecord = {
    taskId: string;
    timeIntervals: TimeInterval[];
    createdAt: Date;
    __v?: number;
};

export type TaskData = {
    summary: string;
    totalTimeSpent: string;
};

// Define the ITaskHourRecord type extending Document (to work with Mongoose models)
export type ITaskHourRecord = Document & {
    taskId: string;
    timeIntervals: TimeInterval[];
    createdAt: Date;
    addStartTime(startTime: Date): Promise<ITaskHourRecord>;
    addStopTime(stopTime: Date): Promise<ITaskHourRecord | void>;
    _id?: string;
};


declare module 'smartsheet' {
    const smartsheet: any;
    export = smartsheet;
}