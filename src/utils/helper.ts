import moment from "moment";
import { CreditorsWatchInvoiceType, PaymentInfoType } from "../types/creditorswatch.types";
import {
    SimproContractorJobType,
    SimproCostCenterType,
    SimproLineItemType,
} from "../types/simpro.types";
import { SimproContractorWorkOrderType } from "../types/smartsheet.types";

const defaultPercentageValueForLateFee: number = parseFloat(process.env.DEFAULT_LATE_FEE_PERCENTAGE_FOR_CUSTOMER_PER_YEAR || '0');


export function chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

export const get30HoursAgo = (): string => {
    const now = new Date();
    const fortyFiveDaysAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000);
    return fortyFiveDaysAgo.toUTCString();
};


export const getHoursAgo = (hours: number): string => {
  const now = new Date();
  const pastTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return pastTime.toUTCString();
};



export const calculateLatePaymentFeeAndBalanceDue = (
    invoice: CreditorsWatchInvoiceType,
): number => {
    const dueDate = moment(invoice.due_date, 'YYYY-MM-DD');
    const total_amount = invoice.total_amount;
    let paymentsInfo: PaymentInfoType[] = invoice.payments || [];
    const dailyLateFeeRate: number = defaultPercentageValueForLateFee / 365;
    let latePaymentFee: number = 0;
    let lastPaymentDate: string = '';
    let totalAmountForCalculation: number = total_amount;

    let index = 1;
    for (let payment of paymentsInfo) {
        const currentPaymentDate = moment(payment.paymentDate, 'YYYY-MM-DD');
        const daysLate = currentPaymentDate.diff((lastPaymentDate && moment(lastPaymentDate).isAfter(dueDate)) ? lastPaymentDate : dueDate, 'days');
        if (daysLate > 0) {
            const previousLateFeeValue = latePaymentFee || 0;
            let currentLateFeeValue = totalAmountForCalculation * ((dailyLateFeeRate * daysLate) / 100);
            latePaymentFee += currentLateFeeValue;
            if (latePaymentFee) {
                payment.lateFeeOnPayment = latePaymentFee - previousLateFeeValue;
            }
        }
        totalAmountForCalculation = totalAmountForCalculation - payment.paymentInvoiceAmount;
        lastPaymentDate = payment.paymentDate;
        ++index;
    }

    if (totalAmountForCalculation > 0) {
        if (!lastPaymentDate) {
            const daysSinceLastPayment = moment().diff(
                moment((lastPaymentDate && moment(lastPaymentDate).isAfter(dueDate)) ? lastPaymentDate : dueDate),
                'days'
            );
            if (daysSinceLastPayment > 0) {
                latePaymentFee += totalAmountForCalculation * ((dailyLateFeeRate * daysSinceLastPayment) / 100);
            }
        } else {

            const daysSinceLastPayment = moment().diff(
                moment((lastPaymentDate && moment(lastPaymentDate).isAfter(dueDate)) ? lastPaymentDate : dueDate),
                'days'
            );

            if (daysSinceLastPayment > 0) {
                latePaymentFee += totalAmountForCalculation * ((dailyLateFeeRate * daysSinceLastPayment) / 100);
            }
        }
    }

    return latePaymentFee;
};


export const splitIntoChunks = <T>(array: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
};



export const extractLineItemsDataFromContractorJob = ({
    jobID,
    contractorJob,
    costCenterData,
    contractorName
}: {
    jobID: string | number;
    contractorJob: SimproContractorJobType;
    costCenterData: SimproCostCenterType;
    contractorName?: string;
}): SimproContractorWorkOrderType[] => {

    let resultArray: SimproContractorWorkOrderType[] = [];

    if (contractorJob && contractorJob.Items && Array.isArray(contractorJob.Items?.Catalogs)) {
        for (let item of contractorJob.Items?.Catalogs) {
            let lineItem: SimproLineItemType = item;
            let convertedObj: SimproContractorWorkOrderType = {
                JobID: jobID,
                SiteName: costCenterData?.Site?.Name || '',
                CostCenterID: costCenterData?.ID || '',
                CostCenterName: costCenterData?.Name || '',
                WorkOrderID: contractorJob.ID,
                ContractorName: contractorName || '',
                ContractorJobStatus: contractorJob.Status || '',
                ContractorJobTotal: contractorJob.Total?.IncTax || 0,
                DateIssued: contractorJob.DateIssued || '',
                LineItemType: 'Catalogs',
                LineItemID: lineItem?.ID || '',
                LineItemName: lineItem?.Catalog?.Name,
                LineItemQty: lineItem?.Qty?.Assigned || 0,
                LineItemAmount: ((lineItem?.Qty?.Assigned || 0) * ((lineItem?.Price?.Labor || 0 + lineItem?.Price?.Material || 0))),
            };

            const qty = Number(convertedObj.LineItemQty);
            if (!isNaN(qty) && qty > 0) {
                resultArray.push(convertedObj);
            }
        }
    }

    if (contractorJob && contractorJob.Items && Array.isArray(contractorJob.Items?.Prebuilds)) {
        for (let item of contractorJob.Items?.Prebuilds) {
            let lineItem: SimproLineItemType = item;
            // console.log('lineItem', lineItem)
            let convertedObj: SimproContractorWorkOrderType = {
                JobID: jobID,
                SiteName: costCenterData?.Site?.Name || '',
                CostCenterID: costCenterData?.ID || '',
                CostCenterName: costCenterData?.Name || '',
                WorkOrderID: contractorJob.ID,
                ContractorName: contractorName || '',
                ContractorJobStatus: contractorJob.Status || '',
                ContractorJobTotal: contractorJob.Total?.IncTax || 0,
                DateIssued: contractorJob.DateIssued || '',
                LineItemType: 'Prebuilds',
                LineItemID: lineItem?.ID || '',
                LineItemName: lineItem?.Prebuild?.Name,
                LineItemQty: lineItem?.Qty?.Assigned || 0,
                LineItemAmount: ((lineItem?.Qty?.Assigned || 0) * ((lineItem?.Price?.Labor || 0 + lineItem?.Price?.Material || 0))),
            };

            const qty = Number(convertedObj.LineItemQty);
            if (!isNaN(qty) && qty > 0) {
                resultArray.push(convertedObj);
            }
        }
    }

    return resultArray;
}

