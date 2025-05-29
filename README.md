## Description

Allows users to receive anonymous messages and post the answers directly to BlueSky.

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
4. Open your web browser and navigate to `http://localhost:8080`.

## External Dependencies
Image generation is handled by a separate service that can be found here: [text](https://hub.docker.com/r/monkeyphysics/html-to-image)

You'll need to run it locally via Docker and update your env file to point to it (it should default to port 3033)

## Important to note

Running npm run lexgen on a Windows device may cause it to delete all the generated lexicon files. Instead, run it directly with ./node_modules/.bin/lex gen-server ./src/lexicon ./lexicons/*
