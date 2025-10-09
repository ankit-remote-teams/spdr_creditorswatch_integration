import cron from 'node-cron';
import axios from 'axios';

// Schedule a task to run every 1 minute
cron.schedule('*/1 * * * *', async () => {
  console.log('Running a task every 1 minute');

  try {
    const response = await axios.get(
      'https://n8n-vv13.onrender.com/webhook/5e56a263-3a40-44bd-bc9d-1cfb3bc2a87d/chat'
    );
    // console.log('Response:', response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios Error for RT:', error.message);
    } else {
      console.error('Unexpected Error for RT:', error);
    }
  }
});
