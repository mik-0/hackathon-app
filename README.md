# Pastrypenguins - Frostflag

## Introduction
Frostflag is a locally hostable, open-source, and flexible tool for flagging hateful speech and extremist content in audio recordings. It extracts spoken text from an audio file, highlights relevant flagged text, and provides timestamps for where a violation is found. The context model for what classifies as hate speech or extremist views is thoroughly grounded in definitions from organizing bodies like the UN and EU. 

## Research and context background

### Definition of Hate Speech
We have used the definition of hateful speech given by the UN Strategy and Plan of Action on Hate Speech:  
“any kind of communication in speech, writing or behaviour, that attacks or uses pejorative or discriminatory language with reference to a person or a group on the basis of who they are, in other words, based on their religion, ethnicity, nationality, race, colour, descent, gender or other identity factor.” (United Nations, 2019)

By “discriminatory” we mean biased, bigoted, or intolerant.  
By “pejorative” we mean prejudiced, contemptuous, or demeaning of an individual or group.  
[https://www.un.org/en/hate-speech/understanding-hate-speech/what-is-hate-speech]

### The Rabat Plan of Action
The Rabat Plan of Action proposes a six-part threshold test in order to decide if a speech is hateful. It takes into account:  
1. The Context of the speech (Evaluates vulnerability of the targeted group within its social, cultural, and political environment)  
2. The Speaker (Assesses the speaker’s influence and responsibility)  
3. The Intent (Explores motives and attitudes behind the speech)  
4. The content and the form of the speech (Degree of provocation/violence, Directness of the message, Connection to dominant hate narratives, call to action)  
5. The extent of the speech (Measures the dissemination and reach)  
6. The likelihood of the speech to produce immediate actions against its targets.  
[https://rm.coe.int/advanced-guide-toolkit-how-to-analyse-hate-speech/1680a217cd]

### Classification of Hate Speech Intensity
We can classify the intensity of a hate speech on a scale:

#### 6. Death  
Rhetoric includes literal killing by group. Responses include the literal death/elimination of a group.  
Examples: Killed, annihilate, destroy  

#### 5. Violence  
Rhetoric includes infliction of physical harm or metaphoric/aspirational physical harm or death. Responses include calls for literal violence or metaphoric/aspirational physical harm or death.  
Examples: Punched, raped, starved, torturing, mugging  

#### 4. Demonizing and Dehumanizing  
Rhetoric includes subhuman and superhuman characteristics. There are no responses for #4.  
Examples: Rat, monkey, Nazi, demon, cancer, monster  

#### 3. Negative Character  
Rhetoric includes nonviolent characterizations and insults. There are no responses for #3.  
Examples: Stupid, thief, aggressor, fake, crazy  

#### 2. Negative Actions  
Rhetoric includes negative nonviolent actions associated with the group. Responses include nonviolent actions including metaphors.  
Examples: Threatened, stole, outrageous act, poor treatment, alienate  

#### 1. Disagreement  
Rhetoric includes disagreeing at the idea/belief level. Responses include challenging claims, ideas, beliefs, or trying to change their view.  
Examples: False, incorrect, wrong, challenge, persuade, change minds  

[https://items.ssrc.org/disinformation-democracy-and-conflict-prevention/classifying-and-identifying-the-intensity-of-hate-speech/]

### Definition of Extremism
Our definition of extremism will be “an ideological movement, contrary to the democratic and ethical values of a society, that uses different methods, including violence (physical or verbal) to achieve its objectives”.

### Types of Extremism
Extremism is divided into 5 groups:  
- **Political**: the discourse includes references to grievances from one or more groups towards other groups.  
- **Historical**: legitimization of the political grievance narratives through the use of historical examples and similes.  
- **Socio-psychological**: glorification of acts against the system, either violent or not.  
- **Instrumental**: justification of the violence and “self-defense” as a way towards reaching objectives.  
- **Theological/moral**: legitimization of actions or reactions against political grievance or social oppression through religion, morality and/or ethics.  

Extremist texts tend to use discursive resources to convey their actions and ideas towards others. Some of these techniques have been studied in depth, such as hate speech (Fortuna and Nunes 2018), otherness (Sakki and Pettersson 2016), or the use of war terminology to create “enemies” and to communicate a “call to action” to others (Bennett Furlow and Goodall 2011).  
[Torregrosa, J., Bello-Orgaz, G., Martínez-Cámara, E. et al. A survey on extremism analysis using natural language processing: definitions, literature review, trends and challenges. J Ambient Intell Human Comput 14, 9869–9905 (2023). https://doi.org/10.1007/s12652-021-03658-z]

### Bad Language
Bad language is any word, phrase, or expression that is generally considered offensive, vulgar, obscene, or profane and may cause discomfort or harm to others. This includes profanity and swear words, sexual or obscene content, slurs or derogatory terms, hateful or inflammatory language, and context-dependent offensive expressions.

### Freedom of Expression
When forms of self-expression are flagged, censored, or removed, it interferes with people’s right to express themselves. Violating this right can lead to serious consequences, including feelings of resentment and frustration, a loss of trust, and even tension or conflict between individuals and their leaders.

**Where do we draw the line? When is it okay to intervene?**

According to Article 20(2) of the International Covenant on Civil and Political Rights (ICCPR), national, religious, or racial hatred that incites violence, discrimination, or hostility is prohibited.  
Article 19(3) of the ICCPR permits restrictions on the human right of freedom of expression when necessary to protect "rights or reputations of others", or for "protection of national security or of public order, or of public health or morals".  
[https://www.ohchr.org/en/instruments-mechanisms/instruments/international-covenant-civil-and-political-rights]


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



