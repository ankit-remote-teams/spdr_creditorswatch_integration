import { Document } from 'mongoose';

export type SmartsheetRowCellType = {
    columnId: number;
    value: string;
};

export type SmartsheetSheetRowsType = {
    cells: SmartsheetCellType[];
    id?: number;
};

export type SmartsheetColumnType = {
    id: number;
    version?: number;
    index?: number;
    title: string;
    type?: string;
    options?: string[];
    locked?: boolean;
    lockedForUser?: boolean;
    validation?: boolean;
    width?: number;
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

export type SimproScheduleRowObjectType = {
    ScheduleID: string | number | undefined;
    ScheduleType: string | undefined;
    StaffName: string | undefined;
    ScheduleDate: string | Date | undefined;
    StartTime: string | undefined;
    EndTime: string | undefined;
    CustomerName: string | undefined;
    JobID: string | number | undefined;
    SiteID: string | number | undefined;
    SiteName: string | undefined;
    SiteContact: string | undefined;
    CostCenterName: string | undefined;
    CustomerPhone: string | undefined;
    CustomerEmail: string | undefined;
    JobName: string | undefined;
    ProjectManager: string | undefined;
    Zone: string | number | null | undefined;
    JobTrade: string | number | null | undefined;
    ScheduleNotes: string | null | undefined;
}


declare module 'smartsheet' {
    const smartsheet: any;
    export = smartsheet;
}

export type ExistingScheduleType = {
    scheduleId: number | string;
    rowId: number | string;
}