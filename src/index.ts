import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
const app = express();
app.use(express.json({ limit: '10mb' }));
import simproRoutes from './routes/simproRoute';
import creditorsWatchRoutes from './routes/creditorsWatchRoutes';
import smartSheetRoutes from './routes/smartSheetRoutes';

const PORT: number = parseInt(process.env.PORT as string, 10) || 6001;


if (process.env.NODE_ENV === 'production') {
    const cronJobs = [
        './cron/createUpdateContactsDataScheduler',
        './cron/createUpdateInvoiceCreditNoteScheduler',
        './cron/deleteDataScheduler',
        './cron/updateLateFeeScheduler',
        './cron/taskWorkingHourScheduler',
        './cron/jobCardScheduler',
        // './cron/jobCardMinimalUpdateScheduler',
        './cron/ongoingQuotationsAndLeadsScheduler',
    ];
    cronJobs.forEach(job => {
        require(job);
    });
}

// For local Development
// if (process.env.NODE_ENV === 'development') {
//     const cronJobs = [
//         './cron/ongoingQuotationsAndLeadsScheduler'
//     ];
//     cronJobs.forEach(job => {
//         require(job);
//     });
// }



app.use('/api/smartsheet', smartSheetRoutes);
app.use('/api/creditorswatch', creditorsWatchRoutes);
app.use('/api/simpro', simproRoutes);


app.get('/', (req: Request, res: Response) => {
    res.send('Server is running!!');
});

mongoose.connect(process.env.DB_URL as string).then(() => {
    console.log('MongoDB Connected...');
}).catch((error) => {
    console.log(error);
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
