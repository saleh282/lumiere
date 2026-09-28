import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { HttpError } from '../utils/errors.js';

export function createMailer() {
  const ready = !!(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.APP_URL);
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = ready ? nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true
  }) : null;
  return {
    ready,
    async sendReset(email, token) {
      if (!ready) throw new HttpError(503, 'Password recovery email is not configured yet. Please contact the site owner.');
      const url = new URL(process.env.APP_URL);
      if (!['http:', 'https:'].includes(url.protocol) || (config.production && url.protocol !== 'https:')) throw new Error('Invalid APP_URL');
      url.hash = 'reset-password=' + token;
      await transport.sendMail({ from: process.env.MAIL_FROM, to: email, subject: 'Reset your Lumière password',
        text: `Reset your password using this link (valid for 30 minutes):\n\n${url.href}\n\nIf you did not request this, ignore this email.` });
    }
  };
}
