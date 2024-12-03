const cron = require('node-cron');
import { AxiosError } from 'axios';
import InvoiceMappingModel from '../models/invoiceMappingModel';
import moment from 'moment';
import { fetchSimproPaginatedData } from '../services/SimproServices/simproPaginationService';
import { CreditorsWatchCreditNoteType, CreditorsWatchInvoiceType, InvoiceItemPaymentsType, MappingType, } from '../types/creditorswatch.types';
import { transformCreditNoteDataToCreditorsWatchArray, transformInvoiceDataToCreditorsWatchArray } from '../utils/transformDataHelper';
import { SimproCreditNoteType, SimproCustomerPaymentsType, SimproInvoiceType } from '../types/simpro.types';
import { creditorsWatchPostWithRetry, creditorsWatchPutWithRetry } from '../services/CreditorsWatchServices/CreditorsWatchApiUtils';
import { calculateLatePaymentFeeAndBalanceDue, get48HoursAgoDate } from '../utils/helper';
import CreditNoteMappingModel from '../models/creditNotesMappingModel';
import { ses } from '../config/awsConfig'


const defaultPercentageValueForLateFee: number = parseFloat(process.env.DEFAULT_LATE_FEE_PERCENTAGE_FOR_CUSTOMER_PER_YEAR || '0');

export const updateInvoiceData = async () => {
    try {
        //Comment start 
        const ifModifiedSinceHeader = get48HoursAgoDate();
        let simproInvoiceResponseArr: SimproInvoiceType[] = await fetchSimproPaginatedData<SimproInvoiceType>('/invoices/?pageSize=100', 'ID,Customer,Status,Stage,Total,IsPaid,DateIssued,DatePaid,DateCreated,PaymentTerms,LatePaymentFee,Type', ifModifiedSinceHeader);
        simproInvoiceResponseArr = simproInvoiceResponseArr.filter(invoice => invoice.Stage === "Approved" && invoice.Type != 'RequestForClaim')

        const oldestInvoice = simproInvoiceResponseArr.reduce((oldest, current) => {
            const currentDate = moment(current.DateCreated, 'YYYY-MM-DD');
            const oldestDate = moment(oldest.DateCreated, 'YYYY-MM-DD');
            return currentDate.isBefore(oldestDate) ? current : oldest;
        });

        const formattedDate = moment(oldestInvoice.DateCreated, 'YYYY-MM-DD').format('ddd, DD MMM YYYY HH:mm:ss [GMT]');

        let simproCustomerPaymentsResponse: SimproCustomerPaymentsType[] = await fetchSimproPaginatedData('/customerPayments/?pageSize=100', 'ID,Payment,Invoices', formattedDate);

        // Comment ends

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

        let creditorWatchInvoiceDataArray: CreditorsWatchInvoiceType[] = transformInvoiceDataToCreditorsWatchArray('Simpro', simproInvoiceResponseArr);

        let simproIdToFetchFromMapping: string[] = [];
        simproInvoiceResponseArr.forEach(item => simproIdToFetchFromMapping.push(item.ID.toString()))

        const mappingData = await InvoiceMappingModel.find({ simproId: { $in: simproIdToFetchFromMapping } });

        if (mappingData.length) {
            let simproCWIDMap: { [key: string]: string } = {};
            mappingData.forEach(item => simproCWIDMap[item.simproId] = item.creditorsWatchId)
            creditorWatchInvoiceDataArray.forEach(item => item.id = parseInt(simproCWIDMap[item.external_id]))
        }

        let dataToUpdate: CreditorsWatchInvoiceType[] = [];
        let dataToAdd: CreditorsWatchInvoiceType[] = [];

        creditorWatchInvoiceDataArray.forEach(item => {
            if (item.id) {
                dataToUpdate.push(item);
            } else {
                dataToAdd.push(item);
            }
        })

        //Code to update exiting data.
        for (let row of dataToUpdate) {
            try {
                let tempRow = { ...row };
                if (tempRow.LatePaymentFee) {
                    const dueDate = moment(tempRow.due_date, 'YYYY-MM-DD');
                    let daysLate: number;
                    const currentDate = moment();
                    let dailyLateFeeRate: number;

                    daysLate = moment(currentDate).diff(dueDate, 'days');
                    if (daysLate > 0) {
                        let amount_due;
                        let lateFee = calculateLatePaymentFeeAndBalanceDue(row)
                        if (tempRow?.payments) {
                            amount_due = tempRow.payments.reduce((sub, payment) => {
                                const paymentAmount = payment.paymentInvoiceAmount || 0;
                                const paymentLateFee = payment?.lateFeeOnPayment || 0;
                                const currentSub = sub - (paymentAmount + paymentLateFee);
                                return currentSub;
                            }, tempRow?.total_amount);
                        } else {
                            amount_due = tempRow?.total_amount;
                        }
                        // Add the calculated late fee
                        amount_due += lateFee;
                        // Calculate amount paid
                        let amount_paid;
                        if (tempRow?.payments) {
                            amount_paid = tempRow.payments.reduce((sum, payment) => {
                                const paymentAmount = payment.paymentInvoiceAmount || 0;
                                const paymentLateFee = payment?.lateFeeOnPayment || 0;
                                const currentSum = sum + (paymentAmount + paymentLateFee);
                                return currentSum;
                            }, 0);
                        } else {
                            amount_paid = 0;
                        }
                        tempRow = { ...tempRow, amount_due, amount_paid }
                    }
                }
                // console.log('Updated row', tempRow)
                row = { ...tempRow }

                let creditorWatchID = row.id;
                delete row.id;
                delete row.LatePaymentFee;
                delete row.payments;

                const response = await creditorsWatchPutWithRetry(`/invoices/${creditorWatchID}`, { invoice: { ...row } });

                if (!response) {
                    console.log('INVOICE SCHEDULER : Failed to update invoice data after multiple attempts.');
                    continue;
                }


            } catch (error) {
                console.log("Update invoice data failed", error)
                if (error instanceof AxiosError) {
                    console.log('INVOICE SCHEDULER : Error syncing invoice data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('INVOICE SCHEDULER : Unexpected error:', error);
                    throw error;
                }
            }
        }

        //Code to update add data.
        for (let row of dataToAdd) {
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

                const response = await creditorsWatchPostWithRetry(`/invoices`, { invoice: { ...row } });
                if (!response) {
                    console.log('INVOICE SCHEDULER : Failed to add invoice data after multiple attempts.');
                    continue;
                }

                let creditorWatchContactData = response?.data?.invoice;
                if (!creditorWatchContactData) {
                    console.log('INVOICE SCHEDULER : Data unavailable to create mapping invoice.');
                    continue;
                }


                let newMapping: MappingType = {
                    simproId: creditorWatchContactData.external_id,
                    creditorsWatchId: String(creditorWatchContactData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await InvoiceMappingModel.create(newMapping);
                console.log('INVOICE SCHEDULER : Mapping created:', savedMapping);

            } catch (error) {
                console.log("Update error invoice data: ", error);
                if (error instanceof AxiosError) {
                    console.log('INVOICE SCHEDULER : Error syncing invoice data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('INVOICE SCHEDULER : Unexpected error:', error);
                    throw error;
                }
            }
        }
        console.log("INVOICE SCHEDULER  : Invoice synced starting creditNote sync");
        await updateCreditNoteData(simproInvoiceResponseArr);


    } catch (error: any) {
        console.log("Error in invoice scheduler: ", error);
        if (error instanceof AxiosError) {
            console.log('INVOICE SCHEDULER : Error syncing invoice data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.log('INVOICE SCHEDULER : Unexpected error:', error);
            throw error;
        }
    }
}

const updateCreditNoteData = async (simproInvoiceResponseArr: SimproInvoiceType[]) => {
    try {
        const ifModifiedSinceHeader = get48HoursAgoDate();
        let simproCreditNoteResponseArr: SimproCreditNoteType[] = await fetchSimproPaginatedData<SimproCreditNoteType>('/creditNotes/', 'ID,Type,Customer,DateIssued,Stage,Total,InvoiceNo', ifModifiedSinceHeader);

        if (!simproCreditNoteResponseArr) {
            console.log('INVOICE SCHEDULER : No credit notes found to sync.');
            return [];
        }

        // let simproCreditNoteResponseArr: SimproCreditNoteType[] = simproCreditNoteData;

        simproCreditNoteResponseArr.forEach(item => {
            item.InvoiceData = simproInvoiceResponseArr.find(invoice => invoice.ID === item.InvoiceNo);
        })

        simproCreditNoteResponseArr = simproCreditNoteResponseArr.filter(item => item.InvoiceData)

        let creditorsWatchCreditNoteDataArray: CreditorsWatchCreditNoteType[] = transformCreditNoteDataToCreditorsWatchArray("Simpro", simproCreditNoteResponseArr);

        let simproIdToFetchFromMapping: string[] = [];
        simproCreditNoteResponseArr.forEach(item => simproIdToFetchFromMapping.push(item.ID.toString()))

        const mappingData = await CreditNoteMappingModel.find({ simproId: { $in: simproIdToFetchFromMapping } });

        if (mappingData.length) {
            let simproCWIDMap: { [key: string]: string } = {};
            mappingData.forEach(item => simproCWIDMap[item.simproId] = item.creditorsWatchId)
            creditorsWatchCreditNoteDataArray.forEach(item => item.id = parseInt(simproCWIDMap[item.external_id]))
        }

        let dataToUpdate: CreditorsWatchCreditNoteType[] = [];
        let dataToAdd: CreditorsWatchCreditNoteType[] = [];

        creditorsWatchCreditNoteDataArray.forEach(item => {
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
                const response = await creditorsWatchPutWithRetry(`/credit_notes/${creditorWatchID}`, { credit_note: { ...row } });
                if (!response) {
                    console.log('INVOICE SCHEDULER : Failed to update credit note data after multiple attempts.');
                    continue;
                }
            } catch (error) {
                console.log("Error in update credit note data:", error)
                if (error instanceof AxiosError) {
                    console.log('INVOICE SCHEDULER : Error syncing credit note data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('INVOICE SCHEDULER : Unexpected error:', error);
                    throw error;
                }
            }
        }

        //Code to update add data.
        for (const row of dataToAdd) {
            try {
                delete row.id;
                const response = await creditorsWatchPostWithRetry(`/credit_notes`, { credit_note: { ...row } });
                if (!response) {
                    console.log('INVOICE SCHEDULER : Failed to add credit note data after multiple attempts.');
                    continue;
                }

                let creditorWatchContactData = response?.data?.credit_note;
                if (!creditorWatchContactData) {
                    console.log('INVOICE SCHEDULER : Data unavailable to create mapping credit note.');
                    continue;
                }


                let newMapping: MappingType = {
                    simproId: creditorWatchContactData.external_id,
                    creditorsWatchId: String(creditorWatchContactData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await CreditNoteMappingModel.create(newMapping);
                console.log('INVOICE SCHEDULER : Mapping created:', savedMapping);

            } catch (error) {
                console.log("Error creating credit note in update credit note data", error);
                if (error instanceof AxiosError) {
                    console.log('INVOICE SCHEDULER : Error syncing credit note data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('INVOICE SCHEDULER : Unexpected error:', error);
                    throw error;
                }
            }
        }


    } catch (error: any) {
        console.log("Error in update credit note data in catch 2", error)
        if (error instanceof AxiosError) {
            console.log('INVOICE SCHEDULER : Error syncing creditnote data:', error.response?.data || error.message);
            throw { message: error.message, data: error?.response?.data }
        } else {
            console.log('INVOICE SCHEDULER : Unexpected error:', error);
            throw error;
        }
    }
}
console.log("For invoice schduler : ", moment(Date.now()).format("DD MMM YYYY HH:mm:ss"))

cron.schedule("0 11 * * *", async () => {
    try {
        console.log(`INVOICE SCHEDULER: Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        await updateInvoiceData();
    } catch (err: any) {
        const recipients: string[] = process.env.EMAIL_RECIPIENTS
            ? process.env.EMAIL_RECIPIENTS.split(',')
            : [];

        // Capture error details
        const errorMessage = (err instanceof Error && err.message) || "An unknown error occurred";
        const errorDetails = JSON.stringify(err, Object.getOwnPropertyNames(err));

        const sendEmail = `
<html>
    <body>
        <h1>Error found in update invoice creditnote scheduler</h1>
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
                    Data: 'Error in update invoice creditnote scheduler',
                },
            },
            Source: process.env.SES_SENDER_EMAIL as string,
            ConfigurationSetName: 'promanager-config',
        };

        try {
            const data = await ses.sendEmail(params).promise();
            console.log("Email successfully sent");
        } catch (sendError) {
            console.error('Error sending email:', sendError);
            console.log("Failed to send email");
        }

    }
});
