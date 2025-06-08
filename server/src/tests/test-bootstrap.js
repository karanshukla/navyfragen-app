// test-bootstrap.js
// This file is for test/CI only. All values are dummy and not used in production.
// nodejsscan ignore: file
process.env.CLIENT_URL ||= "http://localhost";
process.env.COOKIE_SECRET ||= "testsecret";
process.env.DB_PATH ||= ":memory:";
process.env.EXPORT_HTML_URL ||= "http://localhost:3033/";
process.env.HOST ||= "localhost";
process.env.NODE_ENV ||= "test";
process.env.OAUTH_TOKEN_SECRET ||= "0123456789abcdef0123456789abcdef";
process.env.PDS_HOST ||= "http://localhost:2583";
process.env.PORT ||= "3000";
process.env.POSTGRESQL_URL ||= "postgres://user:pass@localhost:5432/db";
