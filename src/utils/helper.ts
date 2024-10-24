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
    const twentyFourHoursAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
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
        const currentPaymentDate = moment(payment.paymentDate, 'YYYY-MM-DD');
        const daysLate = currentPaymentDate.diff((lastPaymentDate && moment(lastPaymentDate).isAfter(dueDate)) ? lastPaymentDate : dueDate, 'days');
        if (daysLate > 0) {
            const previousLateFeeValue = latePaymentFee || 0;
            let currentLateFeeValue = totalAmountForCalculation * ((dailyLateFeeRate * daysLate) / 100);
            latePaymentFee += currentLateFeeValue;
            totalAmountForCalculation = totalAmountForCalculation - payment.paymentInvoiceAmount;
            if (latePaymentFee) {
                payment.lateFeeOnPayment = latePaymentFee - previousLateFeeValue;
            }
        }
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
