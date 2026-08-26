import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { logger } from 'firebase-functions';
import { getBranding } from './BrandingService.js';

/**
 * SMTP configuration lives in Firestore at settings/smtp.
 *
 * That path is denied to every client in firestore.rules — it is reachable only
 * through the Admin SDK here, so the password never travels to a browser. The
 * admin API returns the config with the password replaced by a flag, and only
 * overwrites it when a new one is explicitly supplied.
 */
const SETTINGS_COLLECTION = 'settings';
const SMTP_DOC = 'smtp';

const DEFAULTS = {
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    from_name: 'ZimRate',
    from_email: '',
    /** Where contact form submissions are delivered. */
    recipient: '',
    enabled: false,
};

function docRef() {
    return getFirestore().collection(SETTINGS_COLLECTION).doc(SMTP_DOC);
}

/** Full config including the password. Server-side use only. */
export async function getSmtpConfig() {
    const snapshot = await docRef().get();
    if (!snapshot.exists) return { ...DEFAULTS };
    return { ...DEFAULTS, ...snapshot.data() };
}

/** Config safe to send to an admin client: password replaced by a boolean. */
export async function getSmtpConfigForClient() {
    const { password, ...rest } = await getSmtpConfig();
    return { ...rest, password_set: Boolean(password) };
}

/**
 * Writes config. `password` is only persisted when a non-empty value is given,
 * so saving the form without retyping it keeps the stored one.
 */
export async function saveSmtpConfig(input) {
    const current = await getSmtpConfig();

    const next = {
        host: input.host ?? current.host,
        port: input.port ?? current.port,
        secure: input.secure ?? current.secure,
        username: input.username ?? current.username,
        password: input.password ? input.password : current.password,
        from_name: input.from_name ?? current.from_name,
        from_email: input.from_email ?? current.from_email,
        recipient: input.recipient ?? current.recipient,
        enabled: input.enabled ?? current.enabled,
        updated_at: new Date(),
    };

    await docRef().set(next, { merge: true });
    return next;
}

function buildTransport(config) {
    if (!config.host) throw new Error('SMTP host is not configured');

    return nodemailer.createTransport({
        host: config.host,
        port: Number(config.port) || 587,
        // `secure` means implicit TLS (usually port 465). STARTTLS on 587 is
        // negotiated automatically when this is false.
        secure: Boolean(config.secure),
        auth: config.username
            ? { user: config.username, pass: config.password }
            : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
    });
}

/**
 * Verifies the SMTP connection and credentials without sending anything.
 * Optionally delivers a test message so the admin can confirm end to end.
 */
export async function testSmtpConnection({ sendTo } = {}) {
    const config = await getSmtpConfig();
    const transport = buildTransport(config);

    await transport.verify();

    if (sendTo) {
        await transport.sendMail({
            from: formatFrom(config),
            to: sendTo,
            subject: 'ZimRate SMTP test',
            text: 'This is a test message confirming your ZimRate SMTP settings work.',
        });
    }

    return { verified: true, sent: Boolean(sendTo) };
}

function formatFrom(config) {
    const address = config.from_email || config.username;
    return config.from_name ? `"${config.from_name}" <${address}>` : address;
}

/** Delivers a contact form submission to the configured recipient. */
export async function sendContactMessage({ name, email, subject, message }) {
    const config = await getSmtpConfig();
    // Subject prefix follows the configured app name rather than a literal.
    const { app_name: appName } = await getBranding();

    if (!config.enabled) throw new Error('Contact form is disabled');
    if (!config.recipient) throw new Error('No recipient address is configured');

    const transport = buildTransport(config);

    const text = [
        `From: ${name} <${email}>`,
        `Subject: ${subject}`,
        '',
        message,
    ].join('\n');

    await transport.sendMail({
        from: formatFrom(config),
        to: config.recipient,
        // Replies go to the person who filled in the form, not the SMTP account.
        replyTo: `"${name}" <${email}>`,
        subject: `[${appName}] ${subject}`,
        text,
    });

    logger.info('Contact message delivered', { to: config.recipient });
    return { sent: true };
}

/** Whether the public contact form should accept submissions. */
export async function isContactEnabled() {
    const config = await getSmtpConfig();
    return Boolean(config.enabled && config.host && config.recipient);
}
