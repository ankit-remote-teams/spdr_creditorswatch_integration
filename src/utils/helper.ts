import moment from "moment";
import { CreditorsWatchInvoiceType, PaymentInfoType } from "../types/types";

const defaultPercentageValueForLateFee: number = parseFloat(process.env.DEFAULT_LATE_FEE_PERCENTAGE_FOR_CUSTOMER_PER_YEAR || '0');


export function chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

export const get48HoursAgoDate = (): string => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    return twentyFourHoursAgo.toUTCString();
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
        console.log('===============================')
        const currentPaymentDate = moment(payment.paymentDate, 'YYYY-MM-DD');
        const daysLate = currentPaymentDate.diff(lastPaymentDate ? lastPaymentDate : dueDate, 'days');
        console.log(invoice.external_id, 'daysLate : ', index, daysLate)
        if (daysLate > 0) {
            const previousLateFeeValue = latePaymentFee || 0;
            console.log(invoice.external_id, 'previousLateFreeFeeValue : ', index, previousLateFeeValue)
            console.log(invoice.external_id, 'totalAmountForCalculation : ', index, totalAmountForCalculation)
            let currentLateFeeValue = totalAmountForCalculation * ((dailyLateFeeRate * daysLate) / 100);
            console.log('currentLateFeeValue',currentLateFeeValue)
            latePaymentFee += currentLateFeeValue;
            totalAmountForCalculation = totalAmountForCalculation - payment.paymentInvoiceAmount;
            console.log(invoice.external_id, 'payment.paymentInvoiceAmount : ', index, payment.paymentInvoiceAmount)
            console.log(invoice.external_id, 'totalAMoutn For Calcaulation after : ', index, totalAmountForCalculation)
            if (latePaymentFee) {
                payment.lateFeeOnPayment = latePaymentFee - previousLateFeeValue;
            }
        }
        console.log(invoice.external_id, 'lateFee : ', index, latePaymentFee)
        lastPaymentDate = payment.paymentDate;
        ++index;
        console.log('===============================')
    }

    console.log(invoice.external_id, 'lastPaymentDate', index, lastPaymentDate)
    if (totalAmountForCalculation > 0) {
        if (!lastPaymentDate) {
            const daysSinceLastPayment = moment().diff(moment(dueDate, 'YYYY-MM-DD'), 'days');
            if (daysSinceLastPayment > 0) {
                latePaymentFee += totalAmountForCalculation * ((dailyLateFeeRate * daysSinceLastPayment) / 100);
            }
        } else {
            const daysSinceLastPayment = moment().diff(moment(lastPaymentDate, 'YYYY-MM-DD'), 'days');
            console.log(invoice.external_id, 'daysSinceLastPayment : ', index, daysSinceLastPayment)
            if (daysSinceLastPayment > 0) {
                latePaymentFee += totalAmountForCalculation * ((dailyLateFeeRate * daysSinceLastPayment) / 100);
                console.log(invoice.external_id, 'totalAmoutFor Calulation in else : ', index, totalAmountForCalculation)
                console.log(invoice.external_id, 'latePaymentFree in else : ', index, latePaymentFee)
            }
        }
    }

    return latePaymentFee;
};
