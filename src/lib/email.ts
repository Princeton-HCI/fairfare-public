import nodemailer from 'nodemailer';
import { supabase } from './server/db';
import { formatPhoneNumber } from './utils';

const transporter = nodemailer.createTransport({
  host: 'smtp.fastmail.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.VITE_SMTP_USER,
    pass: process.env.VITE_SMTP_PASS
  }
});

/**
 * Sender for every outgoing email. Self-hosted deployments set `SMTP_FROM` to
 * an address their SMTP provider is allowed to send as.
 */
const DEFAULT_SMTP_FROM = '"System" <organization@getsystem.org>';

const sendEmail = async (to: string, subject: string, text: string) => {
  try {
    let info;
    const { MODE } = import.meta.env;
    if (MODE === 'test' || MODE === 'development') {
      console.log(
        `[TEST / DEV MODE], mock sending email ${subject} to <${to}> with text: "${text}"`
      );
      info = { messageId: 'mock-message-id' };
    } else {
      info = await transporter.sendMail({
        from: process.env.SMTP_FROM || DEFAULT_SMTP_FROM,
        to,
        subject,
        text
      });
    }

    // NOTE: we don't save the text to the database since it's possible
    // that we leak sensitive information in the text, especially from
    // drivers that are opting out.
    await supabase.from('emails').insert({
      to,
      subject,
      status: 'sent',
      message_id: info.messageId
    });

    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    // save to db
    await supabase.from('emails').insert({
      to,
      subject,
      error: error instanceof Error ? error.message : JSON.stringify(error),
      status: 'failed',
      message_id: null
    });
    throw error;
  }
};

export const sendOrganizerAccountCreatedAlert = async (params: {
  phone: string;
  organizationKey: string;
  role: string;
  source: 'signup' | 'team' | 'admin';
}) => {
  const raw = process.env.ORGANIZER_ALERT_EMAILS ?? '';
  const recipients = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((email) => email.length > 0);

  if (recipients.length === 0) {
    throw new Error('ORGANIZER_ALERT_EMAILS is not configured');
  }

  const text = [
    'New organizer access was created.',
    `Organization: ${params.organizationKey}`,
    `Phone: ${formatPhoneNumber(params.phone)}`,
    `Role: ${params.role}`,
    `Source: ${params.source}`,
    `Created at: ${new Date().toISOString()}`
  ].join('\n');
  // Deliver to every recipient we can. The event is only considered failed
  // (and retried) when no recipient received it; otherwise one bad address
  // would re-send the alert to the good ones on every retry.
  const results = await Promise.allSettled(
    recipients.map((to) => sendEmail(to, '[System] New organizer account created', text))
  );
  const delivered = results.filter((result) => result.status === 'fulfilled').length;
  if (delivered === 0) {
    throw new Error('Organizer account alert was not delivered to any recipient');
  }
  if (delivered < recipients.length) {
    console.error('Organizer account alert was not delivered to every recipient', {
      delivered,
      recipients: recipients.length
    });
  }
};

export const sendOptOutEmailToAffiliateOrganization = async (
  to: string,
  userFirstName: string,
  userLastInitial: string,
  userPhoneNumber: string
) => {
  const optOutText = `This is a notification from System that a user who shared data with your organization has requested to have their data deleted. Their information is below:

First name: ${userFirstName}
Last initial: ${userLastInitial}
Phone number: ${formatPhoneNumber(userPhoneNumber)}

Please review your organization’s records and delete any of this user’s data.`;

  await sendEmail(to, '[Action Required] System Data Deletion Notification', optOutText);
};
