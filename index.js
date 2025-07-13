import { randomUUID } from "crypto";
import { Pool } from "pg";

export const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB
});

/**
 * @typedef {object} Record A record
 * @prop {string} name The domain name
 * @prop {RecordType} type The record type
 * @prop {number} ttl TTL
 * @prop {stirng} value Record value
 */
/**
 * @typedef {object} ProxyRule A proxy rule
 * @prop {import("crypto").UUID} id Rule UUID
 * @prop {string} rule Rule as regex
 * @prop {string} addr Address of server to proxy the request to
 */
export const init = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS proxy_rules (
        id uuid UNIQUE NOT NULL,
        rule TEXT NOT NULL,
        addr TEXT NOT NULL,
        
        PRIMARY KEY (id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS records (
        id uuid UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type varchar(20) NOT NULL,
        ttl INTEGER NOT NULL,
        value TEXT,
        
        PRIMARY KEY (id)
    )`);
};

export const deinit = async () => await pool.end();

export const recordTypes = ["A", "AAAA", "CNAME", "TXT"];
/** @typedef {"A" | "AAAA" | "CNAME" | "TXT"} RecordType */

/**
 * Pushes a new record to the database.
 * @param {RecordType} type The record's type
 * @param {number} ttl TTL
 * @param {string} value Record value
 * @returns {Record} The new record
 */
export const pushRecord = async (name, type, ttl, value) => {
    return (await pool.query(`INSERT INTO records (id, name, type, ttl, value)
        VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [randomUUID(), name, type, ttl, value])).rows?.[0];
};
/**
 * Gets a record by ID.
 * @param {import("crypto").UUID} id The record's UUID
 * @returns {Record} The new record
 */
export const getRecordByID = async id => {
    return (await pool.query(`SELECT * FROM records WHERE id = $1`,
        [id])).rows?.[0];
};
/**
 * Deleted a record by ID.
 * @param {import("crypto").UUID} id The record's UUID
 */
export const deleteRecordByID = async id => {
    await pool.query(`DELETE FROM records WHERE id = $1`,
        [id]);
};
/**
 * Updates a record in the database.
 * @param {import("crypto").UUID} id The record's UUID
 * @param {RecordType} type The record's type
 * @param {number} ttl TTL
 * @param {string} value Record value
 * @returns {Record} The updated record
 */
export const updateRecord = async (id, name, type, ttl, value) => {
    return (await pool.query(`UPDATE records
        SET name = $2, type = $3, ttl = $4, value = $5
        WHERE id = $1
        RETURNING *`,
        [id, name, type, ttl, value])).rows?.[0];
};

/**
 * Gets all matching records.
 * @param {string} name Required name
 * @returns {Record[]} Matching records
 */
export const getRecords = async name => {
    return (await pool.query(`SELECT * FROM records
        WHERE $1 LIKE replace(name, '*', '%')
        AND array_length(string_to_array(name, '.'), 1)
        = array_length(string_to_array($1, '.'), 1)`, [name])).rows;
};

/**
 * Gets all records with the specified base.
 * @param {string} base Required base
 * @returns {Record[]} Matching records
 */
export const getRecordsByBase = async base => {
    return (await pool.query(`SELECT * FROM records
        WHERE name = $1 OR name LIKE '%.' || $1`, [base])).rows;
};

/**
 * Gets ALL proxy rules.
 * @returns {ProxyRule[]} Proxy rules
 */
export const getAllProxyRules = async () => {
    return (await pool.query(`SELECT * FROM proxy_rules`)).rows;
};

/**
 * Gets the DNS server to ask by domain (or null if we have to resolve ourselves).
 * @param {string} domain The domain to check
 * @returns {string | null} The DNS server or null if domain doesn't match anything
 */
export const getProxyDNS = async domain => {
    const rules = await getAllProxyRules();
    for(const rule of rules)
        if(domain.match(new RegExp(rule.rule))) return rule.addr;
    return null;
}

/**
 * Pushes a new proxy rule to the database.
 * @param {string} ruleRegex Rule as a string RegEx
 * @param {string} addr Address of DNS server to ask
 * @returns {ProxyRule} The proxy rule
 */
export const pushProxyRule = async (ruleRegex, addr) => {
    return (await pool.query(`INSERT INTO proxy_rules (id, rule, addr)
        VALUES ($1, $2, $3) RETURNING *`,
        [randomUUID(), ruleRegex, addr])).rows?.[0];
};

/**
 * Updates a proxy rule to the database.
 * @param {import("crypto").UUID} id Rule ID
 * @param {string} ruleRegex Rule as a string RegEx
 * @param {string} addr Address of DNS server to ask
 * @returns {ProxyRule} The proxy rule
 */
export const updateProxyRule = async (id, ruleRegex, addr) => {
    return (await pool.query(`UPDATE proxy_rules
        SET rule = $2, addr = $3
        WHERE id = $1
        RETURNING *`,
        [id, ruleRegex, addr])).rows?.[0];
};

/**
 * Updates a proxy rule to the database.
 * @param {import("crypto").UUID} id Rule ID
 */
export const deleteProxyRule = async id => {
    await pool.query(`DELETE FROM proxy_rules WHERE id = $1`,
        [id]);
};