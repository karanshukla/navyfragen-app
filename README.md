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
4. Open your web browser and navigate to `http://localhost:5173`.
5. If you're a Windows user, you might need to go to `http://127.0.0.1` in order for cookies to work.

## External Dependencies

Image generation is handled by a separate service that can be found here: [text](https://hub.docker.com/r/monkeyphysics/html-to-image)

You'll need to run it locally via Docker and update your env file to point to localhost:port (it should default to port 3033).

```bash
docker pull monkeyphysics/html-to-image
docker run --rm -p 3033:3033 monkeyphysics/html-to-image
```

## Important to note

Running npm run lexgen on a Windows device may cause it to delete all the generated lexicon files. Instead, run it directly with:

```bash
./node_modules/.bin/lex gen-server ./src/lexicon ./lexicons/\*
```
