import { retryFailedJobsInLastHours } from "../queues/queue";
import { Request, Response } from 'express';

export const rerunFailedRedisJobs = async (req: Request, res: Response) => {
    try {
        const hoursParam = req.params.hours;
        const hours = parseInt(hoursParam, 10);
        if (isNaN(hours) || hours <= 0) {
            return res.status(400).json({ message: 'Invalid hours parameter. It must be a positive integer.' });
        }
        await retryFailedJobsInLastHours(hours);
        res.status(200).json({ message: `Retry process initiated for failed jobs in the last ${hours} hour(s).` });
    } catch (error) {
        console.error("Error in rerunFailedRedisJobs:", error);
        res.status(500).json({ message: 'Internal server error while retrying failed jobs.' });
    }
};