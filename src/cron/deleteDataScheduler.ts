const cron = require('node-cron');
import { AxiosError } from "axios";
import moment from "moment";
import axiosSimPRO from "../config/axiosSimProConfig";
import { MappingType } from "../types/types";
import { creditorsWatchPutWithRetry } from "../utils/apiUtils";
import InvoiceMappingModel from '../models/invoiceMappingModel';
import ContactMappingModel from '../models/contactMappingModel';
import CreditNoteMappingModel from "../models/creditNotesMappingModel";

const handleDeleteContactScheduler = async () => {
    try {
        const contactMappingData: MappingType[] = await ContactMappingModel.find({});
        let contactSimproIdArray: string[] = contactMappingData.map(contactSimpro => contactSimpro.simproId);
        let simproIdToUpdateAsDeleted: string[] = [];

        for (let i = 0; i < contactSimproIdArray.length; i++) {
            try {
                let individualContactResponse = await axiosSimPRO.get(`/customers/companies/${contactSimproIdArray[i]}?columns=ID,CompanyName,Email,Archived`);
                if (individualContactResponse.data) {
                    if (individualContactResponse.data?.Archived) {
                        simproIdToUpdateAsDeleted.push(individualContactResponse.data.ID)
                    }
                }
            } catch (error) {
                if (error instanceof AxiosError) {
                    if (error?.response?.data?.errors[0]?.message == "Company customer not found.") {
                        let url: string = error?.request?.path;
                        const parts = url.split('/');
                        const customerId = parts[parts.length - 1].split('?')[0];
                        simproIdToUpdateAsDeleted.push(customerId);
                    } else {
                        console.log('DELETE SCHEDULER : Unexpected AxiosError in Individual:', error);
                        throw { message: error }
                    }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error in Individual:', error);
                    throw { message: error }
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
                if (error instanceof AxiosError) {
                    console.log('DELETE SCHEDULER : Error deleting contact data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error:', error);
                    throw { message: 'Internal Server Error' }
                }
            }

        }

        console.log("DELETE SCHEDULER : Completed")

    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('DELETE SCHEDULER : Error deleting contact data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.log('DELETE SCHEDULER : Unexpected error:', error);
            throw { message: error }
        }
    }
}

const handleDeleteInvoiceScheduler = async () => {
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
                    if (error?.response?.data?.errors[0]?.message == "Invoice(s) not found.") {
                        let url: string = error?.request?.path;
                        const parts = url.split('/');
                        const invoiceId = parts[parts.length - 1].split('?')[0];
                        simproIdToUpdateAsDeleted.push(invoiceId);
                    } else {
                        console.log('DELETE SCHEDULER : Unexpected AxiosError in Individual:', error);
                        throw { message: error }
                    }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error in Individual:', error);
                    throw { message: error }
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
                if (error instanceof AxiosError) {
                    console.log('DELETE SCHEDULER : Error deleting invoice data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error:', error);
                    throw { message: 'Internal Server Error' }
                }
            }

        }

        console.log("DELETE SCHEDULER : Completed")

    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('DELETE SCHEDULER : Error deleting invoice data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.log('DELETE SCHEDULER : Unexpected error:', error);
            throw { message: error }
        }
    }
}

const handleDeleteCreditNoteScheduler = async () => {
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
                if (error instanceof AxiosError) {
                    const errorMessage = error?.response?.data?.errors[0]?.message || "";

                    const creditNoteNotFoundRegex = /Credit\s*Note\s*#?\d*\s*not\s*found/i;
                    if (creditNoteNotFoundRegex.test(errorMessage)) {
                        let url: string = error?.request?.path;
                        const parts = url.split('/');
                        const creditNoteId = parts[parts.length - 1].split('?')[0];
                        simproIdToUpdateAsDeleted.push(creditNoteId);
                    } else {
                        console.log('DELETE SCHEDULER : Unexpected AxiosError in Individual:', error);
                        throw { message: error }
                    }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error in Individual:', error);
                    throw { message: error }
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
                if (error instanceof AxiosError) {
                    console.log('DELETE SCHEDULER : Error deleting credit note data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('DELETE SCHEDULER : Unexpected error:', error);
                    throw { message: 'Internal Server Error' }
                }
            }

        }

        console.log("DELETE SCHEDULER : Completed")

    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('DELETE SCHEDULER : Error deleting credit note data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.log('DELETE SCHEDULER : Unexpected error:', error);
            throw { message: error }
        }
    }
}


console.log('DELETE SCHEDULER : Delete contact scheduler time', moment().format('YYYY-MM-DD HH:mm:ss'))

cron.schedule("38 10 * * *", async () => {
    console.log(`DELETE SCHEDULER : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    await handleDeleteContactScheduler();
    await handleDeleteInvoiceScheduler();
    await handleDeleteCreditNoteScheduler();
});
