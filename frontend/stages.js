// What the caller sees at each stage.
// "mayHear" lines are what prospects actually said at that point in the
// 100 transcripts (reworded only to be short). "fromCalls" is the pattern
// behind them, so the caller knows why it is on the screen.

window.STAGES = [
  {
    n: 1,
    name: "Opening",
    forWhat: "Reach the right person and say who you are. They decide in ten seconds.",
    mayHear: [
      "“From where? Meridian?” (asked again in most calls)",
      "“He left the company last year.” / “This has been my number for 10 years.”",
      "“I am driving.” / “I am in a meeting, call after one hour.”",
      "Reception: “Your name and reason for calling?”",
    ],
    fromCalls:
      "13 of 100 calls reached someone who had left or never worked there. Confirm the company before the pitch. Say “Meridian, Hyderabad” slowly, once.",
    taps: [
      "Right person, listening",
      "Reception, asked reason",
      "Asked who we are again",
      "Wrong number or person",
      "Has left the company",
      "Wants another language",
    ],
    wordsHint: "If wrong person: who they named as the right one",
  },
  {
    n: 2,
    name: "Purpose",
    forWhat: "Why you called, in one or two sentences they can repeat to a colleague.",
    mayHear: [
      "“What does a growth report mean, actually?”",
      "“What are the charges? Then why is it free?”",
      "“Where did you get my number?”",
      "“Is this about a job opening?”",
    ],
    fromCalls:
      "Labels like “operational problems during growth” got “but what do you do?” twice. One real example (a client who could not deliver on time) landed in one go.",
    taps: [
      "Asked what we do",
      "Asked cost or why free",
      "Asked where we got the number",
      "Thought it was a job or vendor call",
      "Let me go on",
    ],
    wordsHint: "Their question, as they asked it",
  },
  {
    n: 3,
    name: "Permission",
    forWhat: "Are they willing to talk now? A clear yes, a clear no, or a time to call back.",
    mayHear: [
      "“Can you call me at 1:30?” / “Call me tomorrow after 3.”",
      "“Send it on WhatsApp first, I will reply.”",
      "“Tell me quickly. Short.”",
      "“Haan, boliye.” and then silence",
    ],
    fromCalls:
      "Many prospects gave their own callback time (1:30, after 3, in an hour) or asked for WhatsApp first. Note their exact time: it is worth more than one you propose.",
    taps: [
      "Yes, talk now",
      "Yes, but keep it short",
      "Call back at a time they named",
      "Send it in writing first",
      "No",
    ],
    wordsHint: "The callback time, in their words",
  },
  {
    n: 4,
    name: "Their business",
    forWhat: "Ask about their company before saying anything more about yours.",
    mayHear: [
      "“We only manufacture.” / “We work on job work basis.”",
      "“Decisions are taken at corporate in the US.”",
      "“I only handle sustainability / supply chain.”",
      "“We are the market leader.” / “Mine is a very small company.”",
    ],
    fromCalls:
      "Prospects corrected the caller often: wrong size, wrong division, decisions made elsewhere. A correction is information, not a no.",
    taps: [
      "Described their business",
      "Corrected us",
      "Decisions made elsewhere",
      "One line, waiting for the pitch",
    ],
    wordsHint: "What they make, for whom, in their words",
  },
  {
    n: 5,
    name: "Their need",
    forWhat: "Hear what they are trying to do or struggling with. Write it down exactly.",
    mayHear: [
      "“The biggest challenge is skilled manpower.”",
      "“My customers want sustainability they can show in Europe and the US.”",
      "“I am looking for new products we can make with our facility.”",
      "“We are on the right track, no challenges.”",
    ],
    fromCalls:
      "Few calls reached this stage, and when they did the exact words were rarely logged. These words are what the next call is built on.",
    taps: [
      "Named a goal or problem",
      "Said all is fine",
      "Would not share",
      "Asked what we can do for them",
    ],
    wordsHint: "Their exact words. This is the one box that matters most.",
    wordsKey: true,
  },
  {
    n: 6,
    name: "Objection",
    forWhat: "Hear the reason for a no and understand it. Do not talk over it.",
    mayHear: [
      "“I am not the right person. Speak to the CFO / head office.”",
      "“We already work with consultants, the Big Four.”",
      "“Why would we give our data to a third party?”",
      "“Send your website, clients and a sample first.”",
    ],
    fromCalls:
      "“Not the right person” was the most common no. Ask for the name of the right person before the call ends.",
    taps: [
      "Not the right person",
      "Already have consultants",
      "Data or confidentiality",
      "Wants proof first",
      "Not interested now",
    ],
    wordsHint: "The reason, in their words. Name of the right person, if given.",
  },
  {
    n: 7,
    name: "Next step",
    forWhat: "Agree one concrete thing, with a time or a channel.",
    mayHear: [
      "“Send it on WhatsApp, same number.”",
      "“Mail it to my official ID, not personal.”",
      "“Next week Tuesday, after 2 PM.”",
      "“Talk to Mr. Sen. He might help you.”",
    ],
    fromCalls:
      "A yes to a document can be politeness. Callers often logged it as “interested”. Ask for a call time after they read it.",
    taps: [
      "Report on WhatsApp",
      "Report on email",
      "Call at a named time",
      "Meeting with founder (Google Meet)",
      "Referred to a colleague",
      "Nothing agreed",
    ],
    wordsHint: "The time or channel they named",
  },
  {
    n: 8,
    name: "Close",
    forWhat: "End clearly, then record the outcome, the next step and their words.",
    mayHear: [
      "“What is your good name?” (a good sign: they plan to remember you)",
      "The line drops mid-sentence",
      "A warm goodbye after a no, which is still a no",
    ],
    fromCalls:
      "13 calls were never logged, and some logs did not match the call. The check below compares your outcome with what was recorded.",
    taps: ["Ended clearly", "Line dropped", "They hung up"],
    wordsHint: "Anything to remember for the next call",
  },
];

// The caller's outcome words (from the transcripts README).
window.OUTCOMES = [
  { key: "agreed_to_receive_report", label: "Agreed to receive report" },
  { key: "next_step_agreed", label: "Next step agreed (time, meeting, referral)" },
  { key: "interested", label: "Interested, no fixed next step" },
  { key: "follow_up", label: "Follow up: we call again" },
  { key: "call_again", label: "Call again (language or line)" },
  { key: "not_interested", label: "Not interested" },
  { key: "do_not_call", label: "Do not call" },
  { key: "wrong_person", label: "Wrong person" },
  { key: "moved_company", label: "Moved company" },
];
