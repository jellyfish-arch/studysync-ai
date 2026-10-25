// StudySync AI: introduction video (1920x1080, 30 fps, 59 s).
import React from 'react'
import { AbsoluteFill, Audio, Composition, Sequence, registerRoot, staticFile } from 'remotion'
import { C } from './theme.js'
import { Dots } from './parts.jsx'
import { Hello, Outro, Phones, Title } from './Scenes.jsx'
import { Tour } from './Tour.jsx'
import { TOUR_LENGTH } from './tour.js'
import { LINES } from './voice.js'

const T = { title: 0, hello: 120, tour: 240 }
T.phones = T.tour + TOUR_LENGTH
T.outro = T.phones + 120
const LENGTH = T.outro + 120

function StudySyncIntro() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Dots />
      <Sequence from={T.title} durationInFrames={120}>
        <Title />
      </Sequence>
      <Sequence from={T.hello} durationInFrames={120}>
        <Hello />
      </Sequence>
      <Sequence from={T.tour} durationInFrames={TOUR_LENGTH}>
        <Tour />
      </Sequence>
      <Sequence from={T.phones} durationInFrames={120}>
        <Phones />
      </Sequence>
      <Sequence from={T.outro} durationInFrames={120}>
        <Outro />
      </Sequence>
      {/* Yuuki's voice (Gemini text-to-speech, voice "Leda"; see scripts/voice.mjs) */}
      {LINES.map((l) => (
        <Sequence key={l.id} from={l.at}>
          <Audio src={staticFile(`voice/${l.id}.wav`)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

function Root() {
  return <Composition id="StudySyncIntro" component={StudySyncIntro} durationInFrames={LENGTH} fps={30} width={1920} height={1080} />
}

registerRoot(Root)
