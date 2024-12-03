import { AxiosError } from "axios";
import { SimproLeadType } from "../../types/simpro.types";
import { fetchSimproPaginatedData } from "./simproPaginationService";

export const fetchSimproLeadsData = async () => {
    try {
        const allOpenLeadsData: SimproLeadType[] = await fetchSimproPaginatedData('/leads/?Stage=Open&pageSize=100', "ID,LeadName,Stage,Status,ProjectManager,Salesperson,Customer,FollowUpDate,DateCreated,Site,Tags,CustomFields");

        return allOpenLeadsData;
    } catch (err) {
        if (err instanceof AxiosError) {
            console.log("Error in fetchSimproLeadsData as AxiosError");
            console.log("Error details: ", err.response?.data);
            throw { message: "Something went wrong while fetching schedule data : " + JSON.stringify(err.response) }
        } else {
            console.log("Error in fetchSimproLeadsData as other error");
            console.log("Error details: ", err);
            throw { message: `Internal Server Error in fetching schedule data : ${JSON.stringify(err)}` }
        }
    }
}
