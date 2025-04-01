import {
    ExistingScheduleType,
    SimproScheduleRowObjectType,
    SmartsheetColumnType,
    SmartsheetRowCellType,
    SmartsheetSheetRowsType,
    SimproQuotationRowObjectType,
    SimproLeadRowObjectType,
    SimproJobRoofingDetailType,
} from '../types/smartsheet.types';
import {
    SimproScheduleType,
    SimproQuotationType,
    SimproLeadType,
    SimproJobCostCenterType,

} from '../types/simpro.types';
import moment from 'moment';
import { htmlToText } from 'html-to-text';


export const convertSimproScheduleDataToSmartsheetFormatForUpdate = (
    rows: SimproScheduleType[],
    columns: SmartsheetColumnType[],
    scheduleIdRowIdMap: { [key: string]: string },
    updateType: string,
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
        let rowObj: SimproScheduleRowObjectType;
        if (updateType == "full") {
            // const ccLevelInvPercent = rows[i]?.CostCenter?.Totals?.InvoicePercentage ? rows[i]?.CostCenter?.Totals?.InvoicePercentage?.toFixed(2) : "0";
            // const jobLevelInvPercent = rows[i]?.Job?.Totals?.InvoicePercentage ? rows[i]?.Job?.Totals?.InvoicePercentage?.toFixed(2) : "0";
            const ccLevelInvPercent = Math.round(((rows[i]?.CostCenter?.Totals?.InvoicePercentage ?? 0) / 100) * 100) / 100;
            const jobLevelInvPercent = Math.round(((rows[i]?.Job?.Totals?.InvoicePercentage ?? 0) / 100) * 100) / 100;
            const ccYetToInvoice = Math.round(rows[i]?.CostCenter?.Claimed?.Remaining?.Amount?.ExTax ?? 0);
            rowObj = {
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
                "CostCenterName": rows[i].CostCenter?.Name || "",
                "CustomerEmail": rows[i].Job?.Customer?.Email || "",
                "JobName": rows[i].Job?.Name || "",
                "ProjectManager": rows[i].Job?.ProjectManager?.Name || "",
                "Zone": rows[i].Job?.CustomFields?.find(field => field?.CustomField?.Name === "Roof Zones")?.Value,
                "JobTrade": rows[i].Job?.CustomFields?.find(field => field?.CustomField?.Name === "Job Trade (ie, Plumbing, Drainage, Roofing)")?.Value,
                "Roof Double or Single": rows[i].Job?.CustomFields?.find(field => field?.CustomField?.Name === "Roofing Job Type")?.Value,
                "ScheduleNotes": rows[i].Notes ? htmlToText(rows[i].Notes || "") : '',
                "Percentage Client Invoice Claimed (From Simpro)": Math.round(((rows[i]?.CostCenter?.Claimed?.ToDate?.Percent ?? 0) / 100) * 100) / 100,
                "Suburb": rows[i]?.Job?.Site?.Address?.City || "",
                "Job level invoiced Percent": jobLevelInvPercent,
                "Costcenter level invoiced Percent": ccLevelInvPercent,
                "CC Yet to invoice": ccYetToInvoice == 0 ? "0" : ccYetToInvoice,
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
        } else if (updateType == "minimal") {
            rowObj = {
                "ScheduleID": rows[i].ID,
                "ScheduleType": rows[i].Type,
                "StaffName": rows[i].Staff?.Name,
                "ScheduleDate": rows[i].Date,
                "StartTime": startTime ? moment(startTime).format("HH:mm:ss") : "",
                "EndTime": endTime ? moment(endTime).format("HH:mm:ss") : "",
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
    }

    return convertedData;
};

export const convertSimproScheduleDataToSmartsheetFormat = (
    rows: SimproScheduleType[],
    columns: SmartsheetColumnType[],
    updateType: string,
) => {
    let convertedData: SmartsheetSheetRowsType[] = [];

    for (let i = 0; i < rows.length; i++) {
        let startTime = rows[i].Blocks.reduce(
            (minTime, block) => minTime < block.ISO8601StartTime ? minTime : block.ISO8601StartTime,
            rows[i].Blocks[0].ISO8601StartTime
        )
        let endTime = rows[i].Blocks.reduce(
            (maxTime, block) => maxTime > block.ISO8601EndTime ? maxTime : block.ISO8601EndTime,
            rows[i].Blocks[0].ISO8601EndTime)

        let rowObj: SimproScheduleRowObjectType;
        if (updateType == "full") {
            // const ccLevelInvPercent = rows[i]?.CostCenter?.Totals?.InvoicePercentage ? rows[i]?.CostCenter?.Totals?.InvoicePercentage?.toFixed(2) : "0";
            // const jobLevelInvPercent = rows[i]?.Job?.Totals?.InvoicePercentage ? rows[i]?.Job?.Totals?.InvoicePercentage?.toFixed(2) : "0";
            const ccLevelInvPercent = Math.round(((rows[i]?.CostCenter?.Totals?.InvoicePercentage ?? 0) / 100) * 100) / 100;
            const jobLevelInvPercent = Math.round(((rows[i]?.Job?.Totals?.InvoicePercentage ?? 0) / 100) * 100) / 100;
            const ccYetToInvoice = Math.round(rows[i]?.CostCenter?.Claimed?.Remaining?.Amount?.ExTax ?? 0);
            rowObj = {
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
                "CostCenterName": rows[i].CostCenter?.Name || "",
                "CustomerEmail": rows[i].Job?.Customer?.Email || "",
                "JobName": rows[i].Job?.Name || "",
                "ProjectManager": rows[i].Job?.ProjectManager?.Name || "",
                "Zone": rows[i].Job?.CustomFields?.find(field => field?.CustomField?.Name === "Roof Zones")?.Value,
                "JobTrade": rows[i].Job?.CustomFields?.find(field => field?.CustomField?.Name === "Job Trade (ie, Plumbing, Drainage, Roofing)")?.Value,
                "Roof Double or Single": rows[i].Job?.CustomFields?.find(field => field?.CustomField?.Name === "Roofing Job Type")?.Value,
                "ScheduleNotes": rows[i].Notes ? htmlToText(rows[i].Notes || "") : '',
                "Percentage Client Invoice Claimed (From Simpro)": Math.round(((rows[i]?.CostCenter?.Claimed?.ToDate?.Percent ?? 0) / 100) * 100) / 100,
                "Suburb": rows[i]?.Job?.Site?.Address?.City || "",
                "Job level invoiced Percent": jobLevelInvPercent,
                "Costcenter level invoiced Percent": ccLevelInvPercent,
                "CC Yet to invoice": ccYetToInvoice == 0 ? "0" : ccYetToInvoice,
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
        } else if (updateType == "minimal") {
            rowObj = {
                "ScheduleID": rows[i].ID,
                "ScheduleType": rows[i].Type,
                "StaffName": rows[i].Staff?.Name,
                "ScheduleDate": rows[i].Date,
                "StartTime": startTime ? moment(startTime).format("HH:mm:ss") : "",
                "EndTime": endTime ? moment(endTime).format("HH:mm:ss") : "",
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
    }
    return convertedData;
};

export const convertSimproQuotationDataToSmartsheetFormat = (
    rows: SimproQuotationType[],
    columns: SmartsheetColumnType[]
) => {
    let convertedData: SmartsheetSheetRowsType[] = [];
    for (let i = 0; i < rows.length; i++) {
        const rowObj: SimproQuotationRowObjectType = {
            "QuoteID": rows[i].ID,
            "QuoteName": rows[i].Name,
            "Status": rows[i].Status?.Name,
            "Customer": rows[i].Customer?.CompanyName ? rows[i].Customer?.CompanyName : (rows[i].Customer?.GivenName + " " + rows[i].Customer?.FamilyName),
            "Site": rows[i].Site?.Name,
            "SellPrice(IncTax)": rows[i].Total?.IncTax?.toString(),
            "SalesPerson": rows[i].Salesperson?.Name,
            "QuoteStage": rows[i].Stage,
            "Tags": rows[i].Tags.reduce(
                (accumulator, tagItem, index, array) =>
                    accumulator + tagItem.Name + (index < array.length - 1 ? ", \n" : ""),
                ""
            ),
            "CreatedDate": rows[i].DateIssued?.toString(),
            "DueDate": rows[i].DueDate?.toString(),
            "QuoteChasedBy": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "Quote chased by")?.Value)?.toString(),
            "NewQuoteOrVariation": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "New Quote or Variation")?.Value)?.toString(),
            "Priority": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "Priority")?.Value)?.toString(),
            "Lead": rows[i].ConvertedFromLead?.LeadName,
        };


        const options: SmartsheetSheetRowsType = {
            cells: (Object.keys(rowObj) as (keyof SimproQuotationRowObjectType)[]).map(columnName => {
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
}

export const convertSimproQuotationDataToSmartsheetFormatForUpdate = (
    rows: SimproQuotationType[],
    columns: SmartsheetColumnType[],
    quoteIdRowIdMap?: { [key: string]: string }
) => {
    let convertedData: SmartsheetSheetRowsType[] = [];
    for (let i = 0; i < rows.length; i++) {
        const rowObj: SimproQuotationRowObjectType = {
            "QuoteID": rows[i].ID,
            "QuoteName": rows[i].Name,
            "Status": rows[i].Status?.Name,
            "Customer": rows[i].Customer?.CompanyName ? rows[i].Customer?.CompanyName : (rows[i].Customer?.GivenName + " " + rows[i].Customer?.FamilyName),
            "Site": rows[i].Site?.Name,
            "SellPrice(IncTax)": rows[i].Total?.IncTax?.toString(),
            "SalesPerson": rows[i].Salesperson?.Name,
            "QuoteStage": rows[i].Stage,
            "Tags": rows[i].Tags.reduce(
                (accumulator, tagItem, index, array) =>
                    accumulator + tagItem.Name + (index < array.length - 1 ? ", \n" : ""),
                ""
            ),
            "CreatedDate": rows[i].DateIssued?.toString(),
            "DueDate": rows[i].DueDate?.toString(),
            "QuoteChasedBy": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "Quote chased by")?.Value)?.toString(),
            "NewQuoteOrVariation": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "New Quote or Variation")?.Value)?.toString(),
            "Priority": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "Priority")?.Value)?.toString(),
            "Lead": rows[i].ConvertedFromLead?.LeadName,
        };


        const options: SmartsheetSheetRowsType = {
            cells: (Object.keys(rowObj) as (keyof SimproQuotationRowObjectType)[]).map(columnName => {
                const column = columns.find(i => i.title === columnName);
                return {
                    columnId: column?.id || null,
                    value: rowObj[columnName] || null,
                };
            }).filter(cell => cell.columnId !== null),
        };

        if (quoteIdRowIdMap && Object.keys(quoteIdRowIdMap).length) {
            const rowId = quoteIdRowIdMap[rows[i]?.ID?.toString()];
            if (rowId) {
                options.id = parseInt(rowId, 10);
                convertedData.push(options);
            }
        }
    }

    return convertedData;
};


export const convertSimproLeadsDataToSmartsheetFormat = (rows: SimproLeadType[], columns: SmartsheetColumnType[]) => {
    let convertedData: SmartsheetSheetRowsType[] = [];
    for (let i = 0; i < rows.length; i++) {
        const rowObj: SimproLeadRowObjectType = {
            "LeadID": rows[i].ID,
            "LeadName": rows[i].Status?.Name,
            "Status": rows[i].Customer?.CompanyName ? rows[i].Customer?.CompanyName : (rows[i].Customer?.GivenName + " " + rows[i].Customer?.FamilyName),
            "CreatedDate": rows[i]?.DateCreated?.toString(),
            "FollowUpDate": rows[i]?.FollowUpDate?.toString(),
            "LatestSchedule": "",
            "SalesPerson": rows[i]?.Salesperson?.Name,
            "CustomerName": rows[i].Customer?.CompanyName ? rows[i].Customer?.CompanyName : (rows[i].Customer?.GivenName + " " + rows[i].Customer?.FamilyName),
            "SiteName": rows[i].Site?.Name,
            "DueDateBy": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "Due Date by")?.Value)?.toString(),
            "Lead": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "Lead")?.Value)?.toString(),
            "Priority": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "Priority")?.Value)?.toString(),
            "Tags": rows[i].Tags.reduce(
                (accumulator, tagItem, index, array) =>
                    accumulator + tagItem.Name + (index < array.length - 1 ? ", \n" : ""),
                ""
            ),
        };

        console.log('rowObj', rowObj)


        const options: SmartsheetSheetRowsType = {
            cells: (Object.keys(rowObj) as (keyof SimproLeadRowObjectType)[]).map(columnName => {
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
}

export const convertSimproLeadsDataToSmartsheetFormatForUpdate = (
    rows: SimproLeadType[],
    columns: SmartsheetColumnType[],
    leadIdRowIdMap?: { [key: string]: string }
) => {
    let convertedData: SmartsheetSheetRowsType[] = [];

    for (let i = 0; i < rows.length; i++) {
        const rowObj: SimproLeadRowObjectType = {
            "LeadID": rows[i].ID,
            "LeadName": rows[i].Status?.Name,
            "Status": rows[i].Customer?.CompanyName ? rows[i].Customer?.CompanyName : (rows[i].Customer?.GivenName + " " + rows[i].Customer?.FamilyName),
            "CreatedDate": rows[i]?.DateCreated?.toString(),
            "FollowUpDate": rows[i]?.FollowUpDate?.toString(),
            "LatestSchedule": "",
            "SalesPerson": rows[i]?.Salesperson?.Name,
            "CustomerName": rows[i].Customer?.CompanyName ? rows[i].Customer?.CompanyName : (rows[i].Customer?.GivenName + " " + rows[i].Customer?.FamilyName),
            "SiteName": rows[i].Site?.Name,
            "DueDateBy": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "Due Date by")?.Value)?.toString(),
            "Lead": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "Lead")?.Value)?.toString(),
            "Priority": (rows[i].CustomFields?.find(customFieldItem => customFieldItem.CustomField?.Name == "Priority")?.Value)?.toString(),
            "Tags": rows[i].Tags.reduce(
                (accumulator, tagItem, index, array) =>
                    accumulator + tagItem.Name + (index < array.length - 1 ? ", \n" : ""),
                ""
            ),
        };


        const options: SmartsheetSheetRowsType = {
            cells: (Object.keys(rowObj) as (keyof SimproLeadRowObjectType)[]).map(columnName => {
                const column = columns.find(i => i.title === columnName);
                return {
                    columnId: column?.id || null,
                    value: rowObj[columnName] || null,
                };
            }).filter(cell => cell.columnId !== null),
        };


        if (leadIdRowIdMap && Object.keys(leadIdRowIdMap).length) {
            const rowId = leadIdRowIdMap[rows[i]?.ID?.toString()];
            if (rowId) {
                options.id = parseInt(rowId, 10); // Ensure rowId is parsed as an integer
                convertedData.push(options); // Only push if rowId exists
            }
        }
    }

    return convertedData;
};

export const convertSimproRoofingDataToSmartsheetFormat = (
    rows: SimproJobCostCenterType[],
    columns: SmartsheetColumnType[],
    updateType: string,
) => {
    let convertedData: SmartsheetSheetRowsType[] = [];
    for (const row of rows) {
        let rowObj: SimproJobRoofingDetailType;
        if (updateType == "full") {
            const customerName = row.Job?.Customer?.CompanyName && row.Job?.Customer?.CompanyName.length > 0 ? row.Job?.Customer?.CompanyName : (row.Job?.Customer?.GivenName + " " + row.Job?.Customer?.FamilyName)
            const totalIncTax = row?.CostCenter?.Total?.IncTax;
            const invoicedVal = row?.CostCenter?.Totals?.InvoicedValue;
            let yetToInvoiceValue = '$'.concat((((totalIncTax != undefined && invoicedVal != undefined) ? (totalIncTax - invoicedVal) : 0) / 1.1).toFixed(2));
            rowObj = {
                JobID: row?.Job?.ID,
                Customer: customerName,
                "Job.SiteName": row?.Job?.Site?.Name,
                "Job.Name": row?.Job?.Name,
                "Job.Stage": row?.Job?.Stage,
                "Cost_Center.ID": row?.CostCenter?.ID,
                "Cost_Center.Name": row?.CostCenter?.Name,
                "Remainingamount_Ex.Tax": row?.CostCenter?.Claimed?.Remaining?.Amount?.ExTax ? `$${row?.CostCenter?.Claimed?.Remaining?.Amount?.ExTax}` : yetToInvoiceValue,
            }
            const options: SmartsheetSheetRowsType = {
                cells: (Object.keys(rowObj) as (keyof SimproJobRoofingDetailType)[]).map(columnName => {
                    const column = columns.find(i => i.title === columnName);
                    return {
                        columnId: column?.id ?? null,
                        value: rowObj[columnName] ?? null,
                    };
                }).filter(cell => cell.columnId !== null),
            };

            convertedData.push(options);
        }
    }
    return convertedData;
}
