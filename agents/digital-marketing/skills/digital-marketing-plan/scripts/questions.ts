/**
 * The campaign intake questions, and what each answer switches on.
 *
 * Single source of truth for what a campaign is asked; `showIf` decides skips
 * here, not the model. Release types only. `primary_goal` is a choice, not free
 * text, because the spend split in knowledge/paid-promotion.md branches on it.
 * Order is dependency order: `project_type` decides which questions exist and
 * `platforms` bounds every post task. The total may shrink mid-interview, never grow.
 * Early questions are offers from `artist.projects`; each `because` names the column.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow, Question } from "../../../../../engine/interview/core";

/**
 * The task families a plan must contain. Not phase names: phases are the plan's
 * choice. The four `ads_*` branches are the spend split in
 * knowledge/paid-promotion.md, selected by `primary_goal` alone.
 */
export type Branch =
  | "presave"
  | "playlist_pitch"
  | "launch_event"
  | "post_release"
  | "ads_streams"
  | "ads_video"
  | "ads_social";

/** Every project type the schema's CHECK constraint allows. All three are releases. */
const RECORDS = ["album_release", "ep_release"];

const isType = (...types: string[]) => (a: Record<string, unknown>) =>
  types.includes(String(a.project_type ?? ""));

/**
 * `artist.projects.project_type` → this question's options. The vocabularies
 * differ on purpose; a mapped type is offered, every other type is asked.
 */
export const FROM_PROJECT: Record<string, string> = {
  single: "single_release",
  ep: "ep_release",
  album: "album_release",
  // No `tour`: tour campaigns are out of scope, so a tour project offers nothing.
};

export const QUESTIONS: Question[] = [
  {
    id: "title",
    order: 1,
    ask: {
      en: "What are we calling this campaign? The release or event name is fine.",
      fr: "On appelle ça comment, cette campagne ? Le nom de la sortie ou de l'événement, c'est correct.",
    },
    topic: { en: "the name", fr: "le nom" },
    type: "text",
    required: true,
    because:
      "artist.marketing_campaigns.title is not nullable, and every task, brief and handoff is named after it. Offered from artist.projects.title when this campaign belongs to a scoped project — the artist named it once, with the label manager.",
  },
  {
    id: "project_type",
    order: 2,
    ask: {
      en: "What are we putting out — a single, an EP, or an album?",
      fr: "Qu'est-ce qu'on sort — un single, un EP ou un album ?",
    },
    topic: { en: "what it is", fr: "c'est quoi" },
    type: "choice",
    options: ["single_release", "ep_release", "album_release"],
    required: true,
    opens: {
      single_release: ["presave", "playlist_pitch"],
      ep_release: ["presave", "playlist_pitch"],
      album_release: ["presave", "playlist_pitch"],
    },
    because:
      "Decides which task families the plan must contain, and which of the questions below are asked at all. Offered from artist.projects.project_type THROUGH `FROM_PROJECT` — the two vocabularies are not the same set, so this is a mapping and never a copy.",
  },
  {
    id: "target_date",
    order: 3,
    ask: {
      en: "When does it come out?",
      fr: "Ça sort quand ?",
    },
    topic: { en: "the date", fr: "la date" },
    type: "date",
    required: true,
    because:
      "The anchor. Every task's due_date is this date plus an offset, so nothing can be dated without it. Offered from artist.projects.street_date; when projects.date_is_target is true the date is a month aimed at rather than a date fixed, and the plan says so instead of pretending.",
  },
  {
    id: "platforms",
    order: 4,
    // Asked to remove, never to fill in: offers.ts always adopts the four baseline
    // platforms. A missing account is not a reason to drop one from the plan.
    // `houselabel profile` remains the only writer of artist.platforms.
    ask: {
      en:
        "I'm planning for Instagram, TikTok, Facebook and YouTube — the four we want every artist on. Anything there you won't post to? Say so and I'll drop it. X and YouTube Shorts are available too if you want them in.",
      fr:
        "Je planifie pour Instagram, TikTok, Facebook et YouTube — les quatre sur lesquels on veut chaque artiste. Il y en a un que tu ne feras pas ? Dis-le et je l'enlève. X et YouTube Shorts sont disponibles aussi si tu les veux.",
    },
    topic: { en: "the platforms", fr: "les plateformes" },
    type: "multi",
    options: ["instagram", "tiktok", "facebook", "x", "youtube", "youtube_shorts"],
    required: true,
    because:
      "Bounds every post task in the plan, and decides the cross-platform groups a single asset has to go out on. ALWAYS ADOPTED from the baseline in offers.ts — Instagram, TikTok, Facebook, YouTube (plus Shorts) — whether or not the artist has linked them, because the label wants every artist on those four and the plan is what gets them there. Linked accounts add to that set; they no longer define it. Planning only what is already linked silently dropped TikTok from the plan of every artist who had not got round to it, which is the artist who most needs it there. Reached only when the artist wants something removed.",
  },
  {
    id: "primary_goal",
    order: 5,
    ask: {
      en: "What is this campaign for — more streams, more video views, a bigger following? Name what matters most first if it's more than one.",
      fr: "La campagne sert à quoi — plus d'écoutes, plus de vues, plus d'abonnés ? Nomme ce qui compte le plus en premier s'il y en a plus d'un.",
    },
    topic: { en: "what it's for", fr: "à quoi ça sert" },
    // Multi, not choice: a campaign often has several goals. The first named leads
    // the spend split.
    type: "multi",
    options: ["streams", "video_views", "followers"],
    required: true,
    opens: {
      streams: ["ads_streams"],
      video_views: ["ads_video"],
      followers: ["ads_social"],
    },
    // No `tickets`: it only applied to show and tour campaigns.
    because:
      "Selects the spend split. Half a streams budget goes to ads pointed at Spotify; a followers budget goes to TikTok Spark Ads and creator seeding instead. Same money, different campaign.",
  },
  {
    id: "success_looks_like",
    order: 5.5,
    ask: {
      en: "Put a number on it — what would make this campaign a win? Something you could check on a specific date. \"1,000 streams on the lead single by December 15\", \"200 pre-saves before release\", \"50 new people on the mailing list\".",
      fr: "Mets un chiffre dessus — ça ressemblerait à quoi, une campagne réussie ? Quelque chose de vérifiable à une date précise. « 1 000 écoutes sur le single d'ici le 15 décembre », « 200 pré-sauvegardes avant la sortie », « 50 nouvelles personnes sur l'infolettre ».",
    },
    topic: { en: "what a win looks like", fr: "c'est quoi une réussite" },
    type: "text",
    required: true,
    because:
      "SMART, or it is a wish: specific, measurable, achievable, relevant, time-bound. `primary_goal` says which DIRECTION the spend goes; this says when the artist gets to find out whether it worked. Without it the day-28 read has nothing to compare against and becomes a list of numbers that went up. Two targets worth suggesting when the artist has none, because both are reachable and both are documented: 200 pre-saves, which is where the 40–60% first-week algorithmic lift shows up, and a save rate above 20%, which the platform weights about 3× above stream count.",
  },
  {
    id: "budget",
    order: 6,
    ask: {
      en: "What's the budget for this? Zero is a real answer — the plan just comes out fully organic.",
      fr: "C'est quoi le budget ? Zéro est une vraie réponse — le plan sort juste 100 % organique.",
    },
    topic: { en: "budget", fr: "budget" },
    type: "money",
    required: false,
    because:
      "Caps the sum of every task's cost, and gates whole tactics: Spotify Ad Studio has a $250 floor and a publicist under $1000 is money better spent on ads. Unanswered is NOT zero — zero rewrites each paid task as its organic equivalent, unanswered leaves costs alone and makes the total honest. Offered from artist.projects.budget_amount, which is the WHOLE release's budget: marketing is a share of it, so the offer is a ceiling to spend under, never the number to spend.",
  },
  {
    id: "angle",
    order: 7,
    ask: {
      en: "What's the story here? The one thing you want someone to walk away knowing.",
      fr: "C'est quoi l'histoire ? La seule affaire que tu veux que le monde retienne.",
    },
    topic: { en: "the angle", fr: "l'angle" },
    type: "text",
    required: true,
    because:
      "Becomes the campaign's key messages, which every caption and ad afterward is written from. Content that invents a competing angle mid-campaign is what makes one release read as two.",
  },

  // ── type-specific: asked only when the project type makes them mean something ──
  {
    id: "standalone",
    order: 8,
    ask: {
      en: "Is this single standing on its own, or is it the lead for something bigger coming?",
      fr: "Ce single-là, il vit tout seul, ou c'est le premier extrait de quelque chose de plus gros ?",
    },
    topic: { en: "standalone or lead", fr: "seul ou premier extrait" },
    type: "choice",
    options: ["standalone", "lead_single"],
    required: false,
    because:
      "A lead single's campaign has to leave room for the record's campaign behind it — it spends less and holds content back.",
    dependsOn: ["project_type"],
    showIf: isType("single_release"),
  },
  {
    id: "lead_track",
    order: 9,
    ask: {
      en: "Which track leads, and is anything off this already out?",
      fr: "Quelle pièce mène, et est-ce qu'il y a déjà quelque chose de sorti ?",
    },
    topic: { en: "the rollout order", fr: "l'ordre de sortie" },
    type: "text",
    required: false,
    because:
      "The rollout order decides what the pre-release weeks have to post about. A record with two singles already out runs a different pre-release than one with none. The lead is offered from artist.projects.lead_single_id — one editorial pitch exists per release and the label manager already spent the decision.",
    dependsOn: ["project_type"],
    showIf: isType(...RECORDS),
  },
  {
    id: "presave",
    order: 10,
    ask: {
      en: "Is there a pre-save link for the release itself, and is the editorial pitch in?",
      fr: "Est-ce qu'il y a un lien de pré-sauvegarde pour la sortie elle-même, et est-ce que le pitch éditorial est parti ?",
    },
    topic: { en: "pre-save and pitching", fr: "pré-save et pitch" },
    type: "text",
    required: false,
    because:
      "The editorial pitch closes when the track goes live and there is exactly one per release, so if it isn't done it is a dated task, not advice. Asked of a record too, because the album's own pre-save is not the lead single's — see below.",
    dependsOn: ["project_type"],
    // Asked of every release type: an album's pre-save is a different link from
    // the lead single's and saves the whole record.
    showIf: isType("single_release", ...RECORDS),
  },
  {
    id: "launch_event",
    order: 11,
    ask: {
      en: "Is there a launch — a listening party, a release show, anything in a room?",
      fr: "Y a-t-il un lancement — une écoute, un show de sortie, quelque chose dans une salle ?",
    },
    topic: { en: "the launch", fr: "le lancement" },
    type: "choice",
    options: ["yes", "no"],
    required: false,
    opens: { yes: ["launch_event"] },
    because:
      "A launch event is its own promotion inside the campaign — an invite, a reminder, and recap content — and it routes to booking, which owns the room.",
    dependsOn: ["project_type"],
    showIf: isType(...RECORDS),
  },

  // ── the common tail. Asked of every project type. ────────────────────────
  {
    id: "existing_content",
    order: 19,
    ask: {
      en: "What do you already have shot — photos, video, artwork, anything sitting on a drive?",
      fr: "Qu'est-ce que tu as déjà de tourné — des photos, de la vidéo, des visuels, n'importe quoi qui traîne sur un disque ?",
    },
    topic: { en: "what exists", fr: "ce qui existe déjà" },
    type: "text",
    required: true,
    because:
      "Decides how many create tasks the plan has to book. A campaign planned as if nothing exists asks the artist to reshoot what is already on their drive; one planned as if everything exists ships post tasks with nothing to post.",
  },
  {
    id: "camera_comfort",
    order: 19.2,
    ask: {
      en: "How do you feel about being on camera — happy talking to it, fine performing but not talking, or you'd rather not be in frame at all?",
      fr: "Comment tu te sens face à la caméra — à l'aise de parler dedans, correct pour jouer mais pas pour parler, ou tu préfères ne pas être dans le cadre ?",
    },
    topic: { en: "being on camera", fr: "la caméra" },
    type: "choice",
    options: ["talking", "performing_only", "not_in_frame"],
    required: true,
    opens: {
      talking: ["face_to_camera"],
      performing_only: ["performance_led"],
      not_in_frame: ["faceless"],
    },
    because:
      "Decides what kind of content can exist at all. A plan full of talking-head pieces handed to someone who will not talk to a camera is a plan of tasks they quietly skip — and the skipping reads as the plan being wrong. An artist who stays out of frame gets lyric cards, hands, gear, location and performance footage instead, which is a different campaign and a perfectly good one.",
  },
  {
    id: "comparable_artists",
    order: 19.3,
    ask: {
      en: "Who are you next to? Two or three artists whose fans would probably like this.",
      fr: "Tu te places à côté de qui ? Deux ou trois artistes dont le monde aimerait probablement ça.",
    },
    topic: { en: "who you're next to", fr: "à côté de qui" },
    type: "text",
    required: false,
    because:
      "Names the audience the content is aimed at, and the scene the tags and collaborations come from. Without it a plan targets the genre, which is nobody.",
  },
  {
    id: "owned_audience",
    order: 19.4,
    ask: {
      en: "Anywhere you reach people directly — a mailing list, a Discord, a Substack, a group chat, a local scene?",
      fr: "As-tu un endroit où tu rejoins le monde directement — une infolettre, un Discord, un Substack, un groupe, une scène locale ?",
    },
    topic: { en: "who you reach directly", fr: "qui tu rejoins directement" },
    type: "text",
    required: true,
    because:
      "The only audience with no algorithm in between, and the one most plans forget. A mailing list of 200 outperforms a platform post to 2,000 on release day, because the people on it chose to be there.",
  },
  {
    id: "weekly_capacity",
    order: 19.5,
    ask: {
      en: "Realistically, how much time a week can you put into making content for this?",
      fr: "Réalistement, tu peux mettre combien de temps par semaine à faire du contenu pour ça ?",
    },
    topic: { en: "time you have", fr: "le temps que tu as" },
    type: "text",
    required: true,
    because:
      "Sets how many create tasks the plan can contain. THE ARTIST ASKED FOR THIS QUESTION, in the middle of an interview that did not have it: a fourteen-to-twenty task campaign handed to someone with two hours a week is a plan they abandon in week two, and the abandonment reads as the plan being wrong rather than too big. the first House Label never asked it either, and its plans were the same size for everyone.",
  },
  {
    id: "collaborators",
    order: 20,
    ask: {
      en: "Anyone else on this — features, a producer, a director, a label or a partner?",
      fr: "Il y a quelqu'un d'autre là-dedans — des collabs, un réalisateur, un label, un partenaire ?",
    },
    topic: { en: "who else", fr: "qui d'autre" },
    type: "text",
    required: false,
    because:
      "A collaborator is an audience the campaign can reach for free, and a cross-post is worth more than most of what money buys at this budget.",
  },
  {
    id: "post_release",
    order: 21,
    ask: {
      en: "Do you want the campaign to keep going after the date — recaps, playlist pushes, fan reactions — or does it wrap there?",
      fr: "Est-ce que tu veux que la campagne continue après la date — retours, push playlist, réactions du monde — ou ça finit là ?",
    },
    topic: { en: "after the date", fr: "après la date" },
    type: "choice",
    options: ["yes", "no"],
    required: false,
    opens: { yes: ["post_release"] },
    because:
      "Sets where the plan ends. Answered no, the last task is on the date; answered yes, the plan runs one to two weeks past it and the algorithmic window gets worked instead of abandoned.",
    // Every remaining type is a release, so this is asked of everyone.
  },
  {
    id: "anything_else",
    order: 22,
    ask: {
      en: "Anything else I should know? Time you're away, deadlines, label requirements, anything that could move the rollout.",
      fr: "Autre chose que je devrais savoir ? Des périodes où tu n'es pas là, des deadlines, des exigences du label, n'importe quoi qui pourrait bouger le plan.",
    },
    topic: { en: "anything else", fr: "autre chose" },
    type: "text",
    required: true,
    because:
      "Always last, and never skipped. This is where the two weeks the artist is out of the country arrives, and a plan that books a shoot inside them is a plan that gets thrown away rather than edited.",
  },
];

export const FLOW: Flow = {
  name: "digital-marketing-plan",
  questions: QUESTIONS,
};
