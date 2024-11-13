import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
import syncRoutes from './routes/syncRoutes';
import smartSheetRoutes from './routes/smartSheetRoutes';
const app = express();
app.use(express.json());

const PORT: number = parseInt(process.env.PORT as string, 10) || 6001;


if (process.env.NODE_ENV === 'production') {
    const cronJobs = [
        './cron/createUpdateContactsDataScheduler',
        './cron/createUpdateInvoiceCreditNoteScheduler',
        './cron/deleteDataScheduler',
        './cron/updateLateFeeScheduler',
        './cron/taskWorkingHourScheduler',
    ];
    cronJobs.forEach(job => {
        require(job);
    });
}

// For local Development
// if (process.env.NODE_ENV === 'development') {
//     const cronJobs = [
//         './cron/taskWorkingHourScheduler',
//     ];
//     cronJobs.forEach(job => {
//         require(job);
//     });
// }



app.use('/api/smartsheet', smartSheetRoutes);
app.use('/api', syncRoutes);


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
