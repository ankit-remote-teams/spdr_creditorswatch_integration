import { Request, Response } from 'express-serve-static-core';
import axiosSimPRO from '../config/axiosSimProConfig';
import axiosCreditorsWatch from '../config/axiosCreditorsWatchConfig';
import { AxiosError } from 'axios';
import { CreditorsWatchContactType, MappingType, SimproCompanyType } from '../types/types';
import { chunkArray } from '../utils/helper';
import { fetchSimproPaginatedData } from '../services/simproService';
import { transformToCreditorWatchArray } from '../utils/transformDataHelper';
import ContactMappingModel from '../models/contactMappingModel';
import { creditorsWatchPostWithRetry } from '../utils/apiUtils';



// Controller to handle syncing contact data
export const syncInitialSimproContactData = async (req: Request, res: Response): Promise<void> => {
    try {
        let simproCustomerResponse = await fetchSimproPaginatedData('/customers/companies/?Archived=false', "ID,CompanyName,Email,Archived,EIN,Phone,AltPhone", "")
        let simproCustomerResponseArr: SimproCompanyType[] = simproCustomerResponse || [];

        // Transform data to CreditorsWatch format and chunk it
        let creditorWatchDataArray: CreditorsWatchContactType[] = transformToCreditorWatchArray('Simpro', simproCustomerResponseArr);
        for (const row of creditorWatchDataArray) {
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

        res.status(200).json({ message: "Synced data successfully", data: creditorWatchDataArray })
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

// Controller to handle syncing invoice data
export const syncIntialCreditNotesData = (request: Request, response: Response): void => {
    response.json({
        message: 'Syncing credit Notes data...'
    });
};
