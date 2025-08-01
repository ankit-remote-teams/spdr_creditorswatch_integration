import { AxiosError } from 'axios';
import { Request, Response } from 'express';
import { fetchBatchSimproPaginatedData, fetchSimproPaginatedData } from '../services/SimproServices/simproPaginationService';
import moment from 'moment';
import {
    SimproAccountType,
    SimproCustomerType,
    SimproJobCostCenterType,
    SimproJobType,
    SimproLeadType,
    SimproQuotationType,
    SimproScheduleType,
    SimproWebhookType
} from '../types/simpro.types';
import axiosSimPRO from '../config/axiosSimProConfig';
import {
    addJobCardDataToSmartsheet,
    addOpenQuotesDataToSmartsheet,
    addOpenLeadsDataToSmartsheet,
    addMinimalJobCardDataToSmartsheet,
    addJobRoofingDetailsToSmartSheet
} from './smartSheetController';
import { fetchScheduleData, fetchScheduleMinimal } from '../services/SimproServices/simproScheduleService';
import { fetchSimproQuotationData } from '../services/SimproServices/simproQuotationService';
import { fetchSimproLeadsData } from '../services/SimproServices/simproLeadsService';
import { simproWebhookQueue } from '../queues/queue';
const jobCardReportSheetId = process.env.JOB_CARD_SHEET_ID ? process.env.JOB_CARD_SHEET_ID : "";
const jobCardV2SheetId = process.env.JOB_CARD_SHEET_V2_ID ? process.env.JOB_CARD_SHEET_V2_ID : "";
const jobCardRoofingDetailSheetId = process.env.JOB_CARD_SHEET_ROOFING_DETAIL_ID ? process.env.JOB_CARD_SHEET_ROOFING_DETAIL_ID : "";


const validateSimproToken = async () => {
    try {
        await axiosSimPRO.get('/setup/accounts/chartOfAccounts/?pageSize=1');
        return true;
    } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 401) {
            console.error('SimPRO V2 token validation failed. Please check SIMPRO_ACCESS_TOKEN_V2');
            return false;
        }
        throw err;
    }
};


export const fetchScheduleDataForExistingScheduleIds = async (scheduleIds: number[], fetchType: string) => {
    try {
        let fetchedChartOfAccounts = await axiosSimPRO.get('/setup/accounts/chartOfAccounts/?pageSize=250&columns=ID,Name,Number');
        let chartOfAccountsArray: SimproAccountType[] = fetchedChartOfAccounts?.data;
        console.log('Fetching existing schedule', JSON.stringify(scheduleIds))
        const allCustomerData: SimproCustomerType[] = await fetchSimproPaginatedData('/customers/', "");
        console.log("Fetched all customers for existing schedule ids")
        const simproCustomerMap: { [key: string]: SimproCustomerType } = {};
        let scheduleIdToMarkDeleted: string[] = [];
        let scheduleDataFromSimpro: SimproScheduleType[] = [];

        if (allCustomerData.length > 0) {
            // Fetching customer data sequentially
            for (const customer of allCustomerData) {
                const hrefForCustomerData = customer?._href;
                if (!hrefForCustomerData) continue;

                let customerUrl = hrefForCustomerData.split('customers')[1];
                if (!customerUrl) continue;

                try {
                    let customerDataForJob: SimproCustomerType;
                    if (customerUrl.includes('companies')) {
                        const customerResponse = await axiosSimPRO.get(`/customers${customerUrl}?columns=ID,CompanyName,Phone,Address,Email`);
                        customerDataForJob = { ...customerResponse.data, Type: "Company" };
                    } else {
                        const customerResponse = await axiosSimPRO.get(`/customers${customerUrl}?columns=ID,GivenName,FamilyName,Phone,Address,Email`);
                        customerDataForJob = { ...customerResponse.data, Type: "Individual" };
                    }
                    if (customerDataForJob?.ID) {
                        simproCustomerMap[customerDataForJob.ID.toString()] = customerDataForJob;
                    }
                } catch (error) {
                    console.error("Error fetching customer data for:", customer.ID, error);
                }
            }
        }

        let jobIdsToAddArray: number[] = []

        for (let i = 0; i < scheduleIds.length; i++) {
            try {
                // console.log('Fetch schedules ', i, 'of ', scheduleIds.length, "schdules")
                let individualScheduleResponse = await axiosSimPRO(`/schedules/${scheduleIds[i]}?columns=ID,Type,Reference,Staff,Date,Blocks,Notes`)
                scheduleDataFromSimpro.push(individualScheduleResponse.data)
            } catch (err) {
                if (err instanceof AxiosError) {
                    console.log("Error in fetchScheduleDataForExistingScheduleIds as AxiosError");
                    console.log("Error details: ", err.response?.data);
                    const errors = err?.response?.data?.errors;

                    if (Array.isArray(errors)) {
                        errors.forEach((errorItem: any) => {
                            if (errorItem?.message === "Schedule not found.") {
                                const url: string = err?.request?.path || "";
                                console.log('url', url);
                                const parts = url.split('/');
                                const scheduleId = parts.length ? parts[parts.length - 1].split('?')[0] : "";
                                console.log('scheduleId added to be marked as deleted', scheduleId);
                                if (scheduleId) {
                                    scheduleIdToMarkDeleted.push(scheduleId);
                                }
                            }
                        });
                    } else {
                        throw {
                            message: "Invalid scheduleID"
                        }
                    }

                } else {
                    console.log("Error in fetchScheduleDataForExistingScheduleIds as other error");
                    console.log("Error details: ", err);
                    throw {
                        message: "Error fetching individual schedule from Simpro API"
                    }
                }

            }
        }
        if (fetchType == "full") {
            for (let i = 0; i < scheduleDataFromSimpro.length; i++) {
                const schedule = scheduleDataFromSimpro[i];
                let jobIdForSchedule = schedule?.Reference?.split('-')[0];
                let costCenterIdForSchedule = schedule?.Reference?.split('-')[1];
                if (jobIdForSchedule) {
                    try {
                        // console.log("Fetching job for schdule " + jobIdForSchedule + ' at index', i, " of ", scheduleDataFromSimpro.length)
                        const jobDataForSchedule = await axiosSimPRO.get(`/jobs/${jobIdForSchedule}?columns=ID,Type,Site,SiteContact,DateIssued,Status,Total,Customer,Name,ProjectManager,CustomFields`);
                        let fetchedJobData: SimproJobType = jobDataForSchedule?.data;
                        let siteId = fetchedJobData?.Site?.ID;
                        if (siteId) {
                            const siteResponse = await axiosSimPRO.get(`/sites/${siteId}?columns=ID,Name,Address`);
                            let siteResponseData = siteResponse.data;
                            fetchedJobData.Site = siteResponseData;
                        }
                        // let jobTradeValue = fetchedJobData?.CustomFields?.find(field => field?.CustomField?.Name === "Job Trade (ie, Plumbing, Drainage, Roofing)")?.Value;
                        // if (jobTradeValue == 'Roofing') {
                        //     jobIdsToAddArray.push(fetchedJobData.ID)
                        // }
                        schedule.Job = fetchedJobData;

                        if (schedule?.Job?.Customer) {
                            const customerId = schedule.Job.Customer.ID?.toString();
                            if (customerId && simproCustomerMap[customerId]) {
                                schedule.Job.Customer = simproCustomerMap[customerId];
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching job data for schedule ID: ${jobIdForSchedule}`, error);
                    }
                }

                if (costCenterIdForSchedule) {
                    try {
                        const costCenterDataForSchedule = await axiosSimPRO.get(`/jobCostCenters/?ID=${costCenterIdForSchedule}&columns=ID,Name,Job,Section,CostCenter`);
                        let sectionIdForSchedule =
                            Array.isArray(costCenterDataForSchedule?.data)
                                ? costCenterDataForSchedule.data[0]?.Section?.ID
                                : null;

                        let jobIdForScheduleFetched =
                            Array.isArray(costCenterDataForSchedule?.data)
                                ? costCenterDataForSchedule.data[0]?.Job?.ID
                                : null;

                        let setupCostCenterID = costCenterDataForSchedule.data[0]?.CostCenter?.ID;
                        let fetchedSetupCostCenterData = await axiosSimPRO.get(`/setup/accounts/costCenters/${setupCostCenterID}?columns=ID,Name,IncomeAccountNo`);
                        let setupCostCenterData = fetchedSetupCostCenterData.data;
                        if (setupCostCenterData?.IncomeAccountNo) {
                            let incomeAccountName = chartOfAccountsArray?.find(account => account?.Number == setupCostCenterData?.IncomeAccountNo)?.Name;
                            if (incomeAccountName == "Roofing Income") {
                                console.log('CostCenterId For Roofing Income 5', costCenterIdForSchedule, jobIdForScheduleFetched)
                                jobIdsToAddArray.push(jobIdForScheduleFetched)
                            }
                        }
                        try {
                            let costCenterResponse = await axiosSimPRO.get(`jobs/${jobIdForScheduleFetched}/sections/${sectionIdForSchedule}/costCenters/${costCenterIdForSchedule}?columns=Name,ID,Claimed`);
                            if (costCenterResponse) {
                                schedule.CostCenter = costCenterResponse.data;
                                console.log("Success fetch for job and costcenter", jobIdForSchedule, costCenterIdForSchedule)
                            }
                        } catch (error) {
                            console.log("Error in costCenterFetch : ", error)
                        }
                    } catch (error) {
                        console.error(`Error fetching cost center data for schedule ID: ${costCenterIdForSchedule}`, error);
                    }
                }
            }
        }

        console.log('jobsToFilter Length: ', jobIdsToAddArray.length)
        console.log('Current schedule Length: ', scheduleDataFromSimpro.length)
        scheduleDataFromSimpro = scheduleDataFromSimpro.filter(schedule =>
            jobIdsToAddArray.includes(schedule?.Job?.ID ?? -1)
        );
        console.log('Filtered schedule Length: ', scheduleDataFromSimpro.length)


        return {
            scheduleDataFromSimpro,
            scheduleIdToMarkDeleted
        }
    } catch (err) {
        console.error("Error fetchScheduleDataForExistingScheduleIds data:", err);
    }
}



export const getJobCardReport = async (req: Request, res: Response) => {
    try {
        console.log("Fetch started for new data")
        let fetchedSimproSchedulesData: SimproScheduleType[] = await fetchScheduleData();
        console.log("fetch completed for new data")

        console.log("Adding new records to smartsheet through manual api trigger for sheet v1", jobCardV2SheetId)
        let responseOneFromSmartsheet = await addJobCardDataToSmartsheet(fetchedSimproSchedulesData, jobCardV2SheetId.toString());


        console.log("Adding new records to smartsheet through manual api trigger for sheet v2")
        let responseTwoFromSmartsheet = await addJobCardDataToSmartsheet(fetchedSimproSchedulesData, jobCardV2SheetId);


        console.log("Completed: Adding new records to smartsheet")

        if (responseOneFromSmartsheet?.status && responseTwoFromSmartsheet?.status) { // original code
            // if (responseOneFromSmartsheet?.status) {
            res.status(200).json({ fetchedSimproSchedulesData });
        } else {
            throw {
                message: "Something went wrong"
            }
        }
    } catch (err) {
        if (err instanceof AxiosError) {
            console.log("Error in getJobCardReport as AxiosError");
            console.log("Error details: ", err.response?.data);
            res.status(err.response?.status || 500).send({
                message: 'Error from Axios request',
                details: err.response?.data
            });
        } else {
            console.log("Error in getJobCardReport as other error");
            console.log("Error details: ", err);
            res.status(500).send({
                message: `Internal Server Error : ${JSON.stringify(err)}`
            });
        }
    }
};


export const fetchOnGoingQuotesData = async () => {
    try {
        const url = `/quotes/?Status=OnGoing&columns=ID,Customer,DateIssued,Total,Status`;
        const ongoingQuotesData = await fetchSimproPaginatedData(url, "ID,Customer,DateIssued,Total,Status");
        return ongoingQuotesData;
    } catch (err) {
        console.log("Error in fetchOnGoingQuotesData:", err);
        throw { message: `Internal Server Error in fetching on-going quotes data : ${JSON.stringify(err)}` }
    }
}



// Code for ongoing quotation 
export const getQuotationReport = async (req: Request, res: Response) => {
    try {
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
            res.status(200).json({ message: "Successfully updated the quotation and leads data" });
        } else {
            throw {
                message: "Something went wrong"
            }
        }
    } catch (err) {
        if (err instanceof AxiosError) {
            console.log("Error in getJobCardReport as AxiosError");
            console.log("Error details: ", err.response?.data);
            res.status(err.response?.status || 500).send({
                message: 'Error from Axios request',
                details: err.response?.data
            });
        } else {
            console.log("Error in getJobCardReport as other error");
            console.log("Error details: ", err);
            res.status(500).send({
                message: `Internal Server Error : ${JSON.stringify(err)}`
            });
        }
    }
};



export const getMinimalJobReport = async (req: Request, res: Response) => {
    try {
        console.log("Fetch started for new data")
        let fetchedSimproSchedulesData: SimproScheduleType[] = await fetchScheduleMinimal();
        console.log("fetch completed for new data")

        console.log("Adding new records to smartsheet through manual api trigger for sheet v1")
        await addMinimalJobCardDataToSmartsheet(fetchedSimproSchedulesData, jobCardReportSheetId, "minimal");
        // let responseOneFromSmartsheet = await addJobCardDataToSmartsheet(fetchedSimproSchedulesData, jobCardReportSheetId);


        console.log("Adding new records to smartsheet through manual api trigger for sheet v2")
        // let responseTwoFromSmartsheet = await addJobCardDataToSmartsheet(fetchedSimproSchedulesData, jobCardV2SheetId);


        console.log("Completed: Adding new records to smartsheet")

        // if (responseOneFromSmartsheet?.status && responseTwoFromSmartsheet?.status) {
        res.status(200).json({ fetchedSimproSchedulesData });
        // } else {
        //     throw {
        //         message: "Something went wrong"
        //     }
        // }
    } catch (err) {
        if (err instanceof AxiosError) {
            console.log("Error in getJobCardReport as AxiosError");
            console.log("Error details: ", err.response?.data);
            res.status(err.response?.status || 500).send({
                message: 'Error from Axios request',
                details: err.response?.data
            });
        } else {
            console.log("Error in getJobCardReport as other error");
            console.log("Error details: ", err);
            res.status(500).send({
                message: `Internal Server Error : ${JSON.stringify(err)}`
            });
        }
    }
};


export const simproWebhookHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('POST /simpro/webhooks', req.body);
        const webhookData: SimproWebhookType = req.body;

        await simproWebhookQueue.add({ webhookData })

        // if (webhookData.ID === "job.schedule.created" || webhookData.ID === "job.schedule.updated") {
        //     console.log("Schedule Create ", webhookData);
        //     await SmartsheetService.handleAddUpdateScheduleToSmartsheet(webhookData);
        // } else if (webhookData.ID === "job.schedule.deleted") {
        //     console.log("Schedule Deleted ", webhookData);
        //     await SmartsheetService.handleDeleteScheduleInSmartsheet(webhookData);
        // }

        // Send successful response
        res.status(200).json({ message: "Simpro webhook processed successfully" });

    } catch (err) {
        // Handle AxiosError specifically
        if (err instanceof AxiosError) {
            console.error("Error during Axios request:", err.response?.data);
            res.status(err.response?.status || 500).send({
                message: 'Error from Axios request',
                details: err.response?.data
            });
        } else {
            // General error handling
            console.error("Internal Server Error:", err);
            res.status(500).send({
                message: `Internal Server Error : ${JSON.stringify(err)}`
            });
        }
    }
}

export const updateExistingSheetDataForSchedules = async (req: Request, res: Response): Promise<void> => {
    try {

    } catch (err: any) {
        if (err instanceof AxiosError) {
            console.error("Error during Axios request:", err.response?.data);
            res.status(err.response?.status || 500).send({
                message: 'Error from Axios request',
                details: err.response?.data
            });
        } else {
            // General error handling
            console.error("Internal Server Error:", err);
            res.status(500).send({
                message: `Internal Server Error : ${JSON.stringify(err)}`
            });
        }
    }
}

export const fetchJobCostCenterDetail = async (req: Request, res: Response) => {
    try {
        const startTime = moment().unix();
        console.log(`JOB CostCenter detail : Task executed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

        console.log("JOB CostCenter detail SCHEDULER : Fetch started for new data");
        const incomeAccountName = req.params.incomeAccount;

        switch (incomeAccountName) {
            case 'roofingincome': {
                console.log("JOBCARD detail SCHEDULER : Fetch started for new data");
                // Await the whole process, including all batches and Smartsheet writes
                await fetchDataCostCenters([], 'full', async (costCenterIdToMarkDeleted: string[], costCenterDataFromSimpro: SimproJobCostCenterType[], pageNum: number, totalPages: number) => {
                    console.log(`JOBCARD detail SCHEDULER : fetch completed for new data, page ${pageNum} of ${totalPages}`);
                    console.log("JOBCARD SCHEDULER : Adding new records to smartsheet for sheet roofing, batch:", pageNum);
                    await addJobRoofingDetailsToSmartSheet(costCenterDataFromSimpro, jobCardRoofingDetailSheetId);
                });
                res.status(200).json({ message: "Successfully updated JOB CostCenter roofing income detail" });
                break;
            }
            default:
                res.status(400).json({ message: "Invalid income account name" });
                break;
        }
        console.log("Time taken to fill the sheet in ms", (moment().unix() - startTime));
    } catch (err) {
        console.error('Error in job card scheduler:', err);
        if (err instanceof AxiosError) {
            res.status(err.response?.status || 500).json({
                message: "Error in job card scheduler",
                error: err.response?.data
            });
        } else {
            res.status(500).json({
                message: "Error in job card scheduler",
                error: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    }
};

console.log('process.env.SIMPRO_ACCESS_TOKEN_V2', process.env.SIMPRO_ACCESS_TOKEN_V2);

export const fetchActiveJobs = async (): Promise<SimproJobType[]> => {
    try {
        console.log("Fetching active jobs from SimPRO");

        const url = `/jobs/?Stage=ne(Archived)&pageSize=250`;
        const columns = "ID,Type,Site,SiteContact,DateIssued,Status,Total,Customer,Name,ProjectManager,CustomFields,Totals,Stage";

        const allJobs: SimproJobType[] = await fetchSimproPaginatedData(url, columns);

        console.log(`✅ Fetched ${allJobs.length} active jobs from SimPRO`);
        return allJobs;

    } catch (err) {
        console.error("Error fetching active jobs from SimPRO:", err);
        throw {
            message: `Internal Server Error in fetching active jobs data : ${JSON.stringify(err)}`
        };
    }
};

export const fetchDataCostCenters = async (
    costCenters: SimproJobCostCenterType[],
    fetchType: string,
    callback: (costCenterIdToMarkDeleted: string[], costCenterDataFromSimpro: SimproJobCostCenterType[], pageNum: number, totalPages: number) => Promise<void>
) => {
    try {
        if (fetchType == "full") {
            const isTokenValid = await validateSimproToken();
            if (!isTokenValid) {
                throw new Error('Invalid or expired SimPRO token - please check SIMPRO_ACCESS_TOKEN');
            }
            let fetchedChartOfAccounts = await axiosSimPRO.get('/setup/accounts/chartOfAccounts/?pageSize=250&columns=ID,Name,Number');
            let chartOfAccountsArray: SimproAccountType[] = fetchedChartOfAccounts?.data;
            let validJobs = await fetchActiveJobs();

            if (!costCenters || costCenters.length == 0) {
                const url = `/jobCostCenters/?pageSize=250`;
                // Sequentially process each batch and await the callback
                return fetchBatchSimproPaginatedData(
                    url,
                    "ID,CostCenter,Name,Job,Section,DateModified,_href",
                    async (fetchedCostCenters: SimproJobCostCenterType[], pageNum: number, totalPages: number) => {
                        await getCostCentersData(
                            fetchedCostCenters,
                            chartOfAccountsArray,
                            validJobs,
                            async (costCenterIdToMarkDeleted: string[], costCenterDataFromSimpro: SimproJobCostCenterType[]) => {
                                console.log(`Completed fetch of roofing job details for page ${pageNum} of ${totalPages}`);
                                // Await the callback for each batch
                                await callback(costCenterIdToMarkDeleted, costCenterDataFromSimpro, pageNum, totalPages);
                            }
                        );
                    }
                );
            } else {
                // If costCenters are provided, process them as a single batch
                return getCostCentersData(
                    costCenters,
                    chartOfAccountsArray,
                    validJobs,
                    async (costCenterIdToMarkDeleted: string[], costCenterDataFromSimpro: SimproJobCostCenterType[]) => {
                        await callback(costCenterIdToMarkDeleted, costCenterDataFromSimpro, 1, 1);
                    }
                );
            }
        }
    } catch (err) {
        if (err instanceof AxiosError) {
            console.log("Error in fetchScheduleData as AxiosError");
            console.log("Error details: ", err.response?.data);
            const errorResponse = {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            };
            throw new Error("Something went wrong while fetching schedule data : " + JSON.stringify(errorResponse));
        } else {
            console.log("Error in fetchScheduleData as other error");
            console.log("Error details: ", err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            throw new Error(`Internal Server Error in fetching schedule data: ${errorMessage}`);
        }
    }
};

export const getCostCentersData = async (costCenters: SimproJobCostCenterType[], chartOfAccountsArray: SimproAccountType[], validJobs: SimproJobType[], callback: any) => {
    let costCenterIdToMarkDeleted: string[] = [];
    let costCenterDataFromSimpro: SimproJobCostCenterType[] = [];
    let index = 0;
    for (const jobCostCenter of costCenters) {
        console.log("Processing job cost center: ", jobCostCenter?.ID, " at index ", index, " of ", costCenters.length);
        const jobDataForCostCenter = validJobs.find(job => job.ID === jobCostCenter.Job.ID);
        // const jobDataForCostCenter = await axiosSimPRO.get(`/jobs/${jobCostCenter?.Job?.ID}?columns=ID,Type,Site,SiteContact,DateIssued,Status,Total,Customer,Name,ProjectManager,CustomFields,Totals,Stage`);
        // let fetchedJobData: SimproJobType = jobDataForCostCenter?.data;
        let fetchedJobData: SimproJobType | undefined = jobDataForCostCenter;
        if (fetchedJobData) {
            jobCostCenter.Job = fetchedJobData;
            try {
                const ccRecordId = jobCostCenter?.CostCenter?.ID;
                let fetchedSetupCostCenterData = await axiosSimPRO.get(`/setup/accounts/costCenters/${ccRecordId}?columns=ID,Name,IncomeAccountNo`);
                let setupCostCenterData = fetchedSetupCostCenterData.data;

                if (setupCostCenterData?.IncomeAccountNo) {
                    let incomeAccountName = chartOfAccountsArray?.find(account => account?.Number == setupCostCenterData?.IncomeAccountNo)?.Name;
                    if (incomeAccountName == "Roofing Income") {
                        console.log("Roofing income  2", jobCostCenter?.ID, jobCostCenter?.Job?.ID);
                        try {
                            const jcUrl = jobCostCenter?._href?.substring(jobCostCenter?._href?.indexOf('jobs'), jobCostCenter?._href.length);
                            let costCenterResponse: any = await axiosSimPRO.get(`${jcUrl}?columns=Name,ID,Claimed,Total,Totals`);
                            if (costCenterResponse) {
                                jobCostCenter.CostCenter = costCenterResponse.data;
                                jobCostCenter.ccRecordId = ccRecordId;

                                let exTaxAmount = 0;
                                if (costCenterResponse?.Claimed?.Remaining?.Amount?.ExTax) {
                                    exTaxAmount = parseFloat(costCenterResponse?.Claimed?.Remaining?.Amount?.ExTax);
                                }

                                if (!costCenterResponse?.Claimed || (!isNaN(exTaxAmount) && exTaxAmount > 0)) {
                                    console.log("Adding job cost center to data array: ", jobCostCenter?.ID, " at index ", index, " of ", costCenters.length);
                                    costCenterDataFromSimpro.push(jobCostCenter);
                                }

                            }
                        } catch (error) {
                            console.log("Error in costCenterFetch : ", error)
                        }
                    }
                }
            } catch (err) {
                if (err instanceof AxiosError) {
                    console.log("Error in fetch Const center from setup");
                    console.log("Error details: ", err.response?.data);
                    costCenterIdToMarkDeleted.push(jobCostCenter?.CostCenter?.ID.toString());
                } else if (err instanceof Error) {
                    console.error("Unexpected error:", err.message);
                } else {
                    console.error("Non-error rejection:", JSON.stringify(err));
                }
            }
        }
        index++;
    }
    callback(costCenterIdToMarkDeleted, costCenterDataFromSimpro);
}
