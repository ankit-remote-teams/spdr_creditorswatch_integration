const cron = require('node-cron');
import { AxiosError } from 'axios';
import InvoiceMappingModel from '../models/invoiceMappingModel';
import moment from 'moment';
import { fetchSimproPaginatedData } from '../services/simproService';
import { CreditorsWatchInvoiceType, MappingType, SimproInvoiceType } from '../types/types';
import { transformInvoiceDataToCreditorsWatchArray } from '../utils/transformDataHelper';
import { creditorsWatchPostWithRetry, creditorsWatchPutWithRetry } from '../utils/apiUtils';
import { get25HoursAgoDate } from '../utils/helper';



const updateInvoiceData = async () => {
    try {
        const ifModifiedSinceHeader = get25HoursAgoDate();
        let simproInvoiceResponseArr: SimproInvoiceType[] = await fetchSimproPaginatedData('/customers/companies/', "ID,CompanyName,Email,Archived,EIN,Phone,AltPhone", ifModifiedSinceHeader);
        let creditorWatchContactDataArray: CreditorsWatchInvoiceType[] = transformInvoiceDataToCreditorsWatchArray('Simpro', simproInvoiceResponseArr);

        let simproIdDocumentToFetchFromMapping: string[] = [];
        simproInvoiceResponseArr.forEach(item => simproIdDocumentToFetchFromMapping.push(item.ID.toString()))

        const mappingData = await InvoiceMappingModel.find({ simproId: { $in: simproIdDocumentToFetchFromMapping } });

        if (mappingData.length) {
            let simproCWIDMap: { [key: string]: string } = {};
            mappingData.forEach(item => simproCWIDMap[item.simproId] = item.creditorsWatchId)
            creditorWatchContactDataArray.forEach(item => item.id = parseInt(simproCWIDMap[item.external_id]))
        }

        let dataToUpdate: CreditorsWatchInvoiceType[] = [];
        let dataToAdd: CreditorsWatchInvoiceType[] = [];
        creditorWatchContactDataArray.forEach(item => {
            if (item.id) {
                dataToUpdate.push(item);
            } else {
                dataToAdd.push(item);
            }
        })

        //Code to update exiting data.
        for (const row of dataToUpdate) {
            try {
                let creditorWatchID = row.id;
                delete row.id;
                const response = await creditorsWatchPutWithRetry(`/contacts/${creditorWatchID}`, { contact: { ...row } });
                if (!response) {
                    console.error('Failed to update contact data after multiple attempts.');
                    continue;
                }
            } catch (error) {
                if (error instanceof AxiosError) {
                    console.error('Error syncing contact data:', error.response?.data || error.message);
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
                const response = await creditorsWatchPostWithRetry(`/contacts`, { contact: { ...row } });
                if (!response) {
                    console.error('Failed to add contact data after multiple attempts.');
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

                let savedMapping = await InvoiceMappingModel.create(newMapping);
                console.log('Mapping created:', savedMapping);

            } catch (error) {
                if (error instanceof AxiosError) {
                    console.error('Error syncing contact data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.error('Unexpected error:', error);
                    throw { message: 'Internal Server Error' }
                }
            }
        }


    } catch (error: any) {
        if (error instanceof AxiosError) {
            console.error('Error syncing contact data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.error('Unexpected error:', error);
            throw { message: error?.message }
        }
    }
}

cron.schedule("* * * * *", async () => {
    console.log(`CONTACTS SCHEDULER: Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    await updateInvoiceData();
});
