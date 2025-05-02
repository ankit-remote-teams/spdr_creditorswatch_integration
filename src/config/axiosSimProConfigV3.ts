// /src/api/axiosSimPROConfig.ts
import axios, { AxiosInstance } from 'axios';
import rateLimit from 'axios-rate-limit';

// Create Axios instance for SimPRO API
const axiosSimPROV3: AxiosInstance = rateLimit(axios.create({
    baseURL: `https://specialisedplumbing-uat.simprosuite.com/api/v1.0/companies/2`,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer 60e4b08da561150f17ec79c8ca7f41e524713543`,
    },
    timeout: 600000,
}), {
    maxRequests: 1,
    perMilliseconds: 1000
  });

// Request Interceptor
axiosSimPROV3.interceptors.request.use(
    (config) => {
        console.log('Request to SimPRO V3:', config.url);
        return config;
    },
    (error) => {
        console.log('Request error:', error);
        return Promise.reject(error);
    }
);

// Response Interceptor
axiosSimPROV3.interceptors.response.use(
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

export default axiosSimPROV3;
