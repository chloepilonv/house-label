/**
 * The questions each department asks, as data: numbered into the prompt, one
 * mandatory final question, and a sentinel the code watches to end the phase.
 * Every folder under agents/ has an entry (questions.test.ts checks); `null`
 * means the department answers rather than interviews.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export interface Flow {
  /** When this interview runs, in the department's own words. */
  purpose: string;
  /** Asked in order. The model skips any it can already answer from the brief. */
  questions: string[];
  /** Always asked last. */
  final: string;
  /**
   * Emitted alone on the last line when the interview is complete.
   * engine/session.ts watches for it; nothing else ends the phase.
   */
  token: string;
  /**
   * Extra questions selected by what the artist is working on, merged in front
   * of `questions` when the conversation names one.
   */
  variants?: Record<string, string[]>;
}

const DONE = "[READY]";

export const FLOWS: Record<string, Flow | null> = {
  // ── recruiting (artists never meet it) ──────────────────────────────────
  "agent-recruitor": null,


  "digital-marketing": {
    purpose: "before building a campaign plan",
    questions: [
      "What's your budget for this? Zero is a real answer — we'll work with it.",
      "Do you have photos or video ready to go?",
      "Anyone else involved — features, collaborators, a partner brand?",
      "What would make this feel like it worked?",
    ],
    variants: {
      single_release: [
        "What's the story behind this song? What made you write it?",
        "Is it standing alone, or is it the first taste of something bigger?",
      ],
      album_release: [
        "What holds this album together — a theme, a period of your life, a sound?",
        "Which song goes out first, and what comes after it?",
      ],
      show: [
        "Tell me about the show — which room, and are you headlining?",
        "How many tickets do you need to sell for this to feel good?",
      ],
      tour: [
        "How many dates, and which cities?",
        "Is new music coming out around it, or is this a run on its own?",
      ],
      music_video: [
        "What happens in the video? Even a rough idea helps.",
        "Is it already shot, or still being planned?",
      ],
      merch_launch: [
        "What are you selling — shirts, vinyl, something else?",
        "Is this a one-time drop or something you'll keep in stock?",
      ],
    },
    final:
      "Anything else I should know? Dates you're away, deadlines, or anything that could get in the way of the rollout?",
    token: DONE,
  },

  distribution: {
    purpose: "before comparing distributors",
    questions: [
      "Are you with a distributor right now? If so, which one?",
      "How many songs do you expect to put out in the next year?",
      "Would you rather pay once a year, or give up a percentage of what you earn?",
      "Do you need anything beyond the usual stores — YouTube money, Shazam, physical, sync?",
      "Are you releasing on your own, or is anyone else on the record with you?",
    ],
    final: "Anything else about how you release music? A bad experience, a contract you're stuck in, anything?",
    token: DONE,
  },


  "label-manager": {
    purpose: "before scoping a project into a plan",
    questions: [
      "What are you working on — a song, an album, a show, a tour, something else?",
      "When does it need to be out or happen?",
      "What's already done, and what hasn't been started?",
      "Are you doing this alone, or is anyone else involved?",
      "What's the money situation for this project?",
      "What's the one thing that would make this a success for you?",
    ],
    final: "Anything else I should know before I lay out the plan? Anything you're dreading, or anything already booked?",
    token: DONE,
  },

  // Leaves unreported metrics blank, so a fixed question list would contradict it.
  platforms: null,


  press: {
    purpose: "before writing the pitch and working the contact list",
    questions: [
      "What's coming out, and on what date?",
      "In one or two sentences, what makes this one different from your last?",
      "Has anyone written about you before? Even a small blog counts.",
      "Which cities or regions matter most for this?",
      "Do you want to be covered in French, English, or both?",
      "Is there anything already confirmed — a premiere, a session, a festival?",
    ],
    final: "Anything else worth telling a journalist? A story behind the record, who played on it, where it was made?",
    token: DONE,
  },

  promotion: {
    purpose: "before shortlisting stations or playlists",
    questions: [
      "Which country are you working this record in — Canada, the United States, or both?",
      "What are you sending them — a single, an EP, or an album? Several campus stations refuse singles in writing.",
      "When does it come out? Radio runs weeks ahead of release; the Spotify editorial pitch closes seven days before it.",
      "Anywhere in particular you want to be heard?",
      "Is there any budget for this, or should I stick to the free routes? The cheapest real radio campaign in Canada is $7.",
    ],
    final: "Anything else about this record or where you want it played? Something a station already said, a curator you know, anything?",
    token: DONE,
  },

  presskit: {
    purpose: "before generating the deck",
    questions: [
      "How would you describe your music to someone who's never heard it?",
      "Where are you based?",
      "What have you put out so far, and what's the most recent?",
      "Has anyone written about you, or quoted you anywhere?",
      "Any awards, festivals, or notable shows?",
      "Who's on your team — manager, booker, publicist — and who should press contact?",
      "Do you have photos you own the rights to?",
    ],
    final: "Anything else you'd want a journalist or a booker to know in the first thirty seconds?",
    token: DONE,
  },

  rights: {
    purpose: "before building the registration checklist",
    questions: [
      "Which country do you live in, and which province or state?",
      "Do you write your own songs, perform them, or both?",
      "Have you signed up with any collection society yet — SOCAN, ASCAP, BMI, SoundExchange?",
      "Do you own your recordings, or does someone else?",
      "Roughly how many songs have you released?",
      "Is anyone else a writer on your songs?",
    ],
    final: "Anything else about who owns what? A co-writer, an old deal, a producer who took points?",
    token: DONE,
  },
};

/** The sentinel, on its own line, ends the interview. */
export function isComplete(text: string, flow: Flow): boolean {
  return text.includes(flow.token);
}

/** Strip the sentinel before the artist ever sees it. */
export function stripToken(text: string, flow: Flow): string {
  return text.replaceAll(flow.token, "").trimEnd();
}

/**
 * The block that goes into the system prompt. `known` facts are listed
 * explicitly as "do NOT ask" rather than left to inference.
 */
export function renderFlow(flow: Flow, opts: { variant?: string; known?: string[] } = {}): string {
  const variant = opts.variant ? (flow.variants?.[opts.variant] ?? []) : [];
  const all = [...variant, ...flow.questions];
  const known = opts.known?.length
    ? `\nALREADY ON FILE — do NOT ask about these:\n${opts.known.map((k) => `- ${k}`).join("\n")}\n`
    : "";

  return `INTERVIEW — ${flow.purpose}.

Ask ONE question per turn. Never a list, never two questions in one message.
Skip any question you can already answer from the artist's file.
${known}
QUESTION FLOW:
${all.map((q, i) => `${i + 1}. ${q}`).join("\n")}

YOUR LAST QUESTION MUST ALWAYS BE:
"${flow.final}"

After the artist answers that one, summarise what you learned in plain language
and end your message with ${flow.token} on its own line. Write ${flow.token}
only then — it is how the rest of the program knows the interview is finished.`;
}
