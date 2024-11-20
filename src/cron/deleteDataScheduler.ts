const cron = require('node-cron');
import { AxiosError } from "axios";
import moment from "moment";
import axiosSimPRO from "../config/axiosSimProConfig";
import { MappingType } from "../types/creditorswatch.types";
import { creditorsWatchPutWithRetry } from "../utils/apiUtils";
import InvoiceMappingModel from '../models/invoiceMappingModel';
import ContactMappingModel from '../models/contactMappingModel';
import CreditNoteMappingModel from "../models/creditNotesMappingModel";
import { ses } from '../config/awsConfig'

// Delay function to pause execution for a given time in milliseconds
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const handleDeleteContactScheduler = async () => {
    try {
        const contactMappingData: MappingType[] = await ContactMappingModel.find({});
        let contactSimproIdArray: string[] = contactMappingData.map(contactSimpro => contactSimpro.simproId);
        let simproIdToUpdateAsDeleted: string[] = [];
        for (let i = 0; i < contactSimproIdArray.length; i++) {
            try {
                await delay(100);
                // Make an API call to get individual contact details
                let individualContactResponse = await axiosSimPRO.get(`/customers/companies/${contactSimproIdArray[i]}?columns=ID,CompanyName,Email,Archived`);

                // Check if contact data is available and archived
                const contactData = individualContactResponse.data;
                if (contactData && contactData.Archived) {
                    console.log("Simpro contact marked as delete : ", contactData.ID)
                    simproIdToUpdateAsDeleted.push(contactSimproIdArray[i]);
                }
            } catch (error) {
                console.log("Error in delete contact scheduler: ", error);

                // Handle Axios errors
                if (error instanceof AxiosError) {
                    if (error.response?.status === 429) {
                        console.log('Rate limit reached. Retrying...');
                        await delay(1000); // Delay before retry
                        i--;  // Decrement index to retry the same contact
                        continue;
                    }

                    // Handle specific 'Company customer not found' error
                    const errors = error?.response?.data?.errors;
                    if (errors?.[0]?.message === "Company customer not found.") {
                        const url: string = error.request?.path || "";
                        const parts = url.split('/');
                        const customerId = parts.length ? parts[parts.length - 1].split('?')[0] : "";

                        if (customerId) {
                            simproIdToUpdateAsDeleted.push(customerId);
                        }
                    } else {
                        console.log('DELETE SCHEDULER: Unexpected AxiosError in Individual:', error);
                        throw error;
                    }
                } else {
                    console.log('DELETE SCHEDULER: Unexpected error in Individual:', error);
                    throw error;
                }
            }
        }


        let creditorWatchContactIdArray: string[] = contactMappingData
            .filter(mappingItem => simproIdToUpdateAsDeleted.includes(mappingItem.simproId))
            .map(mappingItem => mappingItem.creditorsWatchId);

        for (let creditorsId of creditorWatchContactIdArray) {
            try {
                await delay(100);
                const response = await creditorsWatchPutWithRetry(`/contacts/${creditorsId}`, { contact: { status: 'deleted' } })
                if (!response) {
                    console.log('DELETE SCHEDULER : Failed to update contact data after multiple attempts.');
                    continue;
                }
            } catch (error) {
                console.log("DELETE SCHEDULER : Failed to update delete data catch 2", error)
                if (error instanceof AxiosError) {
                    console.log('DELETE SCHEDULER : Error deleting contact data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error 1:', error);
                    throw error;
                }
            }

        }

        console.log("DELETE SCHEDULER : Completed for Contacts")

    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('DELETE SCHEDULER : Error deleting contact data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.log('DELETE SCHEDULER : Unexpected error 2:', error);
            throw error;
        }
    }
}

export const handleDeleteInvoiceScheduler = async () => {
    try {
        const invoiceMappingData: MappingType[] = await InvoiceMappingModel.find({});
        let invoiceSimproIdArray: string[] = invoiceMappingData.map(invoiceSimpro => invoiceSimpro.simproId);
        let simproIdToUpdateAsDeleted: string[] = [];

        for (let i = 0; i < invoiceSimproIdArray.length; i++) {
            try {
                await delay(100);
                let individualInvoiceResponse = await axiosSimPRO.get(`/invoices/${invoiceSimproIdArray[i]}?columns=ID,Customer,Stage`);

                // Check if invoice data is valid
                if (individualInvoiceResponse.data?.ID) {
                    continue;
                } else {
                    console.log("Simpro invoice marked as delete : ", invoiceSimproIdArray[i])
                    simproIdToUpdateAsDeleted.push(invoiceSimproIdArray[i]);
                }

            } catch (error) {
                if (error instanceof AxiosError) {
                    // Handle rate limit errors with retry
                    if (error.response?.status === 429) {
                        console.log('Rate limit reached. Retrying...');
                        await delay(1000);  // Wait before retrying
                        i--;  // Retry the current request
                        continue;
                    }

                    // Handle specific "Invalid resource URI" error
                    if (error?.response?.data?.error === "Invalid resource URI. The correct URI is specified in _href.") {
                        try {
                            const fullHref = error.response.data._href;
                            const relevantPath = fullHref.replace(/^\/api\/v1\.0\/companies\/2/, '');
                            const retainageId = relevantPath.split('/').pop();

                            // Correct the request path and retry
                            const responseRetainage = await axiosSimPRO.get(relevantPath);
                            if (!responseRetainage.data) {
                                simproIdToUpdateAsDeleted.push(retainageId);
                            }
                        } catch (retainageError) {
                            if (retainageError instanceof AxiosError) {
                                console.log('DELETE SCHEDULER : Error fetching retainage:', retainageError.response?.data || retainageError.message);
                                throw { message: retainageError.message, data: retainageError?.response?.data };
                            } else {
                                console.log('DELETE SCHEDULER : Unexpected error fetch retainage:', retainageError);
                                throw retainageError;
                            }
                        }
                    } else if (error?.response?.data?.errors[0]?.message === "Invoice(s) not found.") {
                        // Handle "Invoice(s) not found" error
                        const url: string = error?.request?.path || "";
                        const invoiceId = url.split('/').pop()?.split('?')[0] || "";

                        if (invoiceId) {
                            simproIdToUpdateAsDeleted.push(invoiceId);
                        }
                    } else {
                        console.log('DELETE SCHEDULER : Unexpected AxiosError in Individual:', error);
                        throw error;
                    }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error in Individual:', error);
                    throw error;
                }
            }
        }

        let creditorWatchInvoiceIdArray: string[] = invoiceMappingData
            .filter(mappingItem => simproIdToUpdateAsDeleted.includes(mappingItem.simproId))
            .map(mappingItem => mappingItem.creditorsWatchId);

        for (let creditorsId of creditorWatchInvoiceIdArray) {
            try {
                await delay(100)
                const response = await creditorsWatchPutWithRetry(`/invoices/${creditorsId}`, { invoice: { status: 'deleted' } })
                if (!response) {
                    console.log('DELETE SCHEDULER : Failed to update invoice data after multiple attempts.');
                    continue;
                }
            } catch (error) {
                if (error instanceof AxiosError) {
                    console.log('DELETE SCHEDULER : Error deleting invoice data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error 3:', error);
                    throw error;
                }
            }

        }

        console.log("DELETE SCHEDULER : Completed Invoice")

    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('DELETE SCHEDULER : Error deleting invoice data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.log('DELETE SCHEDULER : Unexpected error 4:', error);
            throw error;
        }
    }
}


export const handleDeleteCreditNoteScheduler = async () => {
    try {
        const creditNoteMappingData: MappingType[] = await CreditNoteMappingModel.find({});
        let creditNoteSimproIdArray: string[] = creditNoteMappingData.map(creditNoteSimpro => creditNoteSimpro.simproId);
        let simproIdToUpdateAsDeleted: string[] = [];

        for (let i = 0; i < creditNoteSimproIdArray.length; i++) {
            try {
                await delay(100);

                let individualCreditNoteResponse = await axiosSimPRO.get(`/creditNotes/${creditNoteSimproIdArray[i]}?columns=ID,Type,Customer,DateIssued,Stage,Total,InvoiceNo`);

                if (individualCreditNoteResponse.data?.ID) {
                    continue;
                }
            } catch (error) {
                if (error instanceof AxiosError) {
                    if (error.response?.status === 429) {
                        console.log('Rate limit reached. Retrying...');
                        await delay(1000);
                        i--;
                        continue;
                    }

                    const errorMessage = error?.response?.data?.errors[0]?.message || "";
                    const creditNoteNotFoundRegex = /Credit\s*Note\s*#?\d*\s*not\s*found/i;

                    // Handle "Credit Note not found" error
                    if (creditNoteNotFoundRegex.test(errorMessage)) {
                        const url: string = error?.request?.path || "";
                        const creditNoteId = url.split('/').pop()?.split('?')[0] || "";

                        if (creditNoteId) {
                            simproIdToUpdateAsDeleted.push(creditNoteId);
                        }
                    } else {
                        console.log('DELETE SCHEDULER : Unexpected AxiosError in Individual:', error);
                        throw error;
                    }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error in Individual:', error);
                    throw error;
                }
            }
        }

        let creditorWatchCreditNoteIdArray: string[] = creditNoteMappingData
            .filter(mappingItem => simproIdToUpdateAsDeleted.includes(mappingItem.simproId))
            .map(mappingItem => mappingItem.creditorsWatchId);

        for (let creditorsId of creditorWatchCreditNoteIdArray) {
            try {
                await delay(100);
                const response = await creditorsWatchPutWithRetry(`/credit_notes/${creditorsId}`, { credit_note: { status: 'deleted' } });
                if (!response) {
                    console.log('DELETE SCHEDULER : Failed to update credit note data after multiple attempts.');
                    continue;
                }
            } catch (error) {
                if (error instanceof AxiosError) {
                    console.log('DELETE SCHEDULER : Error deleting credit note data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data };
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error 5:', error);
                    throw error;
                }
            }
        }

        console.log("DELETE SCHEDULER : Completed Credit Note");

    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('DELETE SCHEDULER : Error deleting credit note data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data };
        } else {
            console.log('DELETE SCHEDULER : Unexpected error 6:', error);
            throw error;
        }
    }
};



console.log('DELETE SCHEDULER : Delete contact scheduler time', moment().format('YYYY-MM-DD HH:mm:ss'))

cron.schedule("0 6 * * *", async () => {
    try {
        console.log(`DELETE SCHEDULER : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        await handleDeleteContactScheduler();
        await handleDeleteInvoiceScheduler();
        await handleDeleteCreditNoteScheduler();
    } catch (err: any) {
        const recipients: string[] = process.env.EMAIL_RECIPIENTS
            ? process.env.EMAIL_RECIPIENTS.split(',')
            : [];

        const errorMessage = err.message || "Unknown error";
        const errorDetails = err.data || JSON.stringify(err, Object.getOwnPropertyNames(err));

        const sendemail = `
        <html>
            <body>
                <h1>Error found in data delete scheduler</h1>
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
                    Data: 'Error in data delete scheduler',
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
