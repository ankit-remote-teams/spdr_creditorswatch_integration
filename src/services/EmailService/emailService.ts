import { SESClient, SendEmailCommand, SendEmailCommandInput } from "@aws-sdk/client-ses";

const sesClient = new SESClient({
  region: process.env.AWS_SDK_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

/**
 * Sends an email using AWS SES.
 * @param params - SendEmailCommandInput as defined by AWS SDK.
 */


export const sendEmailForNotification = async (params: SendEmailCommandInput): Promise<void> => {
  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log("✅ Email sent:", response.MessageId);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    throw error;
  }
};
