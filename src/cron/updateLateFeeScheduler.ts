import moment from 'moment';
import { CreditorsWatchInvoiceType, InvoiceItemPaymentsType, MappingType, } from '../types/creditorswatch.types';
import { fetchSimproPaginatedData } from '../services/SimproServices/simproPaginationService';
import { transformInvoiceDataToCreditorsWatchArray } from '../utils/transformDataHelper';
import { calculateLatePaymentFeeAndBalanceDue } from '../utils/helper';
import { creditorsWatchPostWithRetry, creditorsWatchPutWithRetry } from '../services/CreditorsWatchServices/CreditorsWatchApiUtils';
const cron = require('node-cron');
import InvoiceMappingModel from '../models/invoiceMappingModel';
import { AxiosError } from 'axios';
import { SimproCustomerPaymentsType, SimproInvoiceType } from '../types/simpro.types';
import { sendEmailForNotification } from '../services/EmailService/emailService';

const defaultPercentageValueForLateFee: number = parseFloat(process.env.DEFAULT_LATE_FEE_PERCENTAGE_FOR_CUSTOMER_PER_YEAR || '0');

export const handleLateFeeUpdate = async () => {
    try {
        let simproInvoiceResponseArr: SimproInvoiceType[] = await fetchSimproPaginatedData<SimproInvoiceType>('/invoices/?IsPaid=false&pageSize=100', 'ID,Customer,Status,Stage,Total,IsPaid,DateIssued,DatePaid,DateCreated,PaymentTerms,LatePaymentFee,Type', '');

        if (!simproInvoiceResponseArr) {
            console.log('LATE FEE SCHEDULER : No invoices found to update late fee hours.');
            throw { message: 'No invoices found to update late fee hours.' }
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
        let simproIdToFetchFromMapping: string[] = [];
        simproInvoiceResponseArr.forEach(item => simproIdToFetchFromMapping.push(item.ID.toString()))
        const mappingData = await InvoiceMappingModel.find({ simproId: { $in: simproIdToFetchFromMapping } });
        if (mappingData.length) {
            let simproCWIDMap: { [key: string]: string } = {};
            mappingData.forEach(item => simproCWIDMap[item.simproId] = item.creditorsWatchId)
            creditorsWatchInvoiceDataArray.forEach(item => item.id = parseInt(simproCWIDMap[item.external_id]))
        }

        let dataToUpdate: CreditorsWatchInvoiceType[] = [];
        let dataToAdd: CreditorsWatchInvoiceType[] = [];

        creditorsWatchInvoiceDataArray.forEach(item => {
            if (item.id) {
                dataToUpdate.push(item);
            } else {
                dataToAdd.push(item);
            }
        })

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
                        dailyLateFeeRate = defaultPercentageValueForLateFee / 365;
                        let lateFee = calculateLatePaymentFeeAndBalanceDue(row)
                        let amount_due = (tempRow?.payments ? tempRow.payments.reduce((sub, payment) => sub - (payment.paymentInvoiceAmount + (payment?.lateFeeOnPayment || 0)), tempRow?.total_amount) : tempRow?.total_amount) + lateFee;
                        let amount_paid = tempRow?.payments ? tempRow.payments.reduce((sum, payment) => sum + (payment.paymentInvoiceAmount + (payment?.lateFeeOnPayment || 0)), 0) : 0;
                        tempRow = { ...tempRow, amount_due, amount_paid }
                    }
                }
                row = { ...tempRow }
                let creditorWatchID = row.id;
                delete row.id;
                delete row.LatePaymentFee;
                delete row.payments;

                const response = await creditorsWatchPutWithRetry(`/invoices/${creditorWatchID}`, { invoice: { ...row } });

                if (!response) {
                    console.log('LATE FEE SCHEDULER : Failed to update invoice late fee data after multiple attempts.');
                    continue;
                }

            } catch (error) {
                if (error instanceof AxiosError) {
                    console.log('LATE FEE SCHEDULER : Error syncing contact data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('LATE FEE SCHEDULER : Unexpected error:', error);
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
                    console.log('LATE FEE SCHEDULER : : Failed to add invoice data after multiple attempts.');
                    continue;
                }

                let creditorWatchContactData = response?.data?.invoice;
                if (!creditorWatchContactData) {
                    console.log('LATE FEE SCHEDULER : : Data unavailable to create mapping invoice.');
                    continue;
                }

                let newMapping: MappingType = {
                    simproId: creditorWatchContactData.external_id,
                    creditorsWatchId: String(creditorWatchContactData.id),
                    lastSyncedAt: new Date(),
                };

                let savedMapping = await InvoiceMappingModel.create(newMapping);
                console.log('LATE FEE SCHEDULER : : Mapping created:', savedMapping);

            } catch (error) {
                if (error instanceof AxiosError) {
                    console.log('LATE FEE SCHEDULER : : Error syncing invoice data:', error.response?.data || error.message);
                    throw { message: 'Error from Axios request', details: error.response?.data }
                } else {
                    console.log('LATE FEE SCHEDULER : : Unexpected error:', error);
                    throw error;
                }
            }
        }

    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('LATE FEE SCHEDULER : Error syncing invoice data:', error.response?.data || error.message);
            throw { message: 'Error from Axios request', details: error.response?.data }
        } else {
            // Generic error handling
            console.log('LATE FEE SCHEDULER : Unexpected error:', error);
            throw error;
        }
    }
}


cron.schedule(
    '0 19 * * *',
    async () => {
        // cron.schedule("0 9 * * *", async () => { Old code

        try {
            console.log(`LATE FEE SCHEDULER :  : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
            await handleLateFeeUpdate();
        } catch (err: any) {
            const recipients: string[] = process.env.EMAIL_RECIPIENTS
                ? process.env.EMAIL_RECIPIENTS.split(',')
                : [];

            // Ensure err is defined before using it
            const errorMessage = (err instanceof Error && err.message) || "An unknown error occurred";
            const errorDetails = JSON.stringify(err, Object.getOwnPropertyNames(err));

            const sendEmail = `
    <html>
        <body>
            <h1>Error found in update late fee scheduler</h1>
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
                        Data: 'Error in Update late fee scheduler',
                    },
                },
                Source: process.env.SES_SENDER_EMAIL as string,
                ConfigurationSetName: 'promanager-config',
            };

            try {
                await sendEmailForNotification(params);
                console.log("Email successfully sent");
            } catch (sendError) {
                console.error('Error sending email:', sendError);
                console.log("Failed to send email");
            }

        }
    }
    ,
    {
        timezone: 'Australia/Sydney',
    }
);
