import nodemailer from "nodemailer";

// Special email function for appointments that matches your existing pattern
export const sendAppointmentEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"Service Booking App" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
    html: html
  };

  await transporter.sendMail(mailOptions);
};