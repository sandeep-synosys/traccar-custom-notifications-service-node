const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const layouts = require("handlebars-layouts");

const fs = require("fs");
const path = require("path");
require("dotenv").config();

const EMAIL = process.env.MAILGUN_EMAIL;
const PASSWORD = process.env.MAILGUN_PASSWORD;
const DISPLAY_EMAIL = 'notification@mylocatorplus.net'

handlebars.registerHelper(layouts(handlebars));
handlebars.registerHelper('assetUrl', function (filename) {
    return 'https://pro.mylocatorplus.com/task-manager/assets/' + filename;
});
handlebars.registerPartial(
    "layout",
    fs.readFileSync(path.join(__dirname, "templates/layout.hbs"), "utf8")
);

let transporter = nodemailer.createTransport({
    host: "smtp.mailgun.org",
    port: 587,
    // secure: true,
    // requireTLS: true,
    auth: {
        user: EMAIL,
        pass: PASSWORD
    }
});

exports._Mail = (options) => {
    return new Promise((resolve, reject) => {
        fs.readFile(
            path.join(__dirname, "./templates/" + options.template),
            { encoding: "utf-8" },
            (err, html) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(html);
                }
            }
        );
    })
        .then(html => {
            var template = handlebars.compile(html);
            options.context.logo = process.env.BASE_URL + "assets/images/login-logo.png";
            var htmlToSend = template(options.context);
            var FROM = `MyLocator <${DISPLAY_EMAIL}>`;

            let mailOptions = {
                from: FROM,
                to: options.to,
                subject: options.subject,
                html: htmlToSend,
                attachments: options.attachments || []
            };

            console.log("mailOptions.................", mailOptions.attachments)
            transporter.sendMail(mailOptions, function (err, info) {
                console.log('Error...: ', err);
                console.log('info : ', info);
            });
        })
        .catch(err => {
            console.log('Error in mail sending : ', err);
        });
};
