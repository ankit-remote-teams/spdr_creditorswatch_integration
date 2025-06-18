// /src/api/axiosSimPROConfig.ts
import axios, { AxiosInstance } from 'axios';
import rateLimit from 'axios-rate-limit';

// Create Axios instance for SimPRO API
const axiosSimPROV2: AxiosInstance = rateLimit(axios.create({
    baseURL: `${process.env.SIMPRO_BASE_URL}/companies/${process.env.SIMPRO_COMPANY_ID}`,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SIMPRO_ACCESS_TOKEN_V2}`,
    },
    timeout: 600000,
}), {
    maxRequests: 5,
    perMilliseconds: 1000
  });

// Request Interceptor
axiosSimPROV2.interceptors.request.use(
    (config) => {
        console.log('Request to SimPRO V2:', config.url);
        return config;
    },
    (error) => {
        console.log('Request error:', error);
        return Promise.reject(error);
    }
);

// Response Interceptor
axiosSimPROV2.interceptors.response.use(
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

export default axiosSimPROV2;
