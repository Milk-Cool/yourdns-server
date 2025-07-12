import "dotenv/config";

import dns2 from "dns2";
const { Packet, UDPClient } = dns2;
import { deinit, getProxyDNS, getRecords, init } from "./index.js";
import { app } from "./api.js";

const defaultResolve = UDPClient({
    dns: process.env.DEFAULT_SERVER
});

await init();

const server = dns2.createServer({
    udp: true,
    handle: async (req, send, _rinfo) => {
        const res = Packet.createResponseFromRequest(req);
        const [ question ] = req.questions;
        const { name } = question;
        
        const toAsk = await getProxyDNS(name);
        if(toAsk !== null) {
            const resolve = UDPClient({
                dns: toAsk
            });
            res.answers = (await resolve(name)).answers;
            send(res);
            return;
        }

        const records = await getRecords(name);
        if(records.length > 0) {
            for(const record of records)
                res.answers.push(Object.assign({
                    mame: record.name,
                    type: Packet.TYPE[record.type],
                    class: Packet.CLASS.IN,
                    ttl: record.ttl
                }, record.type === "CNAME" ? {
                    domain: record.value
                } : record.type === "TXT" ? {
                    data: record.value
                } : {
                    address: record.value
                }));
            send(res);
            return;
        }

        res.answers = (await defaultResolve(name)).answers;
        send(res);
    }
});

server.listen({
    udp: {
        port: 5335,
        address: "0.0.0.0"
    },
    tcp: {
        port: 5335,
        address: "0.0.0.0"
    }
});
app.listen(5339);

const stop = async () => {
    deinit();
    server.close();
    process.exit(0);
};
process.on("SIGHUP", async () => await stop());
process.on("SIGUSR2", async () => await stop());
process.on("SIGINT", async () => await stop());
process.on("SIGTERM", async () => await stop());