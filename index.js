import { randomUUID } from "crypto";
import { Pool } from "pg";
import forge from "node-forge";
const { pki, asn1 } = forge;

const VALID_MS = 365 * 24 * 3600 * 1000;
const VALID_MS_CA = 25 * VALID_MS;
const CA_NAME = "yourdns";

export const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB
});

/**
 * @typedef {object} Record A record
 * @prop {import("crypto").UUID} id Record UUID
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
/**
 * @typedef {object} CertPair A key and certificate pair
 * @prop {import("crypto").UUID} id Pair UUID
 * @prop {string} domain Pair domain
 * @prop {string} key Key (hex)
 * @prop {string} cert Cert (hex)
 * @prop {string} timestamp Creation timestamp (decimal string)
 * @prop {string} until Expiry timestamp (decimal string)
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
        timestamp NUMERIC NOT NULL,
        
        PRIMARY KEY (id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS certs (
        id uuid UNIQUE NOT NULL,
        domain TEXT NOT NULL,

        key bytea NOT NULL,
        cert bytea NOT NULL,

        timestamp NUMERIC NOT NULL,
        until NUMERIC NOT NULL,

        PRIMARY KEY (id)
    )`);

    if(!(await getCert(".")))
        await generateCert(".", true);
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
    return (await pool.query(`INSERT INTO records (id, name, type, ttl, value, timestamp)
        VALUES ($1, LOWER($2), $3, $4, $5, $6) RETURNING *`,
        [randomUUID(), name, type, ttl, value, Date.now()])).rows?.[0];
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
 * Deleted a record by its name.
 * @param {string} name The record's name
 */
export const deleteRecordByName = async name => {
    await pool.query(`DELETE FROM records WHERE name = $1`,
        [name]);
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
        SET name = LOWER($2), type = $3, ttl = $4, value = $5
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
        WHERE LOWER($1) LIKE replace(name, '*', '%')
        AND array_length(string_to_array(name, '.'), 1)
        = array_length(string_to_array($1, '.'), 1)
        ORDER BY timestamp ASC`, [name])).rows;
};

/**
 * Gets all records with the specified base.
 * @param {string} base Required base
 * @returns {Record[]} Matching records
 */
export const getRecordsByBase = async base => {
    return (await pool.query(`SELECT * FROM records
        WHERE name = LOWER($1) OR name LIKE '%.' || LOWER($1)
        ORDER BY timestamp ASC`, [base])).rows;
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
        if(domain.match(new RegExp(rule.rule, "i"))) return rule.addr;
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

/**
 * Finds all owner records by its owner.
 * @param {string} owner String identifying owner (ID/email)
 * @returns {Record[]}
 */
export const findByOwner = async owner => {
    return (await pool.query(`SELECT * FROM records
        WHERE name LIKE '-.%'
        AND type = 'TXT'
        AND value = $1
        ORDER BY timestamp ASC`, [owner])).rows;
};

const buf2hex = obj => typeof obj === "object" ? Object.fromEntries(Object.entries(obj).map(x => {
    if(x[1] instanceof Buffer) return [x[0], x[1].toString("hex")];
    return x;
})) : obj;

/**
 * Gets a cert/key pair for a domain.
 * @param {string} domain Domain
 * @returns {CertPair} The cert/key pair
 */
export const getCert = async domain => {
    return buf2hex((await pool.query(`SELECT * FROM certs
        WHERE domain = $1`, [domain])).rows?.[0]);
}
/**
 * Deletes a cert/key pair for a domain.
 * @param {string} domain Domain
 */
export const deleteCert = async domain => {
    await pool.query(`DELETE FROM certs
        WHERE domain = $1`, [domain]);
}
/**
 * Gets all cert/key pairs for all doains matching the given 2nd-level domain.
 * @param {string} base 2nd-level domain
 * @returns {CertPair[]} The cert/key pairs
 */
export const getCertsByBase = async base => {
    return (await pool.query(`SELECT * FROM certs
        WHERE (domain = $1 OR domain LIKE '%.' || $1) AND domain != '-.' || $1`, [base])).rows.map(buf2hex);
}
/**
 * Deletes a cert/key pair by ID.
 * @param {import("crypto").UUID} id ID
 */
export const removeCertByID = async id => {
    await pool.query(`DELETE FROM certs WHERE id = $1`, [id]);
}

/**
 * Generates a cert/key pair.
 * @param {string} domain Domain for the cert
 * @param {boolean} ca Whether to generate a CA
 * @returns {CertPair} The cert/key pair
 */
export const generateCert = async (domain, ca = false) => {
    const old = await getCert(domain);

    const id = randomUUID();
    const keys = pki.rsa.generateKeyPair(2048);
    const cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = id.replaceAll("-", "");

    const now = new Date();
    const until = new Date(now.getTime() + (ca ? VALID_MS_CA : VALID_MS));
    cert.validity.notBefore = now;
    cert.validity.notAfter = until;

    const rootAttrs = [{ name: "commonName", value: CA_NAME }];
    const hash = forge.md.sha256.create();
    if(ca) {
        cert.setSubject(rootAttrs);
        cert.setIssuer(rootAttrs);
        cert.setExtensions([
            { name: "basicConstraints", cA: true },
            { name: "keyUsage", keyCertSign: true, digitalSignature: true, cRLSign: true },
        ]);
        cert.sign(keys.privateKey, hash);
    } else {
        const attrs = [{ name: "commonName", value: domain }];
        cert.setSubject(attrs);
        cert.setIssuer(rootAttrs);
        cert.setExtensions([
            { name: "subjectAltName", altNames: [{ type: 2, value: domain }] }
        ]);

        const caCert = await getCert(".");
        const privateKey = pki.privateKeyFromAsn1(
            asn1.fromDer(Buffer.from(caCert.key, "hex").toString("binary"))
        );
        cert.sign(privateKey, hash);
    }

    const keyBin = Buffer.from(asn1.toDer(pki.privateKeyToAsn1(keys.privateKey)).getBytes(), "binary");
    const certBin = Buffer.from(asn1.toDer(pki.certificateToAsn1(cert)).getBytes(), "binary");

    if(old) await removeCertByID(old.id);
    return buf2hex((await pool.query(`INSERT INTO certs (id, domain, key, cert, timestamp, until)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [id, ca ? "." : domain,
            keyBin, certBin,
            now.getTime(), until.getTime()])).rows?.[0]);
}