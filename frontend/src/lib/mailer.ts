import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export async function sendOtpEmail(email: string, code: string) {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `${code} is your Kaamlee verification code`,
    text: `Your Kaamlee verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Kaamlee verification code is <strong style="font-size:20px;letter-spacing:2px;">${code}</strong>.</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
}

export async function sendEventRegistrationEmail({
  to, name, eventTitle, eventDate, location, amountPaise,
}: {
  to: string;
  name: string;
  eventTitle: string;
  eventDate: string;
  location: string;
  amountPaise: number;
}) {
  const formattedDate = new Date(eventDate).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const amountLine = amountPaise > 0 ? `₹${(amountPaise / 100).toFixed(0)} paid` : 'Free entry';

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `You're registered for ${eventTitle}`,
    text: `Hi ${name},\n\nYou've successfully registered for "${eventTitle}" on ${formattedDate} at ${location}. ${amountLine}.\n\nSee you there!\n— Kaamlee`,
    html: `<p>Hi ${name},</p><p>You&apos;ve successfully registered for <strong>${eventTitle}</strong> on ${formattedDate} at ${location}. ${amountLine}.</p><p>See you there!<br/>— Kaamlee</p>`,
  });
}
