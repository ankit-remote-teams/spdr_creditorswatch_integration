import moment from 'moment';
import { CreditorsWatchInvoiceType, InvoiceItemPaymentsType, MappingType, SimproCustomerPaymentsType, SimproInvoiceType } from '../types/types';
import { fetchSimproPaginatedData } from '../services/simproService';
import { transformInvoiceDataToCreditorsWatchArray } from '../utils/transformDataHelper';
import { calculateLatePaymentFeeAndBalanceDue } from '../utils/helper';
import { creditorsWatchPutWithRetry } from '../utils/apiUtils';
const cron = require('node-cron');
import InvoiceMappingModel from '../models/invoiceMappingModel';
import { AxiosError } from 'axios';

const defaultPercentageValueForLateFee: number = parseFloat(process.env.DEFAULT_LATE_FEE_PERCENTAGE_FOR_CUSTOMER_PER_YEAR || '0');

const handleLateFeeUpdate = async () => {
    try {
        let simproInvoiceResponseArr: SimproInvoiceType[] = await fetchSimproPaginatedData<SimproInvoiceType>('/invoices/?IsPaid=false&pageSize=100', 'ID,Customer,Status,Stage,OrderNo,Total,IsPaid,DateIssued,DatePaid,DateCreated,PaymentTerms,LatePaymentFee', '');

        if (!simproInvoiceResponseArr) {
            console.log('No invoices found to update late fee hours.');
            throw { message: 'No invoices found to update late fee hours.' }
        }

        simproInvoiceResponseArr = simproInvoiceResponseArr.filter(invoice => invoice.Stage === "Approved")

        const oldestInvoice = simproInvoiceResponseArr.reduce((oldest, current) => {
            const currentDate = moment(current.DateIssued, 'YYYY-MM-DD');
            const oldestDate = moment(oldest.DateIssued, 'YYYY-MM-DD');
            return currentDate.isBefore(oldestDate) ? current : oldest;
        });

        const formattedDate = moment(oldestInvoice.DateIssued, 'YYYY-MM-DD').format('ddd, DD MMM YYYY HH:mm:ss [GMT]');

        let simproCustomerPaymentsResponse: SimproCustomerPaymentsType[] = await fetchSimproPaginatedData('/customerPayments/?pageSize=100', 'ID,Payment,Invoices', formattedDate);

        let invoicesPaymentsData: InvoiceItemPaymentsType[] = [];
        simproCustomerPaymentsResponse.forEach(customerPayment => {
            customerPayment.Invoices.forEach(paymentInvoiceItem => {
                let individualInvoice = {
                    paymentId: customerPayment?.ID,
                    paymentDate: customerPayment?.Payment?.Date,
                    financeCharge: customerPayment?.Payment?.FinanceCharge,
                    paymentInvoiceId: paymentInvoiceItem?.Invoice.ID,
                    paymentInvoiceAmount: paymentInvoiceItem?.Amount,
                };
                invoicesPaymentsData.push(individualInvoice);
            });
        });

        invoicesPaymentsData.sort((a, b) => {
            const dateA = moment(a.paymentDate, 'YYYY-MM-DD');
            const dateB = moment(b.paymentDate, 'YYYY-MM-DD');
            return dateA.diff(dateB);
        });


        simproInvoiceResponseArr.forEach(invoiceItem => {
            const paymentItem = invoicesPaymentsData.find(payment => payment.paymentInvoiceId === invoiceItem.ID);
            if (paymentItem) {
                if (invoiceItem.InvoicePaymentInfo?.length) {
                    invoiceItem.InvoicePaymentInfo.push(paymentItem);
                } else {
                    invoiceItem.InvoicePaymentInfo = [paymentItem];
                }
            }
        });

        let creditorsWatchInvoiceDataArray: CreditorsWatchInvoiceType[] = await transformInvoiceDataToCreditorsWatchArray("Simpro", simproInvoiceResponseArr);

        for (let row of creditorsWatchInvoiceDataArray) {
            try {
                let tempRow = { ...row };
                if (tempRow.LatePaymentFee) {
                    const dueDate = moment(tempRow.due_date, 'YYYY-MM-DD');
                    let daysLate: number;
                    const currentDate = moment();
                    let dailyLateFeeRate: number;
                    daysLate = moment(currentDate).diff(dueDate, 'days');

                    if (daysLate > 0) {
                        dailyLateFeeRate = defaultPercentageValueForLateFee / 365;
                        let lateFee = calculateLatePaymentFeeAndBalanceDue(row)
                        let amount_due = (tempRow?.payments ? tempRow.payments.reduce((sub, payment) => sub - (payment.paymentInvoiceAmount + (payment?.lateFeeOnPayment || 0)), tempRow?.total_amount) : tempRow?.total_amount) + lateFee;
                        let amount_paid = tempRow?.payments ? tempRow.payments.reduce((sum, payment) => sum + (payment.paymentInvoiceAmount + (payment?.lateFeeOnPayment || 0)), 0) : 0;
                        tempRow = { ...tempRow, amount_due, amount_paid }
                    }
                }
                row = { ...tempRow }
                let creditorWatchID = row.id;
                delete row.id;
                delete row.LatePaymentFee;
                delete row.payments;

                const response = await creditorsWatchPutWithRetry(`/invoices/${creditorWatchID}`, { invoice: { ...row } });

                if (!response) {
                    console.log('Failed to update invoice late fee data after multiple attempts.');
                    continue;
                }

                let creditorWatchInvoiceData = response?.data?.invoice;

                if (!creditorWatchInvoiceData) {
                    console.log('Data unavailable to create mapping invoice.');
                    continue;
                }

                let newMapping: MappingType = {
                    simproId: creditorWatchInvoiceData.external_id,
                    creditorsWatchId: String(creditorWatchInvoiceData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await InvoiceMappingModel.create(newMapping);
                console.log('Mapping created:', savedMapping);

            } catch (error) {
                if (error instanceof AxiosError) {
                    console.log('Error syncing contact data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('Unexpected error:', error);
                    throw { message: 'Internal Server Error' }
                }
            }
        }

    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('Error syncing invoice data:', error.response?.data || error.message);
            throw { message: 'Error from Axios request', details: error.response?.data }
        } else {
            // Generic error handling
            console.log('Unexpected error:', error);
            throw { message: 'Internal Server Error' }
        }
    }
}

cron.schedule("38 10 * * *", async () => {
    console.log(`LATE FEE SCHEDULER : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    await handleLateFeeUpdate();
});
