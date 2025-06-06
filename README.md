## Description

Allows users to receive anonymous messages and post the answers directly to Bluesky.

## Getting Started

You will need to install Node, Git and a compatible web browser to run the app locally. Windows users may also need to install the C++ build tools or use WSL2 to run the app.

1. Clone the repository:
   ```bash
   git clone
   cd navyfragen
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your web browser and navigate to `http://localhost:5173`. (If you're a Windows user, you might need to go to `http://127.0.0.1` in order for cookies to work, more on this in the /server README)

## External Dependencies

Image generation is handled by a separate service that can be found here: https://hub.docker.com/r/monkeyphysics/html-to-image. This service takes a HTML source, renders it in a headless browser, then returns a screenshot. 

You'll need to run it locally via Docker and update your env file to point to localhost:port (it should default to port 3033).

```bash
docker pull monkeyphysics/html-to-image
docker run --rm -p 3033:3033 monkeyphysics/html-to-image
```

Anubis acts as a WAF to protect the publically available pages from DDoS or spam. It is optional, but highly recommended. In order to run it, you will also need to add a Caddy Reverse Proxy (a sample is provided in /caddy) and associate the frontend/backend appropriately. Point the frontend to Anubis, and then have Anubis redirect to the frontend Vite service. 

Users may want also want a shortlink in order to share their public inbox. You can use any external or internal URL redirection service as long as it mantains the path parameters in the request and supports prefixing requests. For example, fragen.navy/user123 should be able to redirect to navyfragen.app/profile/user123. As an example you can use something like this: https://github.com/Intellection/docker-redirector. Make sure you set the variable in the frontend as well.

## Important to note

Running npm run lexgen on a Windows device may cause it to delete all the generated lexicon files. Although you shouldn't need to change any of the generated files, WSL2 is recommended to avoid any unnecessary deletions. 
