import { AxiosError } from "axios";
import axiosSimPRO from "../../config/axiosSimProConfig";
import { SimproCustomerType, SimproJobType, SimproScheduleType } from "../../types/simpro.types";
import { fetchSimproPaginatedData } from "./simproPaginationService";
import moment from "moment";

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
            let jobIdsToFilter: number[] = []
            // Fetch job information sequentially
            for (let i = 0; i < fetchedSimproSchedulesData.length; i++) {
                const schedule = fetchedSimproSchedulesData[i];
                let jobIdForSchedule = schedule?.Reference?.split('-')[0];
                let costCenterIdForSchedule = schedule?.Reference?.split('-')[1];
                if (jobIdForSchedule) {
                    try {
                        // console.log("Fetching job for schdule " + jobIdForSchedule + ' at index', i, " of ", fetchedSimproSchedulesData.length)
                        const jobDataForSchedule = await axiosSimPRO.get(`/jobs/${jobIdForSchedule}?columns=ID,Type,Site,SiteContact,DateIssued,Status,Total,Customer,Name,ProjectManager,CustomFields`);
                        let fetchedJobData: SimproJobType = jobDataForSchedule?.data;
                        let jobTradeValue = fetchedJobData?.CustomFields?.find(field => field?.CustomField?.Name === "Job Trade (ie, Plumbing, Drainage, Roofing)")?.Value;
                        if (jobTradeValue !== 'Roofing') {
                            jobIdsToFilter.push(fetchedJobData.ID)
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

                if (costCenterIdForSchedule && !jobIdsToFilter.includes(parseInt(jobIdForSchedule))) {
                    try {
                        const costCenterDataForSchedule = await axiosSimPRO.get(`/jobCostCenters/?ID=${costCenterIdForSchedule}&columns=ID,Name,Job,Section`);
                        let sectionIdForSchedule =
                            Array.isArray(costCenterDataForSchedule?.data)
                                ? costCenterDataForSchedule.data[0]?.Section?.ID
                                : null;

                        let jobIdForScheduleFetched =
                            Array.isArray(costCenterDataForSchedule?.data)
                                ? costCenterDataForSchedule.data[0]?.Job?.ID
                                : null;

                        try {
                            let costCenterResponse = await axiosSimPRO.get(`jobs/${jobIdForScheduleFetched}/sections/${sectionIdForSchedule}/costCenters/${costCenterIdForSchedule}?columns=Name,ID,Claimed`);
                            if (costCenterResponse) {
                                schedule.CostCenter = costCenterResponse.data;
                            }
                        } catch (error) {
                            console.log("Error in costCenterFetch : ", error)
                        }
                    } catch (error) {
                        console.error(`Error fetching cost center data for schedule ID: ${costCenterIdForSchedule}`, error);
                    }
                }


            }

            console.log('jobsToFilter Length: ', jobIdsToFilter.length)
            console.log('Current schedule Length: ', fetchedSimproSchedulesData.length)
            fetchedSimproSchedulesData = fetchedSimproSchedulesData.filter(schedule =>
                !jobIdsToFilter.includes(schedule?.Job?.ID ?? -1)
            );
            console.log('Filtered schedule Length: ', fetchedSimproSchedulesData.length)
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

export const fetchScheduleMinimal = async () => {
    try {
        const currentDate = moment().subtract(2, 'day').format("YYYY-MM-DD");
        const url = `/schedules/?Type=job&Date=gt(${currentDate})&pageSize=100`;
        let fetchedSimproSchedulesData: SimproScheduleType[] = await fetchSimproPaginatedData(url, "ID,Type,Reference,Staff,Date,Blocks,Notes");
        return fetchedSimproSchedulesData;
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
