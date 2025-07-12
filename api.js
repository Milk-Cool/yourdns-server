import { pushRecord, recordTypes } from "./index.js";
import express from "express";
import Validator from "./validator.js";

/** @typedef {{ error: string }} ErrorObj */
/**
 * Makes an error.
 * @param {string} msg Message
 * @returns {ErrorObj} The error object
 */
const makeError = msg => ({ error: msg });

const errorMsgs = {
    unauthorized: "Unauthorized!",
    badRequest: "Bad request!",
    invalidType: "Invalid type!",
};
/** @type {Record<keyof typeof errorMsgs, ErrorObj>} */
const errors = Object.fromEntries(Object.entries(errorMsgs).map(x => [x[0], makeError(x[1])]));

export const app = express();
app.use((req, res, next) => {
    if(req.headers.authorization?.replace?.(/^Bearer\s*/, "") !== process.env.ADMIN_KEY)
        return res.status(401).send(errors.unauthorized);
    next();
});
app.use(express.json());

app.post("/records", async (req, res) => {
    const valid = new Validator(req.body);
    if(!valid.str("name", { min: 1 }) || !valid.str("type", { min: 1, max: 20 })
            || !valid.int("ttl", { min: 1 }) || !valid.str("value", { min: 1 }))
        return res.status(400).send(errors.badRequest);
    if(!recordTypes.includes(req.body.type))
        return res.status(400).send(errors.invalidType);

    await pushRecord(req.body.name, req.body.type, req.body.ttl, req.body.value);
    return res.status(200).send({ message: "OK" });
});