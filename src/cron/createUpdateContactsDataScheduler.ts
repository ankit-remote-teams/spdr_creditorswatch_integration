const cron = require('node-cron');
import { AxiosError } from 'axios';
import ContactMappingModel from '../models/contactMappingModel';
import moment from 'moment';
import { fetchSimproPaginatedData } from '../services/simproService';
import { CreditorsWatchContactType, MappingType, SimproCompanyType } from '../types/types';
import { transformContactDataToCreditorsWatchArray } from '../utils/transformDataHelper';
import { creditorsWatchPostWithRetry, creditorsWatchPutWithRetry } from '../utils/apiUtils';
import { get48HoursAgoDate } from '../utils/helper';
import { ses } from '../config/awsConfig';

export const updateContactsData = async () => {
    try {
        const ifModifiedSinceHeader = get48HoursAgoDate();
        let simproCustomerResponseArr: SimproCompanyType[] = await fetchSimproPaginatedData('/customers/companies/?pageSize=100', "ID,CompanyName,Email,Archived,EIN,Phone,AltPhone", ifModifiedSinceHeader);
        let creditorWatchContactDataArray: CreditorsWatchContactType[] = transformContactDataToCreditorsWatchArray('Simpro', simproCustomerResponseArr);

        let simproIdDocumentToFetchFromMapping: string[] = [];
        simproCustomerResponseArr.forEach(item => simproIdDocumentToFetchFromMapping.push(item.ID.toString()))

        const mappingData = await ContactMappingModel.find({ simproId: { $in: simproIdDocumentToFetchFromMapping } });

        if (mappingData.length) {
            let simproCWIDMap: { [key: string]: string } = {};
            mappingData.forEach(item => simproCWIDMap[item.simproId] = item.creditorsWatchId)
            creditorWatchContactDataArray.forEach(item => item.id = parseInt(simproCWIDMap[item.external_id]))
        }

        let dataToUpdate: CreditorsWatchContactType[] = [];
        let dataToAdd: CreditorsWatchContactType[] = [];
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
                    console.log('CONTACT SCHEDULER : Failed to update contact data after multiple attempts.');
                    continue;
                }
            } catch (error) {
                console.log("Error in updating contact data", error);
                if (error instanceof AxiosError) {
                    console.log('CONTACT SCHEDULER : Error syncing contact data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('CONTACT SCHEDULER : Unexpected error:', error);
                    throw error;
                }
            }
        }
        //Code to update add data.
        for (const row of dataToAdd) {
            try {
                delete row.id;
                const response = await creditorsWatchPostWithRetry(`/contacts`, { contact: { ...row } });
                if (!response) {
                    console.log('CONTACT SCHEDULER : Failed to add contact data after multiple attempts.');
                    continue;
                }

                let creditorWatchContactData = response?.data?.contact;
                if (!creditorWatchContactData) {
                    console.log('CONTACT SCHEDULER : Data unavailable to create mapping contact data.');
                    continue;
                }

                let newMapping: MappingType = {
                    simproId: creditorWatchContactData.external_id,
                    creditorsWatchId: String(creditorWatchContactData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await ContactMappingModel.create(newMapping);
                console.log('CONTACT SCHEDULER : Mapping created:', savedMapping);

            } catch (error) {
                console.log("Error in update contact data", error);
                if (error instanceof AxiosError) {
                    console.log('CONTACT SCHEDULER : Error syncing contact data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('CONTACT SCHEDULER : Unexpected error:', error);
                    throw error;
                }
            }
        }
    } catch (error: any) {
        console.log("Error in update contacts data in 2nd catch", error,)
        if (error instanceof AxiosError) {
            console.log('CONTACT SCHEDULER : Error syncing contact data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.log('CONTACT SCHEDULER : Unexpected error:', error);
            throw error;
        }
    }
}

cron.schedule("0 11 * * *", async () => {
    try {
        console.log(`CONTACTS SCHEDULER: Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        await updateContactsData();
    } catch (err: any) {
        const recipients: string[] = process.env.EMAIL_RECIPIENTS
            ? process.env.EMAIL_RECIPIENTS?.split(',')
            : [];

        const sendemail = `
        <html>
            <body>
                <h1>Error found in update contact data scheduler</h1>
                <p>Log: </p>
                <p>${JSON.stringify(err)}</p>
            </body>
        </html>
    `;

        const params = {
            Destination: {
                ToAddresses: recipients,
            },
            Message: {
                Body: {
                    Html: {
                        Charset: 'UTF-8',
                        Data: sendemail,
                    },
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: 'Error in updaste contact data scheduler',
                },
            },
            Source: process.env.SES_SENDER_EMAIL as string,
            ConfigurationSetName: 'promanager-config',
        };

        try {
            const data = await ses.sendEmail(params).promise();
            console.log("Email successfully sent")
        } catch (err) {
            console.error('Error sending email:', err);
            console.log("Failed to send email")
        }
    }

});
