# Pastrypenguins - Frostflag

## Introduction
Frostflag is a locally hostable, open-source and flexible tool for flagging hateful speech and extremist content in audio recordings. From an audio file, spoken text is extracted, relevant flagged text is highlighted and timestamps are provided for where a violation is found. The context model for what classifies as hate speech or extremist views is thoroughly grounded in definitions from organizing bodies like the UN and EU. 


## Research and context background




## System design
Frostflag is a web-app that uses React for the front-end and Node.js with tRPC for the back-end.

Our system consists of several processing steps to reach our goal:
1. Audio upload
2. Audio transcription
3. Segment ratings
4. Data visualization

### Audio Upload
The first step of the pipeline is to upload the audio file for processing via our back-end. This is done using a POST request with multipart form data. Large files are also supported using the busboy package.

### Audio transcription
After the file has been uploaded, we directly make a request to the Whisper API, which is a service that transcribes audio including timestamps with high accuracy. Whisper is open-source, and we ran several experiments with running Whisper locally on our own computers. However, we discovered that for longer audio files, our local resources weren't sufficient since the task ended up taking way too long. It is totally possible to re-implement the local inference when local hardware is sufficient.

Whisper returns data in several segments: each segment contains 1-2 sentences most of the time, and it also includes data for the timestamps. We process the segments by mapping the contents together and wrapping each segment content with its segment number (index):
<1>This is the first segment</1><2>This is the second.<2>....

### Segment ratings
Once we have the processed transcription, we feed this to an LLM. We also tried locally running this but unfortunately ran into several issues while setting it up, so we used OpenAI's API (gpt-5-mini). We instructed the model with a specific prompt that contains several rules for determining what extremism and/or bad language is. The LLM is then to output all segment numbers (<1>, <2>, ...) that have an offending category:
1:EXTREMISM;4:BADLANGUAGE;...

Once we have this data, we can map each segment to a category, and edit the data in the database.

### Data visualization
We now have all segments and their categories. In the front-end, we display a waveform component that represent the uploaded audio file. Segments that have bad language are marked in orange, and those that have detected extremism are marked in red. All segments and timestamps are also visible under the waveform. The user can choose to export the data as JSON, and we might provide more formats in the future.




## Usage
This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Elysia, TRPC, and more.

### Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Elysia** - Type-safe, high-performance framework
- **tRPC** - End-to-end type-safe APIs
- **Node.js** - Runtime environment
- **Mongoose** - TypeScript-first ORM
- **MongoDB** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

### Getting Started

First, install the dependencies:

```bash
npm install
```
### Database Setup

This project uses MongoDB with Mongoose.

1. Make sure you have MongoDB set up.
2. Update your `apps/server/.env` file with your MongoDB connection URI.

3. Apply the schema to your database:
```bash
npm run db:push
```


Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).







### Project Structure

```
hackathon-app/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   └── server/      # Backend API (Elysia, TRPC)
```

### Available Scripts

- `npm run dev`: Start all applications in development mode
- `npm run build`: Build all applications
- `npm run dev:web`: Start only the web application
- `npm run dev:server`: Start only the server
- `npm run check-types`: Check TypeScript types across all apps
- `npm run db:push`: Push schema changes to database
- `npm run db:studio`: Open database studio UI


## Citations
https://www.coe.int/en/web/freedom-expression/hate-speech#{%2266111206%22:[]}
https://rm.coe.int/leaflet-combating-hate-speech-en-november-2022/1680a923f5
https://www.un.org/en/genocideprevention/documents/UN%20Strategy%20and%20Plan%20of%20Action%20on%20Hate%20Speech%2018%20June%20SYNOPSIS.pdf



