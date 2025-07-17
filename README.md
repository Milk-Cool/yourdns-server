# yourdns-server
API and DNS server for yourdns. Note that the API is an **internal** API, and is not meant for public use without a wrapper (like [yourdns-website](https://github.com/Milk-Cool/yourdns-website)). The DNS server can be forwarded into the public, though.

Requires Postgres. If you don't wanna set it all up manually, see [yourdns-compose](https://github.com/Milk-Cool/yourdns-compose) for instructions on how to set it up with docker-compose.

## Setup
```
npm i
npm start
```

## `.env`
```bash
POSTGRES_DB=yourdns
POSTGRES_USER=yourdns
POSTGRES_PASSWORD=SecurePassword
POSTGRES_HOST=localhost
ADMIN_KEY=SecureKey
DEFAULT_SERVER=1.1.1.1 # any reliable DNS server
```