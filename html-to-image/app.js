import puppeteer from 'puppeteer';
import express from 'express';
import path from 'path';
import fs from 'fs';
import tmp from 'tmp';
import cors from 'cors';

const app = express();
const port = 3033;

const supportedFormats = {
	'png': { contentType: 'image/png', args: { type: 'png' } },
	'jpg': { contentType: 'image/jpeg', args: { type: 'jpeg' } },
	'jpeg': { contentType: 'image/jpeg', args: { type: 'jpeg' } },
	'webp': { contentType: 'image/webp', args: { type: 'webp' } },
	'pdf': { contentType: 'application/pdf' },
};

// listen on our port
app.listen(port, () => {
	console.log(`HTMLtoImage service listening on port ${port}`);
});

// cross-origin support
app.use(cors());

// parse JSON body for incoming request
app.use(express.json({ limit: '1mb' }));

// validate incoming request
app.use((req, res, next) => {
	if (req.method !== 'POST') {
		next({ status: 405, message: "Method not allowed" });
	} else if (req.get('Content-Type') != 'application/json') {
		next({ status: 415, message: "Unexpected Content-Type: only supports 'application/json'" });
	} else if (typeof req.body.source != 'string') {
		next({ status: 400, message: "Missing 'source' property in request body, or 'source' property is not a string" });
	} else if (req.body.source == '') {
		next({ status: 400, message: "Property 'source' must not be empty" });
	} else if (req.body.options && typeof req.body.options != 'object') {
		next({ status: 400, message: "Property 'options' can only be an object (or omitted)" });
	} else if (typeof req.body.format != 'string' || !supportedFormats[req.body.format]) {
		next({ status: 400, message: `Property 'format' must be one of: ${Object.keys(supportedFormats).join(', ')}` });
	} else {
		next();
	}
});

// implement the endpoint
app.post('/', (req, res) => {
	const options = req.body.options || {};
	const format = supportedFormats[req.body.format]; // safe, validated in middleware

	res.header("Content-Type", format.contentType);

	const tmpoutput = tmp.fileSync({ prefix: 'htmltoimage-' });
	const isPdf = req.body.format == 'pdf';

	options.args = Object.assign({}, options.args, format.args, { path: tmpoutput.name });

	if (isUrl(req.body.source)) {
		screenshot(req.body.source, isPdf, options).then(() => {
			fs.createReadStream(tmpoutput.name).pipe(res).on('close', () => {
				tmpoutput.removeCallback();
			})
		}).catch(e => errorHandler(res, e));
	} else {
		const tmpinput = tmp.fileSync({ prefix: 'htmltoimage-', postfix: '.html' });
		fs.writeFile(tmpinput.name, req.body.source, () => {
			screenshot('file://' + tmpinput.name, isPdf, options).then(() => {
				fs.createReadStream(tmpoutput.name).pipe(res).on('close', () => {
					tmpinput.removeCallback();
					tmpoutput.removeCallback();
				});
			}).catch(e => errorHandler(res, e));
		});
	}
});

// error handler
const errorHandler = (res, error) => {
	res.status(error.status || 500).send({ error: error.message || "" });
};

// error handler middleware (goes last in stack)
app.use((error, req, res, next) => {
	if (error) {
		errorHandler(res, error);
	} else {
		next();
	}
});

// helper function to check if string is a URL
const isUrl = (string) => {
	try {
		const url = new URL(string);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch (e) {}

	return false;
};

console.log(`Launching browser...`);
const browser = await puppeteer.launch({
	defaultViewport: {
		width: 1920,
		height: 1080,
	},
	args: [
		'--no-sandbox',
		'--no-zygote',
		'--headless',
		'--disable-gpu',
	],
});
console.log(`... browser ready.`);

// the actual screenshot code, using puppeteer
const screenshot = async (url, isPdf, options) => {
	let page;
	try {
		page = await browser.newPage();
		await page.setViewport({
		  width: options.width || 1920,
		  height: options.height || 1080,
		});

		await page.goto(url);

		if (isPdf) {
			// default to 'A4' (instead of 'letter'), but allow override through options.args
			await page.pdf(Object.assign({ format: 'A4' }, options.args));
		} else {
			await page.screenshot(options.args);
		}
	} catch (e) {
		throw e;
	} finally {
		if (page) {
			await page.close();
		}
	}
}

// correctly handle CTRL+C from cli when using 'docker run'
process.on('SIGINT', function() {
	console.log("Closing browser...");
	browser.close();
    process.exit();
});
