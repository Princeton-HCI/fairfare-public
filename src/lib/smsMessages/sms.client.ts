import twilio from 'twilio';
import { PUB_VITE_TWILIO_SID } from '$env/static/public';
import { VITE_TWILIO_TOKEN } from '$env/static/private';

const smsClient = twilio(PUB_VITE_TWILIO_SID, VITE_TWILIO_TOKEN);

export { smsClient };
