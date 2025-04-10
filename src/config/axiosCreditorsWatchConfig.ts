import axios, { AxiosInstance } from 'axios';


const ORGANISATION_ID = process.env.CREDITORS_WATCH_API_ORGANISATION_ID;
const AUTH_TOKEN = process.env.CREDITORS_WATCH_API_TOKEN;
const USER_EMAIL = process.env.CREDITORS_WATCH_API_EMAIL;

const BASE_URL = `${process.env.CREDITORS_WATCH_BASE_URL}/organisations/${ORGANISATION_ID}`;

console.log("BAse URL for CreditorsWatch API: " + BASE_URL);

// Create the Axios instance
const axiosCreditorsWatch: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Context': 'app',
        'Accept': 'application/vnd.creditorwatchcollect.com.au; version=1',
        Authorization: `Token token="${AUTH_TOKEN}", email="${USER_EMAIL}"`,
    },
    timeout: 600000,
});

// Request Interceptor
axiosCreditorsWatch.interceptors.request.use(
    (config) => {
        // console.log('Request to CreditorsWatch:', config.url);
        return config;
    },
    (error) => {
        console.log('Request error:', error);
        return Promise.reject(error);
    }
);

// Response Interceptor
axiosCreditorsWatch.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.log('Unauthorized, possibly invalid token.');
        }
        if (error.response?.status === 429) {
            console.log('Rate limit exceeded.');
        }
        return Promise.reject(error);
    }
);

// Exporting the client to use it in other parts of the app
export default axiosCreditorsWatch;
