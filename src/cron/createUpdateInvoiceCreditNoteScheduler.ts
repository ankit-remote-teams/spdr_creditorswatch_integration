const cron = require('node-cron');
import { AxiosError } from 'axios';
import InvoiceMappingModel from '../models/invoiceMappingModel';
import moment from 'moment';
import { fetchSimproPaginatedData } from '../services/simproService';
import { CreditorsWatchCreditNoteType, CreditorsWatchInvoiceType, MappingType, SimproCreditNoteType, SimproInvoiceType } from '../types/types';
import { transformCreditNoteDataToCreditorsWatchArray, transformInvoiceDataToCreditorsWatchArray } from '../utils/transformDataHelper';
import { creditorsWatchPostWithRetry, creditorsWatchPutWithRetry } from '../utils/apiUtils';
import { get24HoursAgoDate } from '../utils/helper';
import ContactMappingModel from '../models/contactMappingModel';
import axiosSimPRO from '../config/axiosSimProConfig';

const defaultPercentageValueForLateFee: number = parseFloat(process.env.DEFAULT_LATE_FEE_PERCENTAGE_FOR_CUSTOMER_PER_YEAR || '0');

export const updateInvoiceData = async () => {
    try {
        const ifModifiedSinceHeader = get24HoursAgoDate();
        let simproInvoiceResponseArr: SimproInvoiceType[] = await fetchSimproPaginatedData<SimproInvoiceType>('/invoices/', 'ID,Customer,Status,Stage,OrderNo,Total,IsPaid,DateIssued,DatePaid,DateCreated,PaymentTerms,LatePaymentFee', ifModifiedSinceHeader);

        // let simproInvoiceIndividualResponse: any = await axiosSimPRO.get("/invoices/81688?columns=ID,Customer,Status,Stage,OrderNo,Total,IsPaid,DateIssued,DatePaid,DateCreated,PaymentTerms,LatePaymentFee",);
        // console.log('simproInvoiceIndividualResponse', simproInvoiceIndividualResponse.data)
        // simproInvoiceResponseArr = [simproInvoiceIndividualResponse.data]

        let creditorWatchInvoiceDataArray: CreditorsWatchInvoiceType[] = transformInvoiceDataToCreditorsWatchArray('Simpro', simproInvoiceResponseArr);

        console.log('creditorWatchInvoiceDataArray', creditorWatchInvoiceDataArray)


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
                const dueDate = moment(tempRow.due_date, 'YYYY-MM-DD');
                const total_amount = row.total_amount;
                const currentDate = moment();
                let daysLate: number;
                let dailyLateFeeRate: number;
                let lateFee: number;
                let totalWithLateFee: number;

                if (row.LatePaymentFee) {
                    if (row.paid_date != null) {
                        daysLate = moment(row.paid_date).diff(dueDate, 'days');
                    }
                    else {
                        daysLate = moment(currentDate).diff(dueDate, 'days');
                    }
                    if (daysLate > 0) {
                        dailyLateFeeRate = defaultPercentageValueForLateFee / 365;
                        lateFee = total_amount * ((dailyLateFeeRate * daysLate) / 100);
                        totalWithLateFee = total_amount + lateFee;
                        tempRow.total_amount = totalWithLateFee;
                        tempRow.amount_due = tempRow.amount_due + lateFee;
                    }
                }
                row = { ...tempRow }

                let creditorWatchID = row.id;
                delete row.id;
                delete row.LatePaymentFee;
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
                const dueDate = moment(tempRow.due_date, 'YYYY-MM-DD');
                const total_amount = row.total_amount;
                const currentDate = moment();
                let daysLate: number;
                let dailyLateFeeRate: number;
                let lateFee: number;
                let totalWithLateFee: number;

                if (tempRow.LatePaymentFee) {
                    daysLate = currentDate.diff(dueDate, 'days');
                    if (daysLate > 0) {
                        dailyLateFeeRate = defaultPercentageValueForLateFee / 365;
                        lateFee = total_amount * ((dailyLateFeeRate * daysLate) / 100);
                        totalWithLateFee = total_amount + lateFee;
                        tempRow.total_amount = totalWithLateFee;
                        tempRow.amount_due = tempRow.amount_due + lateFee;
                    }
                }
                row = { ...tempRow }

                delete row.id;
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
