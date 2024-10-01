const cron = require('node-cron');
import { AxiosError } from 'axios';
import ContactMappingModel from '../models/contactMappingModel';
import moment from 'moment';
import { fetchSimproPaginatedData } from '../services/simproService';
import { SimproCompanyType } from '../types/types';


const get24HoursAgoDate = (): string => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    return twentyFourHoursAgo.toUTCString();
};

const updateContactsData = async () => {
    try {
        const ifModifiedSinceHeader = get24HoursAgoDate();
        let simproCustomerResponseArr: SimproCompanyType[] = await fetchSimproPaginatedData('/customers/companies/', "ID,CompanyName,Email,Archived,EIN,Phone,AltPhone", ifModifiedSinceHeader)

        let simproIdDocumentToFetchFromMapping: string[] = [];
        simproCustomerResponseArr.forEach(item => simproIdDocumentToFetchFromMapping.push(item.ID.toString()))

        const mappingData = await ContactMappingModel.find({ simproId: { $in: simproIdDocumentToFetchFromMapping } });
        console.log('mappingData', mappingData.length)

        if(mappingData.length){
            
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
    await updateContactsData();
});
