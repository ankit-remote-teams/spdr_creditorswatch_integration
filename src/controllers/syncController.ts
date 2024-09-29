import { Request, Response } from 'express-serve-static-core';
import axiosSimPRO from '../config/axiosSimProConfig';
import axiosCreditorsWatch from '../config/axiosCreditorsWatchConfig';
import { AxiosError } from 'axios';
import { CreditorsWatchContactType, SimproCompanyType } from '../types/types';
import { chunkArray } from '../utils/helper';
import { fetchSimproPaginatedData } from '../services/simproService';
import { transformToCreditorWatchArray } from '../utils/transformDataHelper';

const CHUNK_SIZE = 5;



// Controller to handle syncing contact data
export const syncInitialSimproContactData = async (req: Request, res: Response): Promise<void> => {
    try {
        let simproCustomerResponse = await fetchSimproPaginatedData('/customers/companies/', "ID,CompanyName,Email,Archived,EIN,Phone,AltPhone")
        let simproCustomerResponseArr: SimproCompanyType[] = simproCustomerResponse || [];

        // Transform data from Simpro to CreditorsWatch format
        const creditorWatchDataArray: CreditorsWatchContactType[] = transformToCreditorWatchArray('Simpro', simproCustomerResponseArr);


        // Write logic to insert or update data in CreditorsWatch  from simpro 
        const chunkedArray = chunkArray(creditorWatchDataArray, CHUNK_SIZE);


        for (const chunk of chunkedArray) {
            try {
                const response = await axiosCreditorsWatch.post('/contacts', chunk);
                console.log(`Successfully synced ${chunk.length} contacts to CreditorsWatch. Response: ${JSON.stringify(response.data)}`);
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





        res.json({
            message: 'Syncing contact data...',
            customerData: simproCustomerResponseArr
        });
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
