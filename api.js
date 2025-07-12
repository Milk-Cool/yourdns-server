import { deleteRecordByID, getRecordByID, pushRecord, recordTypes, updateRecord } from "./index.js";
import express from "express";
import Validator from "./validator.js";
import { REGEX_UUID } from "./regex.js";

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
    invalidID: "Invalid ID!",
    recordNotFound: "Record not found!",
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

const validateRecordBase = (req, res, next) => {
    const valid = new Validator(req.body);
    if(!valid.str("name", { min: 1 }) || !valid.str("type", { min: 1, max: 20 })
            || !valid.int("ttl", { min: 1 }) || !valid.str("value", { min: 1 }))
        return res.status(400).send(errors.badRequest);
    if(!recordTypes.includes(req.body.type))
        return res.status(400).send(errors.invalidType);
    req.valid = valid;
    next();
}
const validateID = (req, res, next) => {
    if(!req.params.id.match(REGEX_UUID))
        return res.status(400).send(errors.invalidID);
    next();
}

app.post("/records", validateRecordBase, async (req, res) => {
    const record = await pushRecord(req.body.name, req.body.type, req.body.ttl, req.body.value);
    return res.status(201).send(record);
});
app.get("/records/:id", async (req, res) => {
    const record = await getRecordByID(req.params.id);
    if(!record) return res.status(404).send(errors.recordNotFound);
    return res.status(200).send(record);
});
app.delete("/records/:id", async (req, res) => {
    await deleteRecordByID(req.params.id);
    return res.status(200).send({ status: "OK" });
});
app.put("/records/:id", validateRecordBase, validateID, async (req, res) => {
    const record = await updateRecord(req.params.id, req.body.name, req.body.type, req.body.ttl, req.body.value);
    if(!record) return res.status(404).send(errors.recordNotFound);
    return res.status(200).send(record);
});