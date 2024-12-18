import { AxiosError } from 'axios';
import { Request, Response } from 'express';
import { fetchSimproPaginatedData } from '../services/SimproServices/simproPaginationService';
import moment from 'moment';
import {
    SimproAccountType,
    SimproCustomerType,
    SimproJobType,
    SimproLeadType,
    SimproQuotationType,
    SimproScheduleType
} from '../types/simpro.types';
import axiosSimPRO from '../config/axiosSimProConfig';
import {
    addJobCardDataToSmartsheet,
    addOpenQuotesDataToSmartsheet,
    addOpenLeadsDataToSmartsheet,
    addMinimalJobCardDataToSmartsheet
} from './smartSheetController';
import { fetchScheduleData, fetchScheduleMinimal } from '../services/SimproServices/simproScheduleService';
import { fetchSimproQuotationData } from '../services/SimproServices/simproQuotationService';
import { fetchSimproLeadsData } from '../services/SimproServices/simproLeadsService';
const jobCardReportSheetId = process.env.JOB_CARD_SHEET_ID ? process.env.JOB_CARD_SHEET_ID : "";
const jobCardV2SheetId = process.env.JOB_CARD_SHEET_V2_ID ? process.env.JOB_CARD_SHEET_V2_ID : "";


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
                        let jobTradeValue = fetchedJobData?.CustomFields?.find(field => field?.CustomField?.Name === "Job Trade (ie, Plumbing, Drainage, Roofing)")?.Value;
                        if (jobTradeValue == 'Roofing') {
                            jobIdsToAddArray.push(fetchedJobData.ID)
                        }
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

        console.log("Adding new records to smartsheet through manual api trigger for sheet v1")
        let responseOneFromSmartsheet = await addJobCardDataToSmartsheet(fetchedSimproSchedulesData, jobCardReportSheetId);


        console.log("Adding new records to smartsheet through manual api trigger for sheet v2")
        let responseTwoFromSmartsheet = await addJobCardDataToSmartsheet(fetchedSimproSchedulesData, jobCardV2SheetId);


        console.log("Completed: Adding new records to smartsheet")

        if (responseOneFromSmartsheet?.status && responseTwoFromSmartsheet?.status) {
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