import { AxiosError } from 'axios';
import { Request, Response } from 'express';
import { fetchSimproPaginatedData } from '../services/simproService';
import moment from 'moment';
import { SimproCustomerType, SimproScheduleType } from '../types/simpro.types';
import axiosSimPRO from '../config/axiosSimProConfig';
import { addJobCardDataToSmartsheet } from './smartSheetController';


export const fetchScheduleDataForExistingScheduleIds = async (scheduleIds: number[]) => {
    try {
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

        for (let i = 0; i < scheduleIds.length; i++) {
            try {
                console.log('Fetch schedules ', i, 'of ', scheduleIds.length, "schdules")
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

        for (let i = 0; i < scheduleDataFromSimpro.length; i++) {
            const schedule = scheduleDataFromSimpro[i];
            let jobIdForSchedule = schedule?.Reference?.split('-')[0];
            let costCenterIdForSchedule = schedule?.Reference?.split('-')[1];
            if (jobIdForSchedule) {
                try {
                    console.log("Fetching job for schdule " + jobIdForSchedule + ' at index', i, " of ", scheduleDataFromSimpro.length)
                    const jobDataForSchedule = await axiosSimPRO.get(`/jobs/${jobIdForSchedule}?columns=ID,Type,Site,SiteContact,DateIssued,Status,Total,Customer,Name,ProjectManager,CustomFields`);
                    schedule.Job = jobDataForSchedule?.data;

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
                    console.log("Fetching cost centre for schdule " + jobIdForSchedule + ' at index', i, " of ", scheduleDataFromSimpro.length)
                    const costCenterDataForSchedule = await axiosSimPRO.get(`/jobCostCenters/?ID=${costCenterIdForSchedule}&columns=ID,Name`);
                    schedule.CostCenter = costCenterDataForSchedule?.data;
                } catch (error) {
                    console.error(`Error fetching cost center data for schedule ID: ${costCenterIdForSchedule}`, error);
                }
            }
        }

        return {
            scheduleDataFromSimpro,
            scheduleIdToMarkDeleted
        }
    } catch (err) {
        console.error("Error fetchScheduleDataForExistingScheduleIds data:", err);
    }
}

export const fetchScheduleData = async () => {
    try {
        const allCustomerData: SimproCustomerType[] = await fetchSimproPaginatedData('/customers/', "");
        const simproCustomerMap: { [key: string]: SimproCustomerType } = {};

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

        if (Object.keys(simproCustomerMap).length) {
            const currentDate = moment().subtract(2, 'day').format("YYYY-MM-DD");
            const url = `/schedules/?Type=job&Date=gt(${currentDate})&pageSize=100`;
            let fetchedSimproSchedulesData: SimproScheduleType[] = await fetchSimproPaginatedData(url, "ID,Type,Reference,Staff,Date,Blocks,Notes");

            // Fetch job information sequentially
            for (let i = 0; i < fetchedSimproSchedulesData.length; i++) {
                const schedule = fetchedSimproSchedulesData[i];
                let jobIdForSchedule = schedule?.Reference?.split('-')[0];
                let costCenterIdForSchedule = schedule?.Reference?.split('-')[1];
                if (jobIdForSchedule) {
                    try {
                        console.log("Fetching job for schdule " + jobIdForSchedule + ' at index', i, " of ", fetchedSimproSchedulesData.length)
                        const jobDataForSchedule = await axiosSimPRO.get(`/jobs/${jobIdForSchedule}?columns=ID,Type,Site,SiteContact,DateIssued,Status,Total,Customer,Name,ProjectManager,CustomFields`);
                        schedule.Job = jobDataForSchedule?.data;

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
                        const costCenterDataForSchedule = await axiosSimPRO.get(`/jobCostCenters/?ID=${costCenterIdForSchedule}&columns=ID,Name`);
                        schedule.CostCenter = costCenterDataForSchedule?.data;
                    } catch (error) {
                        console.error(`Error fetching cost center data for schedule ID: ${costCenterIdForSchedule}`, error);
                    }
                }
            }
            return fetchedSimproSchedulesData;
        } else {
            return [];
        }
    } catch (err) {
        if (err instanceof AxiosError) {
            console.log("Error in fetchScheduleData as AxiosError");
            console.log("Error details: ", err.response?.data);
            throw { message: "Something went wrong while fetching schedule data : " + JSON.stringify(err.response) }
        } else {
            console.log("Error in fetchScheduleData as other error");
            console.log("Error details: ", err);
            throw { message: `Internal Server Error in fetching schedule data : ${JSON.stringify(err)}` }
        }
    }
}


export const getJobCardReport = async (req: Request, res: Response) => {
    try {
        console.log("Fetch started for new data")
        let fetchedSimproSchedulesData: SimproScheduleType[] = await fetchScheduleData();
        console.log("fetch completed for new data")

        console.log("Adding new records to smartsheet")
        let responseFromSmartsheet = await addJobCardDataToSmartsheet(fetchedSimproSchedulesData);
        console.log("Completed: Adding new records to smartsheet")

        if (responseFromSmartsheet?.status) {
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


