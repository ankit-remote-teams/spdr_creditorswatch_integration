const cron = require('node-cron');
import moment from "moment";
import { SimproLeadType, SimproQuotationType } from "../types/simpro.types";
import { fetchSimproQuotationData } from "../services/SimproServices/simproQuotationService";
import { fetchSimproLeadsData } from "../services/SimproServices/simproLeadsService";
import { addOpenLeadsDataToSmartsheet, addOpenQuotesDataToSmartsheet } from "../controllers/smartSheetController";
import { ses } from "../config/awsConfig";

console.log('Current time in austarlia : ', moment().format(" DD-MMM-YYYY HH:mm:ss"))
cron.schedule("0 8,12,18 * * *", async () => {
    try {
        console.log(`ONGOING QUOTATION SCHEDULER : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        console.log("Fetch ongoing quotation data")
        let fetchedQuotationData: SimproQuotationType[] = await fetchSimproQuotationData();
        console.log("fetch completed for quotation data")

        console.log("Fetching open leads")
        let fetchedLeadsData: SimproLeadType[] = await fetchSimproLeadsData();
        console.log('Completed fetching the leads data')


        console.log("Add quotation data to sheet")
        let addQuoteDataToSheetResponse = await addOpenQuotesDataToSmartsheet(fetchedQuotationData)

        console.log("Add leads data to sheet")
        let addLeadsDataToSheetResponse = await addOpenLeadsDataToSmartsheet(fetchedLeadsData);

        console.log("Completed: getQuotationReport")

        if (addQuoteDataToSheetResponse?.status && addLeadsDataToSheetResponse?.status) {
            console.log("Successfully updated the quotation and leads data");
        }
    } catch (err: any) {
        const recipients: string[] = process.env.EMAIL_RECIPIENTS
            ? process.env.EMAIL_RECIPIENTS.split(',')
            : [];

        const errorMessage = err.message || "Unknown error";
        const errorDetails = err.data || JSON.stringify(err, Object.getOwnPropertyNames(err));

        const sendemail = `
        <html>
            <body>
                <h1>Error found in data ongoing quotation and leads scheduler</h1>
                <p><strong>Error Message:</strong> ${errorMessage}</p>
                <p><strong>Details:</strong> ${errorDetails}</p>
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
                    Data: 'Error in ongoing quotation and lead scheduler',
                },
            },
            Source: process.env.SES_SENDER_EMAIL as string,
            ConfigurationSetName: 'promanager-config',
        };

        try {
            await ses.sendEmail(params).promise();
            console.log("Email successfully sent");
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }
    }
});