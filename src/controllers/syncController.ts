import { Request, Response } from 'express-serve-static-core';
import { AxiosError } from 'axios';
import { CreditorsWatchContactType, CreditorsWatchCreditNoteType, CreditorsWatchInvoiceType, InvoiceItemPaymentsType, MappingType, SimproCompanyType, SimproCreditNoteType, SimproCustomerPaymentsType, SimproInvoiceType } from '../types/types';
import { fetchSimproPaginatedData } from '../services/simproService';
import { transformContactDataToCreditorsWatchArray, transformCreditNoteDataToCreditorsWatchArray, transformInvoiceDataToCreditorsWatchArray } from '../utils/transformDataHelper';
import ContactMappingModel from '../models/contactMappingModel';
import { creditorsWatchPostWithRetry } from '../utils/apiUtils';
import InvoiceMappingModel from '../models/invoiceMappingModel';
import CreditNoteMappingModel from '../models/creditNotesMappingModel';
import moment from 'moment';
import { updateInvoiceData } from '../cron/createUpdateInvoiceCreditNoteScheduler';
import { calculateLatePaymentFeeAndBalanceDue } from '../utils/helper';
import { handleLateFeeUpdate } from '../cron/updateLateFeeScheduler';
import { ses } from '../config/awsConfig';
import { updateContactsData } from '../cron/createUpdateContactsDataScheduler';

const defaultPercentageValueForLateFee: number = parseFloat(process.env.DEFAULT_LATE_FEE_PERCENTAGE_FOR_CUSTOMER_PER_YEAR || '0');
console.log('SYNC CONTROLLER :SYNC CONTROLLER :  DEFAULT_LATE_FEE_PERCENTAGE_FOR_CUSTOMER_PER_YEAR', process.env.DEFAULT_LATE_FEE_PERCENTAGE_FOR_CUSTOMER_PER_YEAR)
console.log('SYNC CONTROLLER : defaultPercentageValueForLateFee', defaultPercentageValueForLateFee)

// Controller to handle syncing contact data
export const syncInitialSimproContactData = async (req: Request, res: Response): Promise<void> => {
    try {
        let simproCustomerResponseArr: SimproCompanyType[] = await fetchSimproPaginatedData<SimproCompanyType>('/customers/companies/?Archived=false&pageSize=100', "ID,CompanyName,Email,Archived,EIN,Phone,AltPhone", "")

        // Transform data to CreditorsWatch format and chunk it
        let creditorWatchContactDataArray: CreditorsWatchContactType[] = transformContactDataToCreditorsWatchArray('Simpro', simproCustomerResponseArr);
        for (const row of creditorWatchContactDataArray) {
            try {
                const response = await creditorsWatchPostWithRetry('/contacts', { contact: { ...row } });
                if (!response) {
                    console.log('SYNC CONTROLLER : Failed to sync contact data after multiple attempts.');
                    continue;
                }

                let creditorWatchContactData = response?.data?.contact;
                if (!creditorWatchContactData) {
                    console.log('SYNC CONTROLLER : Data unavailable to create mapping for contact.');
                    continue;
                }

                let newMapping: MappingType = {
                    simproId: creditorWatchContactData.external_id,
                    creditorsWatchId: String(creditorWatchContactData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await ContactMappingModel.create(newMapping);
                console.log('SYNC CONTROLLER : Mapping created:', savedMapping);
            } catch (error) {
                if (error instanceof AxiosError) {
                    console.log('SYNC CONTROLLER : Error syncing contact data:', error.response?.data || error.message);
                    res.status(500).json({ message: 'Error from Axios request', details: error.response?.data });
                } else {
                    console.log('SYNC CONTROLLER : Unexpected error:', error);
                    res.status(500).json({ message: 'Internal Server Error' });
                }
            }
        }

        res.status(200).json({ message: "Synced data successfully", data: creditorWatchContactDataArray })
    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('SYNC CONTROLLER : Error syncing contact data:', error.response?.data || error.message);
            res.status(500).json({ message: 'Error from Axios request', details: error.response?.data });
        } else {
            // Generic error handling
            console.log('SYNC CONTROLLER : Unexpected error:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}


export const syncInitialInvoiceCreditNoteData = async (req: Request, res: Response): Promise<void> => {
    try {
        let simproInvoiceResponseArr: SimproInvoiceType[] = await fetchSimproPaginatedData<SimproInvoiceType>('/invoices/?IsPaid=false&pageSize=100', 'ID,Customer,Status,Stage,Total,IsPaid,DateIssued,DatePaid,DateCreated,PaymentTerms,LatePaymentFee,Type', '');

        if (!simproInvoiceResponseArr) {
            console.log('SYNC CONTROLLER : No invoices found to sync.');
            res.status(200).json({ message: 'No invoices found to sync.' });
            return;
        }

        simproInvoiceResponseArr = simproInvoiceResponseArr.filter(invoice => invoice.Stage === "Approved" && invoice.Type != 'RequestForClaim')

        const oldestInvoice = simproInvoiceResponseArr.reduce((oldest, current) => {
            const currentDate = moment(current.DateIssued, 'YYYY-MM-DD');
            const oldestDate = moment(oldest.DateIssued, 'YYYY-MM-DD');
            return currentDate.isBefore(oldestDate) ? current : oldest;
        });

        const formattedDate = moment(oldestInvoice.DateIssued, 'YYYY-MM-DD').format('ddd, DD MMM YYYY HH:mm:ss [GMT]');

        let simproCustomerPaymentsResponse: SimproCustomerPaymentsType[] = await fetchSimproPaginatedData('/customerPayments/?pageSize=100', 'ID,Payment,Invoices', formattedDate);

        let invoicesPaymentsData: InvoiceItemPaymentsType[] = [];
        simproCustomerPaymentsResponse.forEach(customerPayment => {
            customerPayment.Invoices.forEach(paymentInvoiceItem => {
                let individualInvoice = {
                    paymentId: customerPayment?.ID,
                    paymentDate: customerPayment?.Payment?.Date,
                    financeCharge: customerPayment?.Payment?.FinanceCharge,
                    paymentInvoiceId: paymentInvoiceItem?.Invoice.ID,
                    paymentInvoiceAmount: paymentInvoiceItem?.Amount,
                };
                invoicesPaymentsData.push(individualInvoice);
            });
        });

        invoicesPaymentsData.sort((a, b) => {
            const dateA = moment(a.paymentDate, 'YYYY-MM-DD');
            const dateB = moment(b.paymentDate, 'YYYY-MM-DD');
            return dateA.diff(dateB);
        });

        simproInvoiceResponseArr.forEach(invoiceItem => {
            const paymentItems = invoicesPaymentsData.filter(payment => payment.paymentInvoiceId === invoiceItem.ID);
            if (paymentItems.length > 0) {
                if (invoiceItem.InvoicePaymentInfo?.length) {
                    invoiceItem.InvoicePaymentInfo.push(...paymentItems);
                } else {
                    invoiceItem.InvoicePaymentInfo = [...paymentItems];
                }
            }
        });


        let creditorsWatchInvoiceDataArray: CreditorsWatchInvoiceType[] = await transformInvoiceDataToCreditorsWatchArray("Simpro", simproInvoiceResponseArr);


        for (let row of creditorsWatchInvoiceDataArray) {
            try {
                let tempRow = { ...row };
                if (tempRow.LatePaymentFee) {
                    const dueDate = moment(tempRow.due_date, 'YYYY-MM-DD');
                    let daysLate: number;
                    const currentDate = moment();
                    let dailyLateFeeRate: number;
                    daysLate = moment(currentDate).diff(dueDate, 'days');

                    if (daysLate > 0) {
                        dailyLateFeeRate = defaultPercentageValueForLateFee / 365;
                        let lateFee = calculateLatePaymentFeeAndBalanceDue(row)
                        let amount_due = (tempRow?.payments ? tempRow.payments.reduce((sub, payment) => sub - (payment.paymentInvoiceAmount + (payment?.lateFeeOnPayment || 0)), tempRow?.total_amount) : tempRow?.total_amount) + lateFee;
                        let amount_paid = tempRow?.payments ? tempRow.payments.reduce((sum, payment) => sum + (payment.paymentInvoiceAmount + (payment?.lateFeeOnPayment || 0)), 0) : 0;
                        tempRow = { ...tempRow, amount_due, amount_paid }
                    }
                }
                row = { ...tempRow }

                delete row.id;
                delete row.LatePaymentFee;
                delete row.payments;

                const response = await creditorsWatchPostWithRetry('/invoices', { invoice: { ...row } });
                if (!response) {
                    console.log('SYNC CONTROLLER : Failed to sync invoice data after multiple attempts.');
                    continue;
                }

                let creditorWatchInvoiceData = response?.data?.invoice;
                if (!creditorWatchInvoiceData) {
                    console.log('SYNC CONTROLLER : Data unavailable to create mapping invoice.');
                    continue;
                }

                let newMapping: MappingType = {
                    simproId: creditorWatchInvoiceData.external_id,
                    creditorsWatchId: String(creditorWatchInvoiceData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await InvoiceMappingModel.create(newMapping);
                console.log('SYNC CONTROLLER : Mapping created:', savedMapping);

            } catch (error) {
                if (error instanceof AxiosError) {
                    console.log('SYNC CONTROLLER : Error syncing contact data:', error.response?.data || error.message);
                    res.status(500).json({ message: 'Error from Axios request', details: error.response?.data });
                } else {
                    console.log('SYNC CONTROLLER : Unexpected error:', error);
                    res.status(500).json({ message: 'Internal Server Error' });
                }
            }
        }

        await syncInitialCreditNoteData(simproInvoiceResponseArr)

        res.status(200).json({ message: "Synced data successfully", })
    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('SYNC CONTROLLER : Error syncing invoice data:', error.response?.data || error.message);
            res.status(500).json({ message: 'Error from Axios request', details: error.response?.data });
        } else {
            // Generic error handling
            console.log('SYNC CONTROLLER : Unexpected error:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}


const syncInitialCreditNoteData = async (simproInvoiceArray: SimproInvoiceType[]) => {
    try {
        let simproCreditNoteResponseArr: SimproCreditNoteType[] = await fetchSimproPaginatedData<SimproCreditNoteType>('/creditNotes/?pageSize=100', "ID,Type,Customer,DateIssued,Stage,Total,InvoiceNo", "");

        if (!simproCreditNoteResponseArr) {
            console.log('SYNC CONTROLLER : No credit notes found to sync.');
            return [];
        }

        simproCreditNoteResponseArr.forEach(item => {
            item.InvoiceData = simproInvoiceArray.find(invoice => invoice.ID === item.InvoiceNo);
        })

        simproCreditNoteResponseArr = simproCreditNoteResponseArr.filter(item => item.InvoiceData)

        let creditorsWatchCreditNoteDataArray: CreditorsWatchCreditNoteType[] = transformCreditNoteDataToCreditorsWatchArray("Simpro", simproCreditNoteResponseArr);

        for (const row of creditorsWatchCreditNoteDataArray) {
            try {
                const response = await creditorsWatchPostWithRetry('/credit_notes', { credit_note: { ...row } });
                if (!response) {
                    console.log('SYNC CONTROLLER : Failed to sync credit note data after multiple attempts.');
                    continue;
                }

                let creditorsWatchCreditNotesData = response?.data?.credit_note;
                if (!creditorsWatchCreditNotesData) {
                    console.log('SYNC CONTROLLER : Data unavailable to create mapping credit note.');
                    continue;
                }

                let newMapping: MappingType = {
                    simproId: creditorsWatchCreditNotesData.external_id,
                    creditorsWatchId: String(creditorsWatchCreditNotesData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await CreditNoteMappingModel.create(newMapping);
                console.log('SYNC CONTROLLER : Mapping created:', savedMapping);
            } catch (error) {
                if (error instanceof AxiosError) {
                    console.log('SYNC CONTROLLER : Error syncing credit note data:', error.response?.data || error.message);

                } else {
                    console.log('SYNC CONTROLLER : Unexpected error in credit note sync:', error);
                }
            }
        }


    } catch (error) {
        console.log("Error in sync controller in initial credit note data:", error);
        if (error instanceof AxiosError) {
            console.log('SYNC CONTROLLER : Error syncing credit note data:', error.response?.data || error.message);
            throw {
                message: 'Error syncing credit note data', error: error.response?.data || error.message
            }
        } else {
            // Generic error handling
            console.log('SYNC CONTROLLER : Unexpected error:', error);
            throw error;
        }
    }
}


export const updateInvoiceCreditorNoteDataToCreditorsWatch = async (req: Request, res: Response): Promise<void> => {
    try {
        await updateInvoiceData()
        res.status(200).json({ message: "Updated invoice successfully", })
    } catch (error: any) {
        console.log('SYNC CONTROLLER : Unexpected error:', error);

        const recipients: string[] = process.env.EMAIL_RECIPIENTS
            ? process.env.EMAIL_RECIPIENTS.split(',')
            : [];

        // Capture specific error message and details
        const errorMessage = error.message || "Unknown error occurred";
        const errorDetails = error.data || JSON.stringify(error, Object.getOwnPropertyNames(error));

        const sendemail = `
<html>
    <body>
        <h1>Error found in update invoice creditnote data manual call</h1>
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
                    Data: 'Error in update invoice creditnote data manual call',
                },
            },
            Source: process.env.SES_SENDER_EMAIL as string,
            ConfigurationSetName: 'promanager-config',
        };

        try {
            await ses.sendEmail(params).promise();
            console.log("Email successfully sent");
        } catch (err) {
            console.log("Error sending email:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
        }

        res.status(500).json({ message: 'Internal Server Error' });

    }
}


export const updateInvoiceLateFee = async (req: Request, res: Response): Promise<void> => {
    try {
        await handleLateFeeUpdate()
        res.status(200).json({ message: "Updated invoice successfully", })
    } catch (error) {
        console.log('SYNC CONTROLLER : Unexpected error:', error);
        const recipients: string[] = process.env.EMAIL_RECIPIENTS
            ? process.env.EMAIL_RECIPIENTS.split(',')
            : [];

        // Ensure error is defined before using it
        const errorMessage = (error instanceof Error && error.message) || "An unknown error occurred";
        const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));

        const sendEmail = `
<html>
    <body>
        <h1>Error found in update late fee manual call</h1>
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
                        Data: sendEmail,
                    },
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: 'Error in update late fee manual call',
                },
            },
            Source: process.env.SES_SENDER_EMAIL as string,
            ConfigurationSetName: 'promanager-config',
        };

        try {
            await ses.sendEmail(params).promise();
            console.log("Email successfully sent");
        } catch (emailError) {
            console.error("Error sending email:", JSON.stringify(emailError, Object.getOwnPropertyNames(emailError)));
        }

        // Send response to the client
        res.status(500).json({ message: 'Internal Server Error' });

    }
}


export const updateContactsDetailsManually = async (req: Request, res: Response): Promise<void> => {
    try {
        await updateContactsData()
        res.status(200).json({ message: "Updated contacts successfully", })
    } catch (error) {
        console.log('SYNC CONTROLLER : Unexpected error:', error);

        // Retrieve recipients from environment variable
        const recipients: string[] = process.env.EMAIL_RECIPIENTS
            ? process.env.EMAIL_RECIPIENTS.split(',')
            : [];

        // Capture specific error message and details
        const errorMessage = (error instanceof Error && error.message) || "An unknown error occurred";
        const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));

        const sendEmail = `
<html>
    <body>
        <h1>Error found in update contacts manual call</h1>
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
                        Data: sendEmail,
                    },
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: 'Error in update contacts manual call',
                },
            },
            Source: process.env.SES_SENDER_EMAIL as string,
            ConfigurationSetName: 'promanager-config',
        };

        try {
            await ses.sendEmail(params).promise();
            console.log("Email successfully sent");
        } catch (sendError) {
            console.error("Error sending email:", sendError);
        }

        // Respond with a 500 status code and an internal server error message
        res.status(500).json({ message: 'Internal Server Error' });

    }
}