// failedJobsEmailReporter.ts

import { simproWebhookQueue as queue } from '../queues/queue';
import cron from 'node-cron';
import dayjs from 'dayjs';
import path from 'path';
import { SendEmailCommandInput } from '@aws-sdk/client-ses';
import { sendEmailForNotification } from '../services/EmailService/emailService';

// === CONFIGURATION ===
const FROM_EMAIL = process.env.SES_SENDER_EMAIL;
const TO_EMAILS = (process.env.EMAIL_RECIPIENTS || '')
  .split(',')
  .map(email => email.trim())
  .filter(Boolean);
const QUEUE_NAME = 'simproWebhookQueue';

// === Fetch failed jobs from the last 24 hours ===
const fetchFailedJobsLast24Hours = async () => {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const failedJobs = [];

  const batchSize = 100;
  let start = 0;

  while (true) {
    const jobs = await queue.getFailed(start, start + batchSize - 1);
    if (!jobs.length) break;

    for (const job of jobs) {
      if (job.finishedOn && job.finishedOn >= since) {
        failedJobs.push({
          id: job.id,
          name: job.name,
          timestamp: dayjs(job.timestamp).format('YYYY-MM-DD HH:mm:ss'),
          failedReason: job.failedReason,
          data: JSON.stringify(job.data),
        });
      }
    }

    if (jobs.length < batchSize) break;
    start += batchSize;
  }

  return failedJobs;
};


// === Generate HTML table for the email body ===
const generateHtmlTable = (jobs: any[]) => {
  const rows = jobs
    .map(
      (job) => `
    <tr>
      <td>${job.id}</td>
      <td>${job.name}</td>
      <td>${job.timestamp}</td>
      <td>${job.failedReason}</td>
      <td><pre style="white-space: pre-wrap; word-break: break-word;">${job.data}</pre></td>
    </tr>`
    )
    .join('');

  return `
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
      <thead style="background-color: #f2f2f2;">
        <tr>
          <th>Job ID</th>
          <th>Name</th>
          <th>Timestamp</th>
          <th>Failed Reason</th>
          <th>Data</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

// === Send email with inline HTML table ===
const sendEmailWithTable = async (jobs: any[]) => {
  const htmlTable = generateHtmlTable(jobs);
  const params: SendEmailCommandInput = {
    Destination: {
      ToAddresses: TO_EMAILS,
    },
    Message: {
      Subject: {
        Data: `🚨 ${jobs.length} Failed Jobs in ${QUEUE_NAME} (Last 24 Hours)`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: `
            <p>Hello,</p>
            <p>There were <strong>${jobs.length}</strong> failed jobs in the <code>${QUEUE_NAME}</code> queue in the last 24 hours.</p>
            ${htmlTable}
            <p>Regards,<br/>Queue Monitor</p>
          `,
        },
      },
    },
    Source: FROM_EMAIL,
  };

  await sendEmailForNotification(params);
};

// === Main reporting logic ===
const processFailedJobsReport = async () => {
  console.log(`🔍 Checking failed jobs at ${new Date().toISOString()}`);

  const jobs = await fetchFailedJobsLast24Hours();

  if (!jobs.length) {
    console.log('✅ No failed jobs in the last 24 hours.');
    return;
  }


  await sendEmailWithTable(jobs);


  console.log('✅ Email with failed jobs table sent.');
};

export default processFailedJobsReport;

// === Schedule the cron job: every day at 8 AM ===
cron.schedule('0 4 * * *', async () => {
  console.log('🕗 Running scheduled failed jobs report...');
  await processFailedJobsReport();
});

console.log('✅ Cron job scheduled to run every day at 8 AM.');
