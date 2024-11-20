const cron = require('node-cron');
import { AxiosError } from "axios";
import moment from "moment";
// import { ses } from '../config/awsConfig'
import { SimproScheduleType } from "../types/simpro.types";
import { fetchScheduleData } from "../controllers/simproController";
import { addJobCardDataToSmartsheet } from "../controllers/smartSheetController";

console.log(`JOBCARD SCHEDULER : Server time ${moment().format('YYYY-MM-DD HH:mm:ss')}`);


cron.schedule("0 */2 * * *", async () => {
    try {
        console.log(`JOBCARD SCHEDULER : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        try {
            console.log(" JOBCARD SCHEDULER : Fetch started for new data")
            let fetchedSimproSchedulesData: SimproScheduleType[] = await fetchScheduleData();
            console.log(" JOBCARD SCHEDULER : fetch completed for new data")

            console.log(" JOBCARD SCHEDULER : Adding new records to smartsheet")
            let responseFromSmartsheet = await addJobCardDataToSmartsheet(fetchedSimproSchedulesData);
            console.log(" JOBCARD SCHEDULER : Completed: Adding new records to smartsheet")
        } catch (err) {
            if (err instanceof AxiosError) {
                console.log(" JOBCARD SCHEDULER : Error in getJobCardReport as AxiosError");
                console.log(" JOBCARD SCHEDULER : Error details: ", err.response?.data);
            } else {
                console.log(" JOBCARD SCHEDULER : Error in getJobCardReport as other error");
                console.log(" JOBCARD SCHEDULER : Error details: ", err);
            }
        }

    } catch (err: any) {
        console.log('Error in job card scheduler. Error: ' + JSON.stringify(err));
        // const recipients: string[] = process.env.EMAIL_RECIPIENTS
        //     ? process.env.EMAIL_RECIPIENTS.split(',')
        //     : [];

        // const errorMessage = err.message || "Unknown error";
        // const errorDetails = err.data || JSON.stringify(err, Object.getOwnPropertyNames(err));

        // const sendemail = `
        // <html>
        //     <body>
        //         <h1>Error found in data delete scheduler</h1>
        //         <p><strong>Error Message:</strong> ${errorMessage}</p>
        //         <p><strong>Details:</strong> ${errorDetails}</p>
        //     </body>
        // </html>
        // `;

        // const params = {
        //     Destination: {
        //         ToAddresses: recipients,
        //     },
        //     Message: {
        //         Body: {
        //             Html: {
        //                 Charset: 'UTF-8',
        //                 Data: sendemail,
        //             },
        //         },
        //         Subject: {
        //             Charset: 'UTF-8',
        //             Data: 'Error in data delete scheduler',
        //         },
        //     },
        //     Source: process.env.SES_SENDER_EMAIL as string,
        //     ConfigurationSetName: 'promanager-config',
        // };

        // try {
        //     await ses.sendEmail(params).promise();
        //     console.log(" JOBCARD SCHEDULER : Email successfully sent");
        // } catch (emailError) {
        //     console.error('Error sending email:', emailError);
        // }
    }
});
