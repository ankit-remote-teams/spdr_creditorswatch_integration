import { Request, Response } from 'express-serve-static-core';
import axiosSimPRO from '../config/axiosSimProConfig';
import axiosCreditorsWatch from '../config/axiosCreditorsWatchConfig';
import { AxiosError } from 'axios';
import { CreditorsWatchContactType, CreditorsWatchInvoiceType, MappingType, SimproCompanyType, SimproInvoiceType } from '../types/types';
import { chunkArray } from '../utils/helper';
import { fetchSimproPaginatedData } from '../services/simproService';
import { transformContactDataToCreditorsWatchArray, transformInvoiceDataToCreditorsWatchArray } from '../utils/transformDataHelper';
import ContactMappingModel from '../models/contactMappingModel';
import { creditorsWatchPostWithRetry } from '../utils/apiUtils';



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


export const syncInitialInvoiceData = async (req: Request, res: Response): Promise<void> => {
    try {
        let simproInvoiceResponseArr: SimproInvoiceType[] = await fetchSimproPaginatedData<SimproInvoiceType>('/invoices/?IsPaid=false', 'ID,Customer,Status,Stage,OrderNo,Total,IsPaid,DateIssued,DatePaid,DateCreated,DateModified,PaymentTerms,Period', '');
        if (!simproInvoiceResponseArr) {
            console.error('No invoices found to sync.');
            res.status(200).json({ message: 'No invoices found to sync.' });
            return;
        }

        let creditorsWatchInvoiceDataArray: CreditorsWatchInvoiceType[] = transformInvoiceDataToCreditorsWatchArray("Simpro", simproInvoiceResponseArr);






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

// Controller to handle syncing invoice data
export const syncIntialCreditNotesData = (request: Request, response: Response): void => {
    response.json({
        message: 'Syncing credit Notes data...'
    });
};
