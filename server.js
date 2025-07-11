import dns2 from "dns2";
const { Packet } = dns2;

const server = dns2.createServer({
    udp: true,
    handle: (req, send, _rinfo) => {
        const res = Packet.createResponseFromRequest(req);
        const [ question ] = req.questions;
        const { name } = question;
        res.answers.push({
            name,
            type: Packet.TYPE.A,
            class: Packet.CLASS.IN,
            ttl: 1,
            address: "123.45.67.89"
        });
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