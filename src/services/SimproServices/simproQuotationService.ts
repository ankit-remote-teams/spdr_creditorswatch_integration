import { AxiosError } from "axios";
import { SimproQuotationType } from "../../types/simpro.types";
import { fetchSimproPaginatedData } from "./simproPaginationService";

export const fetchSimproQuotationData = async () => {
    try {
        const allQuotationData: SimproQuotationType[] = await fetchSimproPaginatedData('/quotes/?IsClosed=false&pageSize=100', "ID,Name,ConvertedFromLead,Status,DateIssued,Salesperson,Customer,Site,Tags,DueDate,Total,Stage,CustomFields");
        return allQuotationData;
    } catch (err) {
        if (err instanceof AxiosError) {
            console.log("Error in fetchSimproQuotationData as AxiosError");
            console.log("Error details: ", err.response?.data);
            throw { message: "Something went wrong while fetching schedule data : " + JSON.stringify(err.response) }
        } else {
            console.log("Error in fetchSimproQuotationData as other error");
            console.log("Error details: ", err);
            throw { message: `Internal Server Error in fetching schedule data : ${JSON.stringify(err)}` }
        }
    }
}
