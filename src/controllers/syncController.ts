import { Request, Response } from 'express-serve-static-core';
import { AxiosError } from 'axios';
import { CreditorsWatchContactType, CreditorsWatchCreditNoteType, CreditorsWatchInvoiceType, MappingType, SimproCompanyType, SimproCreditNoteType, SimproInvoiceType } from '../types/types';
import { fetchSimproPaginatedData } from '../services/simproService';
import { transformContactDataToCreditorsWatchArray, transformCreditNoteDataToCreditorsWatchArray, transformInvoiceDataToCreditorsWatchArray } from '../utils/transformDataHelper';
import ContactMappingModel from '../models/contactMappingModel';
import { creditorsWatchPostWithRetry } from '../utils/apiUtils';
import InvoiceMappingModel from '../models/invoiceMappingModel';
import CreditNoteMappingModel from '../models/creditNotesMappingModel';
import moment from 'moment';

const defaultPercentageValueForLateFee: number = parseFloat(process.env.DEFAULT_PERCENTAGE_FOR_LATE_FEE || '0');


// Controller to handle syncing contact data
export const syncInitialSimproContactData = async (req: Request, res: Response): Promise<void> => {
    try {
        let simproCustomerResponseArr: SimproCompanyType[] = await fetchSimproPaginatedData<SimproCompanyType>('/customers/companies/?Archived=false', "ID,CompanyName,Email,Archived,EIN,Phone,AltPhone", "")

        // Transform data to CreditorsWatch format and chunk it
        let creditorWatchContactDataArray: CreditorsWatchContactType[] = transformContactDataToCreditorsWatchArray('Simpro', simproCustomerResponseArr);
        for (const row of creditorWatchContactDataArray) {
            try {
                const response = await creditorsWatchPostWithRetry('/contacts', { contact: { ...row } });
                if (!response) {
                    console.error('Failed to sync contact data after multiple attempts.');
                    continue;
                }

                let creditorWatchContactData = response?.data?.contact;
                if (!creditorWatchContactData) {
                    console.error('Data unavailable to create mapping.');
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
                    console.error('Error syncing contact data:', error.response?.data || error.message);
                    res.status(500).json({ message: 'Error from Axios request', details: error.response?.data });
                } else {
                    console.error('Unexpected error:', error);
                    res.status(500).json({ message: 'Internal Server Error' });
                }
            }
        }

        res.status(200).json({ message: "Synced data successfully", data: creditorWatchContactDataArray })
    } catch (error) {
        if (error instanceof AxiosError) {
            console.error('Error syncing contact data:', error.response?.data || error.message);
            res.status(500).json({ message: 'Error from Axios request', details: error.response?.data });
        } else {
            // Generic error handling
            console.error('Unexpected error:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}


export const syncInitialInvoiceCreditNoteData = async (req: Request, res: Response): Promise<void> => {
    try {
        let simproInvoiceResponseArr: SimproInvoiceType[] = await fetchSimproPaginatedData<SimproInvoiceType>('/invoices/?IsPaid=false', 'ID,Customer,Status,Stage,OrderNo,Total,IsPaid,DateIssued,DatePaid,DateCreated,PaymentTerms', '');
        if (!simproInvoiceResponseArr) {
            console.error('No invoices found to sync.');
            res.status(200).json({ message: 'No invoices found to sync.' });
            return;
        }


        let creditorsWatchInvoiceDataArray: CreditorsWatchInvoiceType[] = await transformInvoiceDataToCreditorsWatchArray("Simpro", simproInvoiceResponseArr);

        for (let row of creditorsWatchInvoiceDataArray) {
            try {
                let tempRow = { ...row };
                const dueDate = moment(tempRow.due_date, 'YYYY-MM-DD');
                const total_amount = row.total_amount;
                const currentDate = moment();

                if (currentDate.isAfter(dueDate)) {
                    const daysLate = currentDate.diff(dueDate, 'days');
                    const dailyLateFeeRate = (defaultPercentageValueForLateFee / 100) / 365;
                    const lateFee = total_amount * dailyLateFeeRate * daysLate;
                    const totalWithLateFee = total_amount + lateFee;
                    tempRow.total_amount = totalWithLateFee;
                }
                row = { ...tempRow }

                const response = await creditorsWatchPostWithRetry('/invoices', { invoice: { ...row } });
                if (!response) {
                    console.error('Failed to sync invoice data after multiple attempts.');
                    continue;
                }

                console.log('response from creditors watch post invoice', response)

                let creditorWatchInvoiceData = response?.data?.invoice;
                if (!creditorWatchInvoiceData) {
                    console.error('Data unavailable to create mapping.');
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
                    console.error('Error syncing contact data:', error.response?.data || error.message);
                    res.status(500).json({ message: 'Error from Axios request', details: error.response?.data });
                } else {
                    console.error('Unexpected error:', error);
                    res.status(500).json({ message: 'Internal Server Error' });
                }
            }
        }

        await syncInitialCreditNoteData(simproInvoiceResponseArr)

        res.status(200).json({ message: "Synced data successfully", data: simproInvoiceResponseArr })
    } catch (error) {
        if (error instanceof AxiosError) {
            console.error('Error syncing invoice data:', error.response?.data || error.message);
            res.status(500).json({ message: 'Error from Axios request', details: error.response?.data });
        } else {
            // Generic error handling
            console.error('Unexpected error:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}


const syncInitialCreditNoteData = async (simproInvoiceArray: SimproInvoiceType[]) => {
    try {
        let simproCreditNoteResponseArr: SimproCreditNoteType[] = await fetchSimproPaginatedData<SimproCreditNoteType>('/creditNotes/', "ID,Type,Customer,DateIssued,Stage,Total,InvoiceNo", "");

        if (!simproCreditNoteResponseArr) {
            console.error('No credit notes found to sync.');
            return [];
        }

        simproCreditNoteResponseArr.forEach(item => {
            item.InvoiceData = simproInvoiceArray.find(invoice => invoice.ID === item.InvoiceNo);
        })

        simproCreditNoteResponseArr = simproCreditNoteResponseArr.filter(item => item.InvoiceData)

        let creditorsWatchCreditNoteDataArray: CreditorsWatchCreditNoteType[] = transformCreditNoteDataToCreditorsWatchArray("Simpro", simproCreditNoteResponseArr);

        for (const row of creditorsWatchCreditNoteDataArray) {
            try {
                const response = await creditorsWatchPostWithRetry('/credit_notes', { credit_note: { ...row } });
                if (!response) {
                    console.error('Failed to sync credit note data after multiple attempts.');
                    continue;
                }

                let creditorsWatchCreditNotesData = response?.data?.credit_note;
                if (!creditorsWatchCreditNotesData) {
                    console.error('Data unavailable to create mapping.');
                    continue;
                }

                let newMapping: MappingType = {
                    simproId: creditorsWatchCreditNotesData.external_id,
                    creditorsWatchId: String(creditorsWatchCreditNotesData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await CreditNoteMappingModel.create(newMapping);
                console.log('Mapping created:', savedMapping);
            } catch (error) {
                if (error instanceof AxiosError) {
                    console.error('Error syncing credit note data:', error.response?.data || error.message);

                } else {
                    console.error('Unexpected error in credit note sync:', error);
                }
            }
        }


    } catch (error) {
        if (error instanceof AxiosError) {
            console.error('Error syncing credit note data:', error.response?.data || error.message);
            throw {
                message: 'Error syncing credit note data', error: error.response?.data || error.message
            }
        } else {
            // Generic error handling
            console.error('Unexpected error:', error);
            throw {
                message: 'Error syncing credit note data', error: "Something went wrong while syncing credit note."
            }
        }
        return []
    }
}
