const cron = require('node-cron');
import { AxiosError } from "axios";
import moment from "moment";
import axiosSimPRO from "../config/axiosSimProConfig";
import { MappingType } from "../types/types";
import { creditorsWatchPutWithRetry } from "../utils/apiUtils";
import InvoiceMappingModel from '../models/invoiceMappingModel';
import ContactMappingModel from '../models/contactMappingModel';
import CreditNoteMappingModel from "../models/creditNotesMappingModel";
import { ses } from '../config/awsConfig'

export const handleDeleteContactScheduler = async () => {
    try {
        console.log('cam her 1')
        const contactMappingData: MappingType[] = await ContactMappingModel.find({});
        let contactSimproIdArray: string[] = contactMappingData.map(contactSimpro => contactSimpro.simproId);
        let simproIdToUpdateAsDeleted: string[] = [];
        console.log('cam her 3')
        for (let i = 0; i < contactSimproIdArray.length; i++) {
            try {
                let individualContactResponse = await axiosSimPRO.get(`/customers/companies/${contactSimproIdArray[i]}?columns=ID,CompanyName,Email,Archived`);
                if (individualContactResponse.data) {
                    if (individualContactResponse.data?.Archived) {
                        simproIdToUpdateAsDeleted.push(individualContactResponse.data.ID)
                    }
                }
                console.log('cam her 2')
            } catch (error) {
                console.log("ERROR 1", error)
                console.log("Error in delete contact scheduler: ", error)
                if (error instanceof AxiosError) {
                    const errors = error?.response?.data?.errors;
                    if (errors && errors.length > 0 && errors[0]?.message === "Company customer not found.") {
                        let url: string = error?.request?.path;
                        if (url) {
                            const parts = url.split('/');
                            let customerId = "";
                            if (parts && parts.length > 0) {
                                const lastPart = parts[parts.length - 1];
                                customerId = lastPart ? lastPart.split('?')[0] : "";
                            }
                            if (customerId) {
                                simproIdToUpdateAsDeleted.push(customerId);
                            }
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

        let creditorWatchContactIdArray: string[] = contactMappingData
            .filter(mappingItem => simproIdToUpdateAsDeleted.includes(mappingItem.simproId))
            .map(mappingItem => mappingItem.creditorsWatchId);

        for (let creditorsId of creditorWatchContactIdArray) {
            try {
                const response = await creditorsWatchPutWithRetry(`/contacts/${creditorsId}`, { contact: { status: 'deleted' } })
                if (!response) {
                    console.log('DELETE SCHEDULER : Failed to update contact data after multiple attempts.');
                    continue;
                }
            } catch (error) {
                console.log("ERROR 2", error)
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

        console.log("DELETE SCHEDULER : Completed")

    } catch (error) {
        console.log("ERROR 3", error)
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
                let individualInvoiceResponse = await axiosSimPRO.get(`/invoices/${invoiceSimproIdArray[i]}?columns=ID,Customer,Stage`);
                if (individualInvoiceResponse.data) {
                    if (individualInvoiceResponse.data?.ID) {
                        continue;
                    }
                }
            } catch (error) {
                if (error instanceof AxiosError) {
                    console.log("ERROR 4", error?.response?.data)
                    if (error?.response?.data?.error == "Invalid resource URI. The correct URI is specified in _href.") {
                        try {
                            const fullHref = error.response.data._href;
        
                            // Remove the base URL and company path if they exist in _href, leaving just the relative path.
                            const relevantPath = fullHref.replace(/^\/api\/v1\.0\/companies\/2\//, '');
                            let retainageId = relevantPath.split('/')[relevantPath.split('/').length - 1];
                    
                            // Make the request with the corrected path
                            const responseRetainage = await axiosSimPRO.get(relevantPath);
                            if(!responseRetainage.data){
                                simproIdToUpdateAsDeleted.push(retainageId);
                            }
                        }
                        catch (error) {
                            if (error instanceof AxiosError) {
                                console.log('DELETE SCHEDULER : Error fetching retainage :', error.response?.data || error.message);
                                throw { message: error.message, data: error?.response?.data }
                            } else {
                                console.log('DELETE SCHEDULER : Unexpected error fetch retainage:', error);
                                throw error;
                            }
                        }
                    } else if (error?.response?.data?.errors[0]?.message == "Invoice(s) not found.") {
                        let url: string = error?.request?.path;
                        if (url) {
                            const parts = url?.split('/');
                            let invoiceId: string = "";
                            if (parts && parts.length > 0) {
                                const lastPart = parts[parts.length - 1];
                                invoiceId = lastPart ? lastPart.split('?')[0] : "";
                            }

                            if (invoiceId) {
                                simproIdToUpdateAsDeleted.push(invoiceId);
                            }
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
                const response = await creditorsWatchPutWithRetry(`/invoices/${creditorsId}`, { invoice: { status: 'deleted' } })
                if (!response) {
                    console.log('DELETE SCHEDULER : Failed to update invoice data after multiple attempts.');
                    continue;
                }
            } catch (error) {
                console.log("ERROR 5", error)
                if (error instanceof AxiosError) {
                    console.log('DELETE SCHEDULER : Error deleting invoice data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error 3:', error);
                    throw error;
                }
            }

        }

        console.log("DELETE SCHEDULER : Completed")

    } catch (error) {
        console.log("ERROR 6", error)
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
                let individualCreditNoteResponse = await axiosSimPRO.get(`/creditNotes/${creditNoteSimproIdArray[i]}?columns=ID,Type,Customer,DateIssued,Stage,Total,InvoiceNo`);
                if (individualCreditNoteResponse.data) {
                    if (individualCreditNoteResponse.data?.ID) {
                        continue;
                    }
                }
            } catch (error) {
                console.log("ERROR 7", error)
                if (error instanceof AxiosError) {
                    const errorMessage = error?.response?.data?.errors[0]?.message || "";

                    const creditNoteNotFoundRegex = /Credit\s*Note\s*#?\d*\s*not\s*found/i;
                    if (creditNoteNotFoundRegex.test(errorMessage)) {
                        let url: string = error?.request?.path;
                        if (url) {
                            const parts = url?.split('/');
                            let creditNoteId: string = "";
                            if (parts && parts.length > 0) {
                                const lastPart = parts[parts.length - 1];
                                creditNoteId = lastPart ? lastPart.split('?')[0] : "";
                            }

                            if (creditNoteId) {
                                simproIdToUpdateAsDeleted.push(creditNoteId);
                            }
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
                const response = await creditorsWatchPutWithRetry(`/credit_notes/${creditorsId}`, { credit_note: { status: 'deleted' } })
                if (!response) {
                    console.log('DELETE SCHEDULER : Failed to update credit note data after multiple attempts.');
                    continue;
                }
            } catch (error) {
                console.log("ERROR 8", error)
                if (error instanceof AxiosError) {
                    console.log('DELETE SCHEDULER : Error deleting credit note data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error 5:', error);
                    throw error;
                }
            }

        }

        console.log("DELETE SCHEDULER : Completed")

    } catch (error) {
        console.log("ERROR 9", error)
        if (error instanceof AxiosError) {
            console.log('DELETE SCHEDULER : Error deleting credit note data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.log('DELETE SCHEDULER : Unexpected error 6:', error);
            throw error;
        }
    }
}


console.log('DELETE SCHEDULER : Delete contact scheduler time', moment().format('YYYY-MM-DD HH:mm:ss'))

cron.schedule("0 * * * *", async () => {
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
