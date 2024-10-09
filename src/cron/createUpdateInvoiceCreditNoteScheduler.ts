const cron = require('node-cron');
import { AxiosError } from 'axios';
import InvoiceMappingModel from '../models/invoiceMappingModel';
import moment from 'moment';
import { fetchSimproPaginatedData } from '../services/simproService';
import { CreditorsWatchCreditNoteType, CreditorsWatchInvoiceType, InvoiceItemPaymentsType, MappingType, SimproCreditNoteType, SimproCustomerPaymentsType, SimproInvoiceType } from '../types/types';
import { transformCreditNoteDataToCreditorsWatchArray, transformInvoiceDataToCreditorsWatchArray } from '../utils/transformDataHelper';
import { creditorsWatchPostWithRetry, creditorsWatchPutWithRetry } from '../utils/apiUtils';
import { calculateLatePaymentFeeAndBalanceDue, get24HoursAgoDate } from '../utils/helper';
import ContactMappingModel from '../models/contactMappingModel';

const defaultPercentageValueForLateFee: number = parseFloat(process.env.DEFAULT_LATE_FEE_PERCENTAGE_FOR_CUSTOMER_PER_YEAR || '0');

export const updateInvoiceData = async () => {
    try {
        const ifModifiedSinceHeader = get24HoursAgoDate();
        let simproInvoiceResponseArr: SimproInvoiceType[] = await fetchSimproPaginatedData<SimproInvoiceType>('/invoices/', 'ID,Customer,Status,Stage,OrderNo,Total,IsPaid,DateIssued,DatePaid,DateCreated,PaymentTerms,LatePaymentFee', ifModifiedSinceHeader);

        const oldestInvoice = simproInvoiceResponseArr.reduce((oldest, current) => {
            const currentDate = moment(current.DateIssued, 'YYYY-MM-DD');
            const oldestDate = moment(oldest.DateIssued, 'YYYY-MM-DD');
            return currentDate.isBefore(oldestDate) ? current : oldest;
        });

        const formattedDate = moment(oldestInvoice.DateIssued, 'YYYY-MM-DD').format('ddd, DD MMM YYYY HH:mm:ss [GMT]');


        let simproCustomerPaymentsResponse: SimproCustomerPaymentsType[] = await fetchSimproPaginatedData('/customerPayments/', 'ID,Payment,Invoices', formattedDate);

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

        // Sort invoicesPaymentsData by paymentDate (oldest to latest)
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



        let creditorWatchInvoiceDataArray: CreditorsWatchInvoiceType[] = transformInvoiceDataToCreditorsWatchArray('Simpro', simproInvoiceResponseArr);

        let simproIdToFetchFromMapping: string[] = [];
        simproInvoiceResponseArr.forEach(item => simproIdToFetchFromMapping.push(item.ID.toString()))

        const mappingData = await InvoiceMappingModel.find({ simproId: { $in: simproIdToFetchFromMapping } });

        if (mappingData.length) {
            let simproCWIDMap: { [key: string]: string } = {};
            mappingData.forEach(item => simproCWIDMap[item.simproId] = item.creditorsWatchId)
            creditorWatchInvoiceDataArray.forEach(item => item.id = parseInt(simproCWIDMap[item.external_id]))
        }

        let dataToUpdate: CreditorsWatchInvoiceType[] = [];
        let dataToAdd: CreditorsWatchInvoiceType[] = [];

        creditorWatchInvoiceDataArray.forEach(item => {
            if (item.id) {
                dataToUpdate.push(item);
            } else {
                dataToAdd.push(item);
            }
        })

        //Code to update exiting data.
        for (let row of dataToUpdate) {
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
                        let amount_due = - (tempRow?.payments ? tempRow.payments.reduce((sub, payment) => sub - (payment.paymentInvoiceAmount + (payment?.lateFeeOnPayment || 0)), tempRow?.total_amount) : tempRow?.total_amount) + lateFee;
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
                    console.error('Failed to update invoice data after multiple attempts.');
                    continue;
                }


            } catch (error) {
                if (error instanceof AxiosError) {
                    console.error('Error syncing invoice data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.error('Unexpected error:', error);
                    throw { message: 'Internal Server Error' }
                }
            }
        }

        //Code to update add data.
        for (let row of dataToAdd) {
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
                        let amount_due = - (tempRow?.payments ? tempRow.payments.reduce((sub, payment) => sub - (payment.paymentInvoiceAmount + (payment?.lateFeeOnPayment || 0)), tempRow?.total_amount) : tempRow?.total_amount) + lateFee;
                        let amount_paid = tempRow?.payments ? tempRow.payments.reduce((sum, payment) => sum + (payment.paymentInvoiceAmount + (payment?.lateFeeOnPayment || 0)), 0) : 0;
                        tempRow = { ...tempRow, amount_due, amount_paid }
                    }
                }
                row = { ...tempRow }

                delete row.id;
                delete row.LatePaymentFee;
                delete row.payments;

                const response = await creditorsWatchPostWithRetry(`/invoices`, { invoice: { ...row } });
                if (!response) {
                    console.error('Failed to add invoice data after multiple attempts.');
                    continue;
                }

                let creditorWatchContactData = response?.data?.invoice;
                if (!creditorWatchContactData) {
                    console.error('Data unavailable to create mapping invoice.');
                    continue;
                }


                let newMapping: MappingType = {
                    simproId: creditorWatchContactData.external_id,
                    creditorsWatchId: String(creditorWatchContactData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await InvoiceMappingModel.create(newMapping);
                console.log('Mapping created:', savedMapping);

            } catch (error) {
                if (error instanceof AxiosError) {
                    console.error('Error syncing invoice data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.error('Unexpected error:', error);
                    throw { message: 'Internal Server Error' }
                }
            }
        }

        await updateCreditNoteData(simproInvoiceResponseArr);


    } catch (error: any) {
        if (error instanceof AxiosError) {
            console.error('Error syncing invoice data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.error('Unexpected error:', error);
            throw { message: error?.message }
        }
    }
}

const updateCreditNoteData = async (simproInvoiceResponseArr: SimproInvoiceType[]) => {
    try {
        const ifModifiedSinceHeader = get24HoursAgoDate();
        let simproCreditNoteResponseArr: SimproCreditNoteType[] = await fetchSimproPaginatedData<SimproCreditNoteType>('/creditNotes/', 'ID,Type,Customer,DateIssued,Stage,Total,InvoiceNo', ifModifiedSinceHeader);

        if (!simproCreditNoteResponseArr) {
            console.error('No credit notes found to sync.');
            return [];
        }

        simproCreditNoteResponseArr.forEach(item => {
            item.InvoiceData = simproInvoiceResponseArr.find(invoice => invoice.ID === item.InvoiceNo);
        })
        simproCreditNoteResponseArr = simproCreditNoteResponseArr.filter(item => item.InvoiceData)

        let creditorsWatchCreditNoteDataArray: CreditorsWatchCreditNoteType[] = transformCreditNoteDataToCreditorsWatchArray("Simpro", simproCreditNoteResponseArr);


        let simproIdToFetchFromMapping: string[] = [];
        simproInvoiceResponseArr.forEach(item => simproIdToFetchFromMapping.push(item.ID.toString()))

        const mappingData = await ContactMappingModel.find({ simproId: { $in: simproIdToFetchFromMapping } });

        if (mappingData.length) {
            let simproCWIDMap: { [key: string]: string } = {};
            mappingData.forEach(item => simproCWIDMap[item.simproId] = item.creditorsWatchId)
            creditorsWatchCreditNoteDataArray.forEach(item => item.id = parseInt(simproCWIDMap[item.external_id]))
        }

        let dataToUpdate: CreditorsWatchCreditNoteType[] = [];
        let dataToAdd: CreditorsWatchCreditNoteType[] = [];
        creditorsWatchCreditNoteDataArray.forEach(item => {
            if (item.id) {
                dataToUpdate.push(item);
            } else {
                dataToAdd.push(item);
            }
        })

        //Code to update exiting data.
        for (const row of dataToUpdate) {
            try {
                console.log("Row that are updated : ", row)
                let creditorWatchID = row.id;
                delete row.id;
                const response = await creditorsWatchPutWithRetry(`/credit_notes/${creditorWatchID}`, { credit_note: { ...row } });
                if (!response) {
                    console.error('Failed to update credit note data after multiple attempts.');
                    continue;
                }
            } catch (error) {
                if (error instanceof AxiosError) {
                    console.error('Error syncing credit note data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.error('Unexpected error:', error);
                    throw { message: 'Internal Server Error' }
                }
            }
        }

        //Code to update add data.
        for (const row of dataToAdd) {
            try {
                console.log("Row that are added : ", row)
                delete row.id;
                const response = await creditorsWatchPostWithRetry(`/credit_notes`, { credit_note: { ...row } });
                if (!response) {
                    console.error('Failed to add credit note data after multiple attempts.');
                    continue;
                }

                let creditorWatchContactData = response?.data?.credit_note;
                if (!creditorWatchContactData) {
                    console.error('Data unavailable to create mapping credit note.');
                    continue;
                }


                let newMapping: MappingType = {
                    simproId: creditorWatchContactData.external_id,
                    creditorsWatchId: String(creditorWatchContactData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await ContactMappingModel.create(newMapping);
                console.log('Mapping created:', savedMapping);

            } catch (error) {
                if (error instanceof AxiosError) {
                    console.error('Error syncing credit note data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.error('Unexpected error:', error);
                    throw { message: 'Internal Server Error' }
                }
            }
        }


    } catch (error: any) {
        if (error instanceof AxiosError) {
            console.error('Error syncing creditnote data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.error('Unexpected error:', error);
            throw { message: error?.message }
        }
    }
}
console.log(moment(Date.now()).format("DD MMM YYYY HH:mm:ss"))
cron.schedule("28 17 * * *", async () => {
    console.log(`INVOICE SCHEDULER: Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    await updateInvoiceData();
});
