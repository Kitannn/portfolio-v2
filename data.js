// All site content lives here. Edit text, links, and image paths without touching the layout code.
// High-res photos: overwrite files in /images/photos, /images/k2ttan or /images/games with the same
// name, or drop new files in and update the paths below. Missing hero photos are skipped automatically.
window.SITE = {
  name: "Henry Tan",
  handle: "kitannn°",
  role: "Game Designer",
  location: "Vancouver, BC",
  // Split so the address never appears in the HTML; shown as user[at]domain.
  email: { user: "hkitannn", domain: "gmail.com" },
  resume: "assets/resume/TAN_HENRY_RESUME.pdf",
  cvPage: "cv.html",
  portrait: "images/photos/001321830020.jpg",
  avatar: "images/birbkit-256.jpg",
  faqImage: "images/birbkit-1024.jpg",
  faqImageCrop: false, // remove (or set true) to crop the FAQ image to portrait 4:5

  about: [
    "I'm a game designer with 5+ years of development experience, specializing in content and technical design for live service titles.",
    "I started in QA and game security on FIFA Mobile, moved into game and technical design at EA, then designed FTUE, quests and event loops for The Sims: Town Stories at Maxis. Today I'm Game Director at Ghost Fox Games — a studio of EA veterans in the 2026 Roblox Incubator — building Cosmic Carnage.",
    "Off the clock I shoot street, travel and portrait photography, and a lot of live music.",
  ],

  identity: [
    ["Name", "Henry Tan"],
    ["Alias", "kit / kitannn"],
    ["Based", "Vancouver, BC 🇨🇦"],
    ["Studio", "Ghost Fox Games"],
    ["Languages", "English, Cantonese"],
    ["Education", "BCIT — Computer Systems Technology"],
  ],

  stats: [
    ["5+", "Years in games"],
    ["3", "Franchises shipped on"],
    ["2026", "Roblox Incubator"],
  ],

  styles: ["Technical Design", "Content Design", "Live Ops", "Unity", "Unreal Engine", "Roblox / Luau", "C#", "C++", "Lua", "Python", "AMP", "Haxe", "Jira", "Perforce", "Photography"],

  // Résumé — feeds the Profile timeline and cv.html.
  cv: {
    summary: "Game Designer with 5+ years of development experience specializing in content and technical design for live service titles. Proven track record of mastering complex tools and delivering in fast-paced environments.",
    experience: [
      {
        org: "Ghost Fox Games", role: "Game Director", project: "Cosmic Carnage, Roblox Studio", when: "Apr 2026 – Present",
        bullets: [
          "Co-founded an independent studio of EA veterans building UGC experiences; accepted into the 2026 Roblox Incubator program",
          "Engineered and prototyped core PvP vehicular combat mechanics, weapon systems, and player customization using Luau in Roblox Studio during a 3-week sprint cycle",
          "Designed and implemented technical match structures and gameplay systems, maintaining clean technical documentation to streamline feature scaling across team members",
        ],
      },
      {
        org: "EA, Maxis", role: "Game Designer", project: "The Sims: Town Stories, Unity", when: "Mar 2024 – Mar 2026",
        bullets: [
          "Bridged design and engineering teams by establishing technical specifications, scripting core event logic in AMP, and prototyping feature tools in Unity using C#",
          "Designed and iterated player-centric experiences, including the First-Time User Experience (FTUE), quests, and event loops to optimize player retention and progression",
          "Built custom engine toolsets in C# (3D asset loaders, cinematic tools, and component organizers) that improved team workflows and optimized game performance",
          "Authored comprehensive technical design documentation in Jira/Confluence and collaborated across disciplines to guide engineers on feature implementation and system behavior",
        ],
      },
      {
        org: "EA", role: "Technical Game Designer", project: "FIFA Mobile, EA Impact Engine", when: "Sep 2022 – Mar 2023",
        bullets: [
          "Designed, prototyped, and integrated complex front-end features and gameplay mechanics using Haxe (Impact engine converts it to C++), and managed branches in Perforce to support live game content",
          "Engineered custom designer toolsets using C++ and Haxe, empowering team members to rapidly prototype, iterate, and integrate new UI ideas into the build",
          "Supported live-service event content such as the 2022 FIFA World Cup in-game event that garnered record-breaking DAU",
          "Tracked feature milestones, managed technical backlogs, and prioritized bugs using Jira while collaborating with cross-functional stakeholders",
        ],
      },
      {
        org: "EA", role: "Game Designer", project: "FIFA Mobile, EA Impact Engine", when: "Mar 2022 – Sep 2022",
        bullets: [
          "Tuned and balanced live gameplay mechanics, utilizing feedback and telemetry data to refine player experience and feature equilibrium",
          "Owned live content deploy processes for weekly game updates and bug fixes",
          "Collaborated with cross-functional disciplines to improve design and implementation techniques",
          "Led the design, prototyping, and implementation of front-end features for FIFA Mobile",
        ],
      },
      {
        org: "Keywords Studios – EA", role: "Game Security Analyst", when: "May 2021 – Mar 2022",
        bullets: [
          "Collaborated with security and player-first teams to enforce game integrity and anti-cheat standards",
          "Developed Python and Splunk scripts/queries to investigate security threats and terms of service violations",
          "Built Splunk dashboards and reports to visualize player data and monitor game health",
          "Monitored social media and community feedback to identify and resolve live-service issues",
        ],
      },
      {
        org: "Keywords Studios – EA", role: "QA Development Support III", when: "Jun 2019 – May 2021",
        bullets: [
          "Executed comprehensive test plans and regression testing for new live-service content",
          "Developed node-based automation scripts to streamline content testing and validation",
          "Coordinated with production and design teams to align quality standards logged in Jira",
          "Authored technical documentation and trained analysts on QA processes",
        ],
      },
    ],
    skills: ["Unity", "Unreal Engine", "C#", "C++", "Lua", "Python", "AMP", "Haxe", "Jira", "Perforce"],
    proficiencies: ["Technical Design and Implementation", "Game Content Design", "Automation Scripting", "Regression Testing"],
    languages: ["English", "Cantonese Chinese"],
    education: [{ school: "British Columbia Institute of Technology", place: "Burnaby, BC", credential: "Diploma in Computer Systems Technology" }],
  },

  // Work entries. `cover` may be empty — a generated title card is shown instead.
  // `logo` (optional) shows on the project page. `pos` sets the card crop (CSS object-position).
  work: [
    {
      title: "Ghost Fox Games", tag: "Cosmic Carnage · Roblox", kind: "game", year: "2026", featured: true,
      cover: "images/games/cc-boom.jpg", pos: "50% 50%", logo: "images/games/gfg-logo.png",
      links: [["ghostfoxgames.ca ↗", "https://ghostfoxgames.ca"], ["Roblox Incubator 2026 ↗", "https://about.roblox.com/newsroom/2026/06/2026-roblox-incubator-cohort"]],
      summary: "Game Director at Ghost Fox Games, an independent studio of seven EA veterans in the 2026 Roblox Incubator. Our lead title, Cosmic Carnage, revives classic car combat as a futuristic demolition derby, with outlandish hero vehicles battling across explosive, ever-changing arenas.",
      details: [
        ["Role", "Co-Founder / Game Director"],
        ["Games", "Cosmic Carnage, Crater Crashers"],
        ["Program", "Roblox Incubator 2026"],
        ["Built", "PvP vehicular combat, weapon systems, customization, match structure"],
        ["Stack", "Roblox Studio, Luau, Rojo"],
      ],
      images: ["images/games/cc-boom.jpg", "images/games/cc-tornado.jpg", "images/games/cosmic-carnage-keyart.jpg"],
      responsibilities: [
        {
          title: "Studio & Direction",
          items: [
            "Co-founded a studio of seven EA veterans; accepted into the 2026 Roblox Incubator",
            "Game Director — set match structure and core gameplay systems",
            "Shipped in 3-week sprints with clear system documentation for the team",
          ],
        },
        {
          title: "AI & NPCs",
          items: [
            "Built NPC behaviour with AI pathing, targeting and threat management",
            "Scripted NPC combat — weapon aiming, shooting and friendly-fire rules",
            "Separated AI vehicle logic from player physics; tuned NPC stats and damage",
          ],
        },
        {
          title: "Gameplay Systems",
          items: [
            "Built match structure with automated rounds and map rotation",
            "Built AFK handling and late-join support",
            "Built match start and end flow, including camera sequences and reward screens",
            "Implemented dynamic world events and environmental hazards with configurable tuning",
            "Wrote unit tests for event physics logic",
          ],
        },
        {
          title: "Player Systems & UI",
          items: [
            "Built vehicle selection and customization",
            "Implemented shop and reward opening flows",
            "Built HUD systems — minimap, health and shield indicators, damage feedback, onboarding guide",
            "Integrated art-authored UI for lobby, match and results screens",
          ],
        },
        {
          title: "Controls",
          items: [
            "Built control schemes across mobile, gamepad, PC and console",
            "Designed multiple mobile steering options with an auto-drive assist",
            "Implemented combat inputs such as shielding and parrying",
          ],
        },
        {
          title: "Technical Design & Stack",
          items: [
            "Luau, Roblox Studio, Rojo, Git/GitHub",
            "Server-authoritative client/server architecture with remote events and replication",
            "Data-driven config modules and feature flags",
            "Wrote technical design docs for core systems",
            "Fixed memory leaks, replication issues and client/server edge cases",
          ],
        },
      ],
    },
    {
      title: "The Sims: Town Stories", tag: "EA Maxis · Game Designer · Unity", kind: "game", year: "2024—2026", featured: true,
      cover: "images/games/sims-cover.webp", pos: "50% 45%",
      summary: "A mobile town-building spin-off in The Sims franchise, set in the small town of Plumbrook. I designed the first-time user experience, quests and event loops, scripted core event logic in AMP, and built C# tools in Unity — asset loaders, cinematic tools and component organizers. The project was sunset by EA in 2026.",
      details: [
        ["Studio", "EA, Maxis"],
        ["Role", "Game Designer"],
        ["Focus", "FTUE, quests, event loops, tooling"],
        ["Stack", "Unity, C#, AMP, Jira/Confluence"],
        ["Status", "Soft-launch testing; sunset March 2026"],
      ],
      images: [
        "images/games/sims-cover.webp",
        "images/games/sims-store-0.jpg", "images/games/sims-store-1.jpg", "images/games/sims-store-2.jpg",
        "images/games/sims-store-3.jpg",
      ],
      responsibilities: [
        {
          title: "Player Experience",
          items: [
            "Designed and iterated the first-time user experience (FTUE), introducing core systems one step at a time",
            "Designed quests and event loops supporting player retention and progression",
            "Used playtest feedback and gameplay data to catch friction points early",
          ],
        },
        {
          title: "Technical Design & Implementation",
          items: [
            "Implemented content and technical designs in Unity",
            "Wrote technical specifications bridging design and engineering",
            "Scripted core event logic in AMP",
            "Prototyped feature tools in Unity (C#)",
            "Authored technical design docs in Jira/Confluence to guide engineers on implementation and system behavior",
          ],
        },
        {
          title: "Tools",
          items: [
            "Designed a cinematics feature and toolset for designers",
            "Built C# Unity tools — 3D asset loaders, cinematic tools, component organizers",
            "Sped up team workflows and improved game performance",
          ],
        },
        {
          title: "Ownership & Collaboration",
          items: [
            "Owned content features and tools from the project's unannounced R&D phase",
            "Point of contact for multiple areas of content implementation",
            "Wrote documentation and trained designers on implementation techniques and best practices",
            "Collaborated closely with engineers and artists; gave feedback in feature kick-offs and weekly design syncs",
          ],
        },
      ],
    },
    {
      title: "FIFA Mobile", tag: "EA · Game Designer · Impact Engine", kind: "game", year: "2019—2023", featured: true,
      cover: "images/games/fifam-card.jpg", pos: "50% 40%", logo: "images/games/fifam-logo.png",
      hero: "images/games/fifa-mobile-22.jpg",
      links: [["World Cup deep dive ↗", "https://www.ea.com/playtesting/news/world-cup-deep-dive"]],
      summary: "Four years on FIFA Mobile, from QA automation and game security to game design and technical game design. I built front-end features and designer tools in Haxe and C++ on EA's Impact engine, tuned live gameplay, owned weekly content deploys, and supported the 2022 FIFA World Cup event that set record DAU.",
      details: [
        ["Studio", "Electronic Arts (via Keywords Studios 2019–2022)"],
        ["Roles", "QA Dev Support III → Game Security Analyst → Game Designer → Technical Game Designer"],
        ["Shipped", "Front-end features, designer tooling, live events incl. FIFA World Cup 2022"],
        ["Stack", "Haxe, C++, Perforce, Splunk, Python, Jira"],
      ],
      images: [
        "images/games/fifam-ultimate-team.jpg", "images/games/fifam-angles.jpg", "images/games/fcm-gameplay.jpg",
      ],
      responsibilities: [
        {
          title: "Content Design",
          items: [
            "Designed multi-week live events with daily grind loops and reward progression — daily logins, currency build-ups, milestone rewards",
            "Tuned store offers, seasonal rank rewards and gameplay balance using player feedback and telemetry",
            "Owned weekly live content deploys and Perforce branch management",
          ],
        },
        {
          title: "Technical Design & Tools",
          items: [
            "Implemented technical designs for front-end features, events and designer tools in Haxe and C++ on EA's Impact engine",
            "Prototyped and built reusable designer components",
            "Auto-layout components that position related UI objects from a single placed origin, with all required data in one place",
            "Cut content implementation time and made onboarding new designers faster",
            "Audited legacy client code to find tool opportunities with no cross-feature impact",
          ],
        },
        {
          title: "Gameplay & Features",
          items: [
            "Designed and implemented arcade-style game modes — object placement, player AI and difficulty tuning",
            "Tuned player attributes including running speed, shot power and dribbling speed",
            "Built front-end feature components with engineers for use in event designs",
            "Updated missions and objectives components with UI/UX and game designers",
            "Introduced modern mobile systems such as combined milestones",
          ],
        },
        {
          title: "Animation Pipeline",
          items: [
            "Drove adoption of Unity animation tooling to upgrade existing animation workflows",
            "Expanded animation beyond stationary loops, opening up user-triggered animations",
            "Proved the approach with a game jam prototype and an animated nav-button demo, with no cross-feature impact",
            "Documented the upgraded workflow and pitched it for an upcoming season",
          ],
        },
        {
          title: "Collaboration",
          items: [
            "Worked across game design, engineering, UI/UX art, live ops, producers and product managers",
            "Partnered with PMs on feature prioritization and build scheduling",
            "Scripted features in proprietary engine and visual scripting tools, plus automation scripts",
          ],
        },
        {
          title: "Highlights",
          items: [
            "Supported the 2022 FIFA World Cup in-game event, which drew record-breaking DAU",
            "Built a library of compact designer components adopted by the content team",
            "Unlocked richer, user-triggered animation through upgraded tooling",
          ],
        },
      ],
    },
    {
      title: "Personal Projects", tag: "GitHub · Hackathons · Prototypes", kind: "game", year: "2017—2026", featured: true,
      cover: "", accent: "#3bb8f0",
      links: [["github.com/kitannn ↗", "https://github.com/kitannn"], ["Transcribe ↗", "https://github.com/a-rrivederci/transcribe"]],
      summary: "Side projects and game jams. Transcribe (EduHacks 2017) is a real-time transcription and captioning service built on Amazon Alexa and Google APIs. The rest are prototypes and clones I built to learn the craft: Hybrid2D3D (a 2D/3D beat 'em up in Unreal Engine 5), Landbird (2D infinite runner), Fleppybirb, Pong, Tetris in both Unity and Python, and snek.js.",
      details: [
        ["Hackathon", "Transcribe — EduHacks 2017 (Alexa, Google APIs)"],
        ["Games", "Hybrid2D3D, landbird, fleppybirb, pong_unity, tetris_unity, tetris_python, snek.js"],
        ["Stack", "Unreal Engine 5, Blueprints, Unity, C#, React, Node.js, JavaScript, Python, Pygame"],
      ],
      images: [],
      responsibilities: [
        {
          title: "Hybrid2D3D",
          items: [
            "Side-scrolling beat 'em up prototype with 2D sprite characters fighting in a 3D environment",
            "Player character with flipbook animations for idle, run, jump, dash, attack, hurt and death",
            "Enemies driven by an AI controller, with an enemy spawner and a health bar widget",
            "Custom side-scroller game mode, parallax backgrounds and a 2D tileset",
            "Unreal Engine 5.1, Blueprints, Paper2D, Enhanced Input, Git LFS",
          ],
        },
        {
          title: "Transcribe — EduHacks 2017",
          items: [
            "Real-time speech transcription and captioning service for presenters",
            "Built the React front end that records microphone audio and streams it to Google speech-to-text",
            "Wired the site to a Node.js server triggered by an Amazon Alexa skill (AWS Lambda)",
            "Transcriptions shown as AR subtitles in a companion Android app",
            "React, Node.js, Alexa Skills Kit, Google Cloud APIs, Heroku, ngrok",
          ],
        },
        {
          title: "Landbird",
          items: [
            "2D infinite runner built in Unity 2020",
            "Procedural ground, obstacle and point spawners with scrolling movement",
            "Jump and double-jump controls with animation triggers and game manager flow",
            "Unity, C#",
          ],
        },
        {
          title: "Fleppybirb",
          items: [
            "Flappy Bird-style prototype in Unity 2018",
            "Click-to-flap rigidbody physics, pipe spawner and scrolling obstacles",
            "Score tracking with a game-over screen and replay",
            "Unity, C#",
          ],
        },
        {
          title: "Pong & Tetris — Unity",
          items: [
            "Pong with 2D rigidbody physics and paddle hit-angle deflection",
            "Tetris with grid-based collision, row clearing and piece spawning",
            "Hold-to-move input and instant drop",
            "Unity 2018, C#",
          ],
        },
        {
          title: "Tetris — Python",
          items: [
            "Full Tetris clone with rotation, row clearing and next-piece preview",
            "Score and persistent high score saved to file",
            "Start menu and game-over flow",
            "Python, Pygame",
          ],
        },
        {
          title: "snek.js",
          items: [
            "Browser snake game rendered on HTML canvas",
            "Keyboard controls, scoring and high scores",
            "JavaScript, HTML",
          ],
        },
      ],
    },
    {
      title: "Tokyo", tag: "Photography · Travel & Street", kind: "photo", year: "2020", featuredPhoto: true,
      cover: "images/photos/k-013.jpg",
      summary: "Sensoji at dusk, Ginza crossings, Harajuku, Nezu, Odaiba and the rail lines between them.",
      details: [["Location", "Tokyo / Mt. Fuji, Japan"], ["More", "Instagram @kitannn"]],
      images: [
        "images/photos/k-013.jpg", "images/photos/k-009.jpg", "images/photos/k-010.jpg", "images/photos/k-011.jpg",
        "images/photos/k-012.jpg", "images/photos/k-014.jpg", "images/photos/k-015.jpg", "images/photos/k-016.jpg",
        "images/photos/k-017.jpg", "images/photos/k-018.jpg", "images/photos/k-019.jpg", "images/photos/k-020.jpg",
        "images/photos/k-023.jpg", "images/photos/k-024.jpg", "images/photos/k-035.jpg", "images/photos/k-036.jpg",
        "images/photos/k-037.jpg", "images/photos/k-038.jpg", "images/photos/k-039.jpg", "images/photos/k-040.jpg",
        "images/photos/k-041.jpg", "images/photos/k-060.jpg", "images/photos/ig-12.jpg", "images/photos/ig-06.jpg",
        "images/photos/ig-09.jpg",
      ],
    },
    {
      title: "Nights", tag: "Photography · Neon & Night", kind: "photo", year: "2020", featuredPhoto: true,
      cover: "images/photos/k-021.jpg",
      summary: "Golden Gai doorways, Kabukichō side streets and Akihabara after dark.",
      details: [["Location", "Shinjuku Golden Gai, Kabukichō, Akihabara"], ["Shot", "Handheld, available light"]],
      images: [
        "images/photos/k-021.jpg", "images/photos/k-022.jpg", "images/photos/k-025.jpg", "images/photos/k-026.jpg",
        "images/photos/k-027.jpg", "images/photos/k-028.jpg", "images/photos/k-029.jpg", "images/photos/k-030.jpg",
        "images/photos/k-042.jpg", "images/photos/k-043.jpg", "images/photos/k-044.jpg", "images/photos/k-045.jpg",
        "images/photos/ig-11.jpg",
      ],
    },
    {
      title: "Light Rooms", tag: "Photography · teamLab Borderless", kind: "photo", year: "2020",
      cover: "images/photos/k-031.jpg",
      summary: "Beams, mirrors and crowds inside teamLab Borderless.",
      details: [["Location", "teamLab Borderless, Odaiba"]],
      images: ["images/photos/k-031.jpg", "images/photos/k-032.jpg", "images/photos/k-033.jpg", "images/photos/k-034.jpg"],
    },
    {
      title: "Portraits", tag: "Photography · Neon & Experimental", kind: "photo", year: "2018—2020", featuredPhoto: true,
      cover: "images/photos/k-046.jpg",
      summary: "Portraits lit by lanterns, neon and a single desk lamp — some straight, some pushed through RGB splits and glitch.",
      details: [["Style", "Low light, practical lighting, in-camera effects"], ["Location", "Vancouver & Tokyo"]],
      images: [
        "images/photos/k-046.jpg", "images/photos/k-062.jpg", "images/photos/k-121.jpg", "images/photos/k-007.jpg",
        "images/photos/k-008.jpg", "images/photos/k-047.jpg", "images/photos/k-048.jpg", "images/photos/k-050.jpg",
        "images/photos/k-052.jpg", "images/photos/k-054.jpg", "images/photos/k-055.jpg", "images/photos/k-058.jpg",
        "images/photos/k-059.jpg", "images/photos/k-061.jpg", "images/photos/k-063.jpg", "images/photos/k-064.jpg",
        "images/photos/k-069.jpg", "images/photos/k-071.jpg", "images/photos/k-072.jpg", "images/photos/k-073.jpg",
        "images/photos/k-074.jpg", "images/photos/k-076.jpg", "images/photos/k-077.jpg", "images/photos/k-084.jpg",
        "images/photos/k-088.jpg", "images/photos/k-147.jpg", "images/photos/ig-10.jpg", "images/photos/ig-02.jpg",
        "images/photos/ig-08.jpg", "images/photos/ig-07.jpg",
      ],
    },
    {
      title: "Live", tag: "Personal · Concerts", kind: "photo", year: "2025—2026", featuredPhoto: true,
      cover: "images/k2ttan/k2-06.jpg",
      summary: "Front rows, spotlights and fog — shows from the personal account.",
      details: [["More", "Instagram @k2ttan"]],
      images: [
        "images/k2ttan/k2-06.jpg", "images/k2ttan/k2-08.jpg", "images/k2ttan/k2-02.jpg", "images/k2ttan/k2-11.jpg",
        "images/k2ttan/k2-04.jpg", "images/k2ttan/k2-10.jpg", "images/k2ttan/k2-07.jpg", "images/k2ttan/k2-09.jpg",
        "images/photos/k-066.jpg", "images/photos/k-067.jpg", "images/photos/k-068.jpg",
      ],
    },
    {
      title: "Everyday", tag: "Personal · Film etc", kind: "photo", year: "2025—2026",
      cover: "images/k2ttan/k2-12.jpg",
      summary: "Clouds, lakes, old theatres and mail.",
      details: [["More", "Instagram @k2ttan"]],
      images: ["images/k2ttan/k2-12.jpg", "images/k2ttan/k2-03.jpg", "images/k2ttan/k2-05.jpg", "images/k2ttan/k2-01.jpg"],
    },
  ],

  // Hero photo wall, 6 per row (order matters — first tiles light up first).
  // ig-13 … ig-18 are empty slots: add those files to images/photos/ and they appear automatically.
  gallery: [
    "images/photos/k-013.jpg", "images/photos/k-021.jpg", "images/photos/k-046.jpg", "images/photos/k-088.jpg",
    "images/photos/k-031.jpg", "images/photos/k-121.jpg", "images/photos/ig-12.jpg", "images/photos/k-026.jpg",
    "images/photos/ig-06.jpg", "images/k2ttan/k2-02.jpg", "images/photos/k-027.jpg", "images/photos/k-068.jpg",
  ],

  // Personal strip on the Profile page.
  offClock: ["images/k2ttan/k2-06.jpg", "images/k2ttan/k2-12.jpg", "images/k2ttan/k2-08.jpg", "images/k2ttan/k2-03.jpg", "images/k2ttan/k2-02.jpg", "images/k2ttan/k2-05.jpg"],

  faq: [
    ["What do you do?", "Game design with a technical bent — content systems, live ops, FTUE, quests and events, and the tools that ship them. I'm currently Game Director at Ghost Fox Games."],
    ["Are you open to work or collaborations?", "Yes — design roles, contract work on Roblox and Unity projects, and photo collaborations. Email is the fastest way to reach me."],
    ["Do you still take photos?", "Always. Travel, street and portraits on @kitannn, and live music and everyday film on @k2ttan."],
    ["What tools do you use?", "Unity, Unreal, Roblox Studio + Luau, C#, C++, Python, Haxe, AMP, Jira and Perforce — and Lightroom for photos."],
  ],

  poem: [
    "Got a game that needs a designer's eye,",
    "or a night shoot under neon sky?",
    "Send a note, I'll write back soon —",
    "<strong>probably after one more playtest :)</strong>",
  ],

  networks: [
    ["Instagram", "https://instagram.com/kitannn"],
    ["Personal IG", "https://instagram.com/k2ttan"],
    ["LinkedIn", "https://www.linkedin.com/in/tanhenry/"],
    ["GitHub", "https://github.com/kitannn"],
  ],
};
