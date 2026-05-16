const { FirebaseNotification } = require("./firebase");

exports._pushNotification = async (
    title,
    body,
    id,
    data = {},
) => {

    if (!id || id == "") {
        return false;
    }

    if (title.charAt(0) == ".") {
        title = title.substring(1);
    }

    if (body.charAt(0) == ".") {
        body = body.substring(1);
    }

    var message = {
        // to: id,
        token: id,
        notification: {
            title: `(beta) ${title}`,
            body: body,
        },
        data: { data: JSON.stringify(data) },
    };

    console.log("message..............", message);

    FirebaseNotification.send(message, function (err, response) {
        if (err) {
            console.log("Something has gone wrong!", err);
        } else {
            console.log("Successfully sent with response: ", response);
        }
    });
}
