// import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import ejs from "ejs";
import fs from "fs";
import path from "path";
import nodemailer from 'nodemailer';
const __dirname = path.resolve();

const transporter = nodemailer.createTransport({
  service: "gmail", 
  secure: true,
  port: 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export const sendSignUpEmail = async (to, name, domain) => {
  try {
    const templatePath = path.join(__dirname, "src", "views", "verify-email.ejs");
    const root = path.join(__dirname, "views");
    const template = fs.readFileSync(templatePath, "utf-8");

    const htmlContent = ejs.render(template, {
      root,
      domain,
      name,
    });

    const mailOptions = {
      from: `ChainSphere <${process.env.SMTP_USER}>`,
      to,
      subject: "Verification link",
      text: `Hi ${name}! Please complete the verification process`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: !!info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false };
  }
};

export const sendResetEmail = async (to, name, domain) => {
  try {
    const templatePath = path.join(__dirname, "src", "views", "forgot-password.ejs");
    const root = path.join(__dirname, "views");
    const template = fs.readFileSync(templatePath, "utf-8");

    const htmlContent = ejs.render(template, {
      root,
      domain,
      name,
    });

    const mailOptions = {
      from: `ChainSphere <${process.env.SMTP_USER}>`,
      to,
      subject: "Reset Your Password",
      text: `Hi ${name}, You requested to reset your password.`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: !!info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false };
  }
};

// const SES_CONFIG = {
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
//   region: process.env.AWS_REGION,
// };

// const sesClient = new SESClient(SES_CONFIG);

// export const sendSignUpEmail = async (to, name, domain) => {
//   const templatePath = path.join(__dirname, "src", "views", "verify-email.ejs");
//   const root = path.join(__dirname, "views");
//   const template = fs.readFileSync(templatePath, "utf-8");

//   const htmlContent = ejs.render(template, {
//     root,
//     domain,
//     name,
//   });
//   const params = {
//     Destination: {
//       ToAddresses: [to],
//     },
//     Message: {
//       Body: {
//         Html: {
//           Charset: "UTF-8",
//           Data: htmlContent,
//         },
//         Text: {
//           Data: `Hi ${name}! Please complete the verification process`,
//         },
//       },
//       Subject: {
//         Data: "Verification link",
//       },
//     },
//     Source: process.env.AWS_SENDER,
//   };

//   const sendEmailCommand = new SendEmailCommand(params);
//   let response = await sesClient.send(sendEmailCommand);
//   const res = response.$metadata.httpStatusCode;
//   if (res === 200) {
//     return { success: true };
//   } else {
//     return { success: false };
//   }
// };

// export const sendResetEmail = async (to, name, domain) => {
//   const templatePath = path.join(
//     __dirname,
//     "src",
//     "views",
//     "forgot-password.ejs"
//   );

//   const root = path.join(__dirname, "views");
//   const template = fs.readFileSync(templatePath, "utf-8");

//   const htmlContent = ejs.render(template, {
//     root,
//     domain,
//     name,
//   });
//   const params = {
//     Destination: {
//       ToAddresses: [to],
//     },
//     Message: {
//       Body: {
//         Html: {
//           Charset: "UTF-8",
//           Data: htmlContent,
//         },
//         Text: {
//           Data: `Hi ${name}, You requested to reset your password.`,
//         },
//       },
//       Subject: {
//         Data: "Reset Your Passsword",
//       },
//     },
//     Source: process.env.AWS_SENDER,
//   };

//   const sendEmailCommand = new SendEmailCommand(params);
//   let response = await sesClient.send(sendEmailCommand);
//   const res = response.$metadata.httpStatusCode;
//   if (res === 200) {
//     return { success: true };
//   } else {
//     return { success: false };
//   }
// };


