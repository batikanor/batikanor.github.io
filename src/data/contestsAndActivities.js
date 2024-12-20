export const contestsAndActivities = [
  {
    "slug": "huawei-agorize-2024",
    "importance": 3,
    "title": "(Ongoing) Finalist at Huawei AI Individual Head-Related Transfer Functions (HRTFs) Competition",
    "mapData": {
      "venue": "Huawei Research Center",
      "city": "Munich",
      "country": "Germany",
      "coordinates":{ lat: 48.1351, lng: 11.5820 }
    },
    "date": "12/2024 - 01/2025",
    "shortDescription": "Details to come later.",
    "longDescription": "Details to come later.",
    "links": [
      // { "label": "Hackathon Link", "url": "https://lauzhack.com/" },
      // { "label": "GitHub Repository", "url": "https://github.com/batikanor/MX-Focus" }
      {"label": "Competition Link", "url": "https://huawei.agorize.com/en/challenges/techarena-munich2024"}
    ],
    "technologies": ["Machine Learning", "AI", "HRTFs"],
    "images": [
      // "https://example.com/image1.jpg",
      // "https://drive.google.com/uc?id=1aBcDeFgHiJkLmNoPqRSuvWxyz"
    ],
    "gdrive_embed": [
      // "https://drive.google.com/file/d/1vL77AmjuWV4hls8Mt75x_lOqaBaohr1D/preview"
    ]
  },
  {
    "slug": "masters-thesis",
    "importance": 7,
    "title": "Master's Thesis: (TEA) Trajectory Encoding Augmentation for Robust and Transferable Policies in Offline Reinforcement Learning",
    "mapData": {
      "venue": "Siemens AG",
      "city": "Munich",
      "country": "Germany",
      "coordinates":{ lat: 48.1351, lng: 11.5820 }
    },
    "date": "12/2024",
    "shortDescription": "(Grade: 1.0) (Submitted to a conference, currently under review)",
    "longDescription": "In this paper, we investigate offline reinforcement learning (RL) with the goal of training a single robust policy that generalizes effectively across environments with unseen dynamics. We propose a novel approach, Trajectory Encoding Augmentation (TEA), which extends the state space by integrating latent representations of environmental dynamics obtained from sequence encoders, such as AutoEncoders. Our findings show that incorporating these encodings with TEA improves the transferability of a single policy to novel environments with new dynamics, surpassing methods that rely solely on unmodified states. These results indicate that TEA captures critical, environment-specific characteristics, enabling RL agents to generalize effectively across dynamic conditions.",
    "links": [
      { "label": "arXiv", "url": "https://arxiv.org/abs/2411.19133" },
      // { "label": "GitHub Repository", "url": "https://github.com/batikanor/MX-Focus" }
    ],
    "technologies": ["Machine Learning", "AI", "HRTFs"],
    "images": [
      // "https://example.com/image1.jpg",
      // "https://drive.google.com/uc?id=1aBcDeFgHiJkLmNoPqRSuvWxyz"
    ],
    "gdrive_embed": [
      // "https://www.youtube.com/embed/HIuHFqtGaEs",
      // "https://drive.google.com/file/d/1vL77AmjuWV4hls8Mt75x_lOqaBaohr1D/preview"
    ]
  },
  {
    "slug": "lauzhack-2024",
    "importance": 3,
    "title": "Finalist at LauzHack 2024: VR Classroom for Focus Improvement",
    "mapData": {
      "venue": "EPFL",
      "city": "Lausanne",
      "country": "Switzerland",
      "coordinates": { "lat": 46.5191, "lng": 6.5668 }
    },
    "date": "11/2024",
    "shortDescription": "We developed 'MX Focus,' a VR classroom environment designed to help students enhance their concentration during exams. Utilizing a Logitech MX Ink VR pen and a Muse 2 EEG headband, the system detects stress or lack of focus, introducing noise to the student's handwriting in real-time. This innovative approach trains students to maintain focus and composure under exam conditions.",
    "longDescription": "Our project, 'MX Focus,' is a virtual reality application aimed at improving students' concentration during examinations. In this immersive VR classroom, students are equipped with a Logitech MX Ink VR pen and a Muse 2 EEG headband. The system monitors the student's focus levels; if a decline is detected, simulated handwriting degradation occurs, encouraging the student to maintain concentration. The VR environment replicates a real classroom, with virtual papers aligned to the physical desk. Teachers can input or modify questions in real-time via a Google Docs document, which updates instantly in the VR space. This setup allows for dynamic interaction between teachers and students, facilitating tasks such as math problem-solving. By introducing challenges like simulated handwriting issues when focus wanes, our application aims to train students to remain calm and attentive under exam conditions. We believe that regular use of 'MX Focus' can help students develop resilience and improve performance in high-pressure academic settings. We made it to the finals, and we were gifted MX Ink pens of around 200 usd value per piece for our efforts.",
    "links": [
      { "label": "Hackathon Link", "url": "https://lauzhack.com/" },
      { "label": "GitHub Repository", "url": "https://github.com/batikanor/MX-Focus" }
    ],
    "technologies": ["C#", "Unity", "EEG", "Logitech MX Pen", "VR", "AI", "Meta Quest 3"],
    "images": [
      // "https://example.com/image1.jpg",
      // "https://drive.google.com/uc?id=1aBcDeFgHiJkLmNoPqRSuvWxyz"
    ],
    "gdrive_embed": [
      "https://www.youtube.com/embed/HIuHFqtGaEs",
      // "https://drive.google.com/file/d/1vL77AmjuWV4hls8Mt75x_lOqaBaohr1D/preview"
    ]
  },
  
  {
    slug: "salzburg-tourism-2024",  // Unique slug for each project
    importance: 8, // If less than 5, pink text
    highlighted: true,
    title: "1st Place at the biggest Tourism Technology Festival in Europe",
    mapData: {
      venue: "Alles Für den GAST",
      city: "Salzburg",
      country: "Austria",
      coordinates: { lat: 47.8014, lng: 13.0448 }
    },
    date: "11/2024",
    shortDescription: `We built a touristic spot recommendation system that uses EEG data and machine learning, and won the Tourism Technology Festival in Salzburg, where we were rewarded 2500 Eur and also partially awarded a trip to japan where there'd be a Music & AI hackathon in a 1000 year old temple in Nara.`,
    technologies: ["AI", "EEG", "Tourism", "Biosensors", "Python", "ReactJS"],
    links: [
      { label: "Muse 2 Details", url: "https://www.researchgate.net/figure/a-MUSE-2-headband-sensors-overview-b-Top-down-view-of-the-EEG-electrode-positions-on_fig1_357537669"},
      { label: "Big 5 Personality Traits", url: "https://en.wikipedia.org/wiki/Big_Five_personality_traits"},
      { label: "Klados et al (2020). Automatic Recognition of Personality Profiles Using EEG Functional Connectivity during Emotional Processing. Brain Sciences, 10.", url: "https://www.semanticscholar.org/paper/Automatic-Recognition-of-Personality-Profiles-Using-Klados-Konstantinidi/82ab4e428452cd48b3b219d1d84c1f5c362d49dc"},
      ],
    longDescription: `
    The pipeline we implemented works as follows:
    
    0) Assume you are working for marketing of Austria to tourists, and you are currently in a conference in Dubai. You have some 'technical stuff' in your stand, with which you draw attention. 
    \n
    1) You use a Muse 2 headband (see link 1) to collect EEG data from your visitor. Whilst doing that, the visitor is viewing semi-abstract images related to potential hobbies.
    
    2) Our program is extracting simple features from the collected EEG data, such as how concentrated the visitor is in every brief moment, and how strong their emotions are. We are especially keeping track of these for the brief moments (1 sec) each image is shown. For example, the frontal alpha asymmetry is calculated as: log(right_alpha) - log(left_alpha)  
    
    3) With the help of data from step 2 and raw EEG data passed through neural networks, we extract the 'big 5 personality traits' (see link 2).  

    4) We feed the data from steps 2 and 3 into an LLM, and fetch the recommended travel spot through RAG from aforementioned travel hotspots in austria datasets. The LLM also provides an explanation regarding the decision.
    

    This was the first time our team worked with EEG data, and we only had 24 hours to complete everything. During the event we had conflicts within the team but we didn't let these stop us from winning. We got 1st place out of 25+ teams.

    We've taken inspiration from Klados et al (link 3).





    I wanted to share the code here, but we private'd the repository due to the wishes of some of our team members.
    `,
    gdrive_embed: [
      "https://drive.google.com/file/d/1_chrnl3jKyyBcyZjBpodhtyYO0jwaGHE/view?usp=sharing",
      "https://drive.google.com/file/d/1U4GgVCr_zNKcQcSS6prPBdPJGg0g3C6U/view?usp=sharing",
    ],
  },
    {
      slug: "zurich-climathon-2024",  // Unique slug for each project
      importance: 7, // If less than 5, pink text
      title: "Awarded 7000 CHF by the City of Zurich: AI-Based Employee Surveying Platform",
      mapData: {
        venue: "Kraftwerk",
        city: "Zurich",
        country: "Switzerland",
        coordinates: { lat: 47.3769, lng: 8.5417 }
      },
      date: "11/2024",
      shortDescription: `Awarded funding for co-designing an AI-based employee surveying platform to enable sustainability and climate-related discussions between employees and employers. Pilot project currently planned in Zurich.`,
      technologies: ["AI", "Employee Engagement", "Sustainability", "Climate"],
      links: [],
      longDescription: `At the 2024 Zurich Climathon, our team developed GreenDoor, an AI-driven employee engagement platform designed to bring transparency and accountability to corporate sustainability practices. GreenDoor operates as a “Glassdoor for Sustainability,” providing employees with an anonymous platform to rate and review their companies’ environmental and sustainability efforts. This tool empowers employees to highlight their company’s commitment—or lack thereof—to sustainable practices, encouraging companies to improve based on transparent feedback.

The platform supports sustainable decision-making and aligns with global Sustainable Development Goals (SDGs) by structuring survey questions around these objectives. To ensure relevance and accuracy, we aim to partner with sustainability certification bodies and industry ranking organizations to provide integrated insights. With a freemium model, GreenDoor offers free public data access while monetizing through premium features, such as predictive analytics for companies on meeting sustainability targets and advertisement placements for sustainability-focused job positions. Additionally, advanced AI-based bot detection and authentication methods guarantee data reliability and user anonymity.

Our roadmap includes launching the platform in Zurich, gathering initial data, and progressively expanding features and geographic reach as data volume and revenue grow. GreenDoor aims not only to inform potential employees but also to encourage proactive change, providing companies with critical insights into employee expectations around sustainability. By fostering a community-driven approach to sustainable corporate transparency, GreenDoor breaks down barriers between employees and employers, opening the door to a greener, more accountable future for businesses.`,
      gdrive_embed: [
        "https://drive.google.com/file/d/12jv9_k9AbwCAeG_mMYdgFvX7LkR-xNOC/view?usp=sharing",
        "https://drive.google.com/file/d/1phR3MaPwiy9zZi_yqyfafVVeJRBylhBL/view?usp=sharing",
        // "https://drive.google.com/file/d/1XBhq5-55hGyOsYrkRKRZV-V5P1qPKPc1/view?usp=sharing",
        "https://docs.google.com/presentation/d/13NjatYi07DAcC8oKYnAJxaIXW_GopTxigWBoWbUfwQo/edit#slide=id.p",
        "https://docs.google.com/document/d/1Zp4I7-1y4VoNY0kydPNKfeSKhuO_41lfdlDqhQF_39I/edit?usp=sharing",
      ],
    },
  
    {
      slug: "bayer-ai-2024",  // Unique slug for each project
      importance: 5, // If less than 5, pink text

      title: "2nd Place at Bayer AI Innovation Platform Hackathon",
      mapData: {
        venue: "Google Office",
        city: "Munich",
        country: "Germany",
        coordinates: { lat: 48.1351, lng: 11.5820 }
      },
      date: "10/2024",
      shortDescription: `We helped test the up-and-coming AI innovation platform built by Bayer based on Google Cloud Platform. We found valuable bugs and managed to solve a set of computer vision and bioinformatics related tasks.`,
      longDescription: `The event was organised at Google's office in Munich. We've met with engineers from Bayer who've built and tested their AI Innovation Platform, and had valuable discussions regarding the product and its capabilities. I don't think it'd be ethical for me to detail on the bugs we've found on the app here, but we've reported them to the team nicely, whilst also solving the great bioinformatics and computer vision related challenges they've planned for us. We won GCP credits and 12 months free access to the respective innovation platform. `,
      links: [
        { label: "Hackathon Link", url: "https://hackathon.radiology.bayer.com/"},
        // { label: "LinkedIn Winner Declaration", url: "https://www.linkedin.com/posts/dsag_dsagjk24-sap-digitaletransformation-activity-7251879625583116289-PA7Q?utm_source=share&utm_medium=member_android" },
      ],
      technologies: ["Python", "Google Cloud Platform", "Computer Vision", "Test & Quality Assurance"],
      // images: [
        // "https://example.com/image1.jpg",
        // "https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRSuvWxyz/view?usp=sharing", // Google Drive image
      // ],
      // gdrive_embed: [
      //   "https://docs.google.com/presentation/d/1FSCjiBlLvDn6dzIAjPaf_RC2LvJBzk5q/edit?usp=sharing&ouid=108923877595249603456&rtpof=true&sd=true", // Google Drive video
      //   "https://drive.google.com/file/d/1vL77AmjuWV4hls8Mt75x_lOqaBaohr1D/view?usp=sharing",
      // ],
    },
    {
      slug: "dsag-ideathon-2024",  // Unique slug for each project
      importance: 5, // If less than 5, pink text

      highlighted: true,
      title: "2nd Place at DSAG Ideathon",
      mapData: {
        venue: "DSAG Jahreskonferenz",
        city: "Leipzig",
        country: "Germany",
        coordinates: { lat: 51.3397, lng: 12.3731 }
      },
      date: "10/2024",
      shortDescription: `We built a RL-based intricate fraud detection solution and pitched in front of 6000+ SAP user company CEO/CIO/CFO and experts. We later discussed partnership opportunities with many of them.`,
      longDescription: `We designed a reinforcement-learning based, multi-transaction supporting fraud detection system and pitched it in front of 6000+ people, where we had an audience consisting of representatives from countless SAP user / partner companies in the DSAG Jahreskonferenz (German Speaking SAP Users Yearly Conference). We made it to the final, and in the final the top 3 were selected through a decibel-metre measuring the claps of the audience. We got 2nd Place and won Airpods Max’s for each of us. We called our system HippoSAP, where we used Hierarchical Proximal Policy Optimization to tell if a transaction in an SAP system is fraud or not based on time-series-graph data provided as context.`,
      links: [
        { label: "LinkedIn Winner Declaration", url: "https://www.linkedin.com/posts/dsag_dsagjk24-sap-digitaletransformation-activity-7251879625583116289-PA7Q?utm_source=share&utm_medium=member_android" },
      ],
      technologies: ["Python", "Reinforcement Learning", "SAP Integration", "HIPPO"],
      // images: [
        // "https://example.com/image1.jpg",
        // "https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRSuvWxyz/view?usp=sharing", // Google Drive image
      // ],
      gdrive_embed: [
        "https://docs.google.com/presentation/d/1FSCjiBlLvDn6dzIAjPaf_RC2LvJBzk5q/edit?usp=sharing&ouid=108923877595249603456&rtpof=true&sd=true", // Google Drive video
        "https://drive.google.com/file/d/1vL77AmjuWV4hls8Mt75x_lOqaBaohr1D/view?usp=sharing",
      ],
    },
    {
      slug: "circular-bsh-2024",  // Unique slug for each project
      importance: 4, // If less than 5, pink text

      title: "Best Business Opportunity Award Winner at Circular Hackfest",
      mapData: {
        venue: "Makerspace",
        city: "Munich",
        country: "Germany",
        coordinates: { lat: 48.1351, lng: 11.5820 }
      },
      date: "10/2024",
      shortDescription: `We built a complete prototype for circular value creation out of old home appliances using AI/RL.`,
      longDescription: `We created a holistic solution for improving the e-waste management process in B/S/H and other businesses. Our solution included: Scanning containers full of old home appliances using X-Ray, automatically unloading the containers, identifying appliances using sensors and computer vision, and making decisions in order to create best-possible value out of respective old appliances using reinforcement learning. We created two functional physical prototypes and displayed them to the audience. We devised a realistic roadmap and business plan that convinced the jury. See the slide deck for more details.`,
      technologies: ["Python", "Reinforcement Learning", "YoLo"],
      gdrive_embed: [
        "https://docs.google.com/presentation/d/1347zgwVf8qzQxtcdbyJGKT3fXpcduz0BDLUoEVQXw4I/edit#slide=id.g2d42802e251_0_139",
        "https://drive.google.com/file/d/16NxZ9npePverTrbb4Rjhe1JPD05ctZvY/view?usp=sharing",
        "https://drive.google.com/file/d/1TFr1kNcWFcCKKt3jBzamDmvOqQuI-b5I/view?usp=drive_link",
        "https://drive.google.com/file/d/1Z7WmvqB6oa1zPSIBh_oCnWJgEkYNXj4r/view?usp=sharing",
      ],
    },
    {
      slug: "thuega-2024",  // Unique slug for each project
      importance: 6, // If less than 5, pink text
      title: "1st Place at Thüga Solutions Hackathon",
      mapData: {
        venue: "Thüga Solutions",
        city: "Munich",
        country: "Germany",
        coordinates: { lat: 48.1351, lng: 11.5820 }
      },
      date: "09/2024",
      shortDescription: `Cost minimization for tenants and landlords through energy management using AI (multivariate forecasters, neural networks, …), and Mathematical Optimization (interior-point methods)  (Role: FullStack, Cloud, RL).`,
      longDescription: `The challenge was to minimise costs for single & multiple family households through self-devised energy management methods, and provide the tenants and landlord(s) with utility functions. We were provided real and/or realistic data to work with from industry experts. We won first place with our solution called “Bright Grid”. To summarise, we formulated 2 mathematical optimization problems and used multiple forecasting-related AI solutions to tackle the challenge. My role in the team was full stack development, cloud deployment, and universal forecasting experimentation. Our main mathematical optimization was minimising the energy cost through distributing the load across battery, PV, and grid using forecasted data and under reasonable constraints. Our secondary optimization was to help the landlord increase their profits when selling electricity to the tenants. We mainly used interior-point methods for optimization, for we found them to be sufficient for PoC. We considered a later switch to ADMM. Our forecasts were made through both real and mocked data, using Moirai (universal multivariate time series forecasting), conventional neural networks, etc. We deployed on azure in two separate containers (BE, FE).`,
      links: [
        { label: "LinkedIn Announcement for winners", url: "https://www.linkedin.com/posts/th%C3%BCga-solutions_hackathon24-finale-pitchday-activity-7244685573968269314-8__V?utm_source=share&utm_medium=member_desktop" },
        { label: "Proof of participation", url: "https://drive.google.com/file/d/1bm9B9hPMF5Tz_x3K0ByLjBak_FzERAgC/view?usp=sharing" },
  
      ],
      technologies: ["ReactJS", "Python Flask", "IoT", "Energy Optimization", "AWS"],
      gdrive_embed: [
        "https://docs.google.com/presentation/d/11HvG41xdg7wGdrsyRskOe90hIqc2Fany/edit?usp=sharing&ouid=108923877595249603456&rtpof=true&sd=true", // Google Drive video
        "https://www.youtube.com/embed/ccDWxExAJ_o",
        "https://www.youtube.com/embed/58lh7E9Msuw",
      ],
  
    },
    {
      slug: "solana-ideathon-2024",  // Unique slug for each project
      importance: 4, // If less than 5, pink text
      title: "2nd Place at Solana Superteam Ideathon",
      mapData: {
        venue: "TUM Blockchain Conference",
        city: "Munich",
        country: "Germany",
        coordinates: { lat: 48.1351, lng: 11.5820 }
      },
      date: "09/2024",
      shortDescription: `Designed a solana microbetting solution.`,
      longDescription: `We prepared a microbetting solution that works on Solana. The system would also accept natural text bets, and enable “pinky-betting” style bets where “the house always wins” principle can be challenged. Liquidity pools can also be created through whale-funded AIs that are searching for newly opened bets that fulfil certain conditions. Closing of bets could be orchestrated through decentralised Oracles. We were voted 2nd through community voting. We won ourselves CUDIS AI rings and solana mousepads.`,
      links: [
        { label: "LinkedIn Announcement for winners", url: "https://www.linkedin.com/posts/th%C3%BCga-solutions_hackathon24-finale-pitchday-activity-7244685573968269314-8__V?utm_source=share&utm_medium=member_desktop" },
        { label: "Proof of participation", url: "https://drive.google.com/file/d/1bm9B9hPMF5Tz_x3K0ByLjBak_FzERAgC/view?usp=sharing" },
  
      ],
      technologies: ["Solana"],
      gdrive_embed: [
        "https://docs.google.com/presentation/d/1XrH3zm4eHonEyMC3OfbAyHICnfGUiwrm2BXZWveHXvU/edit?usp=sharing", 
      ],
  
    },
    {
      slug: "six-swisshacks-2024",  // Unique slug for each project
      importance: 8, // If less than 5, pink text
      highlighted: true,
      title: "1st Place on Swiss Exchange Track & Audience Award at SwissHacks2024",
      mapData: {
        venue: "SIX Swiss Exchange",
        city: "Zurich",
        country: "Switzerland",
        coordinates: { lat: 47.3769, lng: 8.5417 }
      },
      date: "06/2024",
      shortDescription: `Developed “BizzWizz”, an AI-driven sustainability reporting assistance platform. Also presented in front of VC & on PointZero forum. Talks ongoing with Swiss Exchange business developers regarding turning this idea into a company.`,
      longDescription: `At SwissHacks2024 (flagship event by Swiss Financial Innovation Desk (FIND), backed by the Swiss government), our team won 1st place for the ‘SIX’ track and the Audience Award for developing BizzWizz, an AI-driven platform designed to revolutionise sustainability reporting. The platform allows companies to navigate the complexities of sustainability compliance by offering AI-driven framework assessments, KPI calculations, market tools, and peer analytics. My role as the Back-End Developer included constructing the scalable infrastructure to handle vast amounts of data and implementing the AI models for KPI suggestions and peer benchmark analytics. We used a stack comprising React for the web app and Flask for the backend, integrated with llm(s), leveraging emerging technologies like ChromaDB for Retrieval-Augmented Generation (RAG). The innovative framework assessment and KPI calculation features were particularly praised, leading to our double victory in the competition. They also invited us for a free tour of the Swiss parliament.`,
      links: [
        { label: "LinkedIn Announcement for winners", url: "https://www.linkedin.com/posts/tomakoliada_hackathon-winners-innovation-activity-7213532268726816768-2URo/" },
      ],
      technologies: ["Python Flask", "ReactJS"],
      gdrive_embed: [
        "https://drive.google.com/file/d/1jh99Y2fF8UDNwlvrsVV0FJulm9o8W9_C/view?usp=sharing",
        "https://docs.google.com/presentation/d/1T3AmHdyHZ3zETXZK4PgeMD8TVZD0r38f/edit?usp=sharing&ouid=108923877595249603456&rtpof=true&sd=true" 
      ],
  
    },
    {
      slug: "hackupc-2024",  // Unique slug for each project
      importance: 5, // If less than 5, pink text

      title: "3rd Place at HackUPC (Sponsor: Intersystems)",
      mapData: {
        venue: "UPC",
        city: "Barcelona",
        country: "Spain",
        coordinates: { lat: 41.3851, lng: 2.1734 }
      },
      date: "05/2024",
      shortDescription: `Advanced Travel Planning w/ user-interest & city-description embeddings using Intersystems Vector Search (Role: Fullstack Dev., Presenter). We got 3rd place out of 30+ teams.`,
      longDescription: `The challenge given on the hackathon was called “Best use of GenAI using InterSystems IRIS Vector Search”. Our team built a travel assistant tool that makes use of embeddings of user interests and city descriptions in order to suggest alternative flight routes s.t. Users with similar interests might be recommended to take the same flight OR users might be recommended to take flights to cities that they are likely to find interesting.  (Note: We improvised our presentation, and the video I embedded below wasn't meant to have sound, so please ignore the sound :D)`,
      links: [
        { label: "Devpost page", url: "https://devpost.com/software/potatoes-patatas?ref_content=contribution-prompt&ref_feature=engagement&ref_medium=email&utm_campaign=contribution-prompt&utm_content=contribution_reminder&utm_medium=email&utm_source=transactional#app-team" },
        { label: "Credly badge", url: "https://www.credly.com/badges/67e2920d-a299-4ba9-819a-f32f730bf009" },
        { label: "Github repo", url: "https://github.com/batikanor/potatoes_patatas" },
  
      ],
      technologies: ["Python Flask", "ReactJS"],
      gdrive_embed: [
        "https://drive.google.com/file/d/1sJlVjqHJDO9zx6p30pDoUyVUXdAlnNFV/view?usp=sharing",
        "https://www.youtube.com/embed/cjVDi2AY8yc",
        "https://docs.google.com/presentation/d/1eCo7cuh-HS7SYnlTHYASAdwcHIfLiFE7/edit?usp=sharing&ouid=108923877595249603456&rtpof=true&sd=true",
      ],
  
    },
    {
      slug: "makeathon-reply-2024",  // Unique slug for each project
      importance: 5, // If less than 5, pink text

      title: "2nd Place (team) & 1st Place (individual) at TUM AI Makeathon Main Challenge (Sponsor: Reply S.p.A.)",
      mapData: {
        venue: "TUM AI Makeathon",
        city: "Munich",
        country: "Germany",
        coordinates: { lat: 48.1351, lng: 11.5820 }
      },
      date: "04/2024",
      shortDescription: `Wind Turbine Preventive Maintenance Through Reinforcement Learning  (Role: RL Developer, Presenter)`,
      longDescription: `The challenge given on the hackathon was called “Predictive Maintenance on Wind Turbine Data”.
  We started with cleaning and preprocessing the dataset provided by Reply S.p.A, available at govdata.de. We realised that it didn’t have any potential for turbine fault / maintenance prediction, and just like many other teams, we looked at alternative approaches.
  We first used standard q-learning on a very basic setting of a wind turbine maintenance problem, where we had 2 states (working, broken) and 2 actions (maintain, leave it be). I created a fullstack app (flask+react) to better visualise this during the pitch. Our first system showed an agent learning the ideal maintenance schedule for making sure turbines are productive and profitable. We then created a more sophisticated setting where the state had more detailed information such as rotor speed and orientation, observation space had wind speed and direction, power output, noise output, and current energy demand; and action space involved rotor orientation (cont.), alongside maintenance/start/stop actions. We implemented the second setting in an interactive environment and didn’t have the time to build a full-stack app to better display it. Also, most of the data we used were just stochastic (yet interdependent and somewhat realistic). For our second setting we used Proximal Policy Optimization (PPO) through stable_baselines_3, for we didn’t have enough time to consider other options (our team had a total working time of 24 hrs and it was just me and another teammate who worked on RL aspects). Despite that, we could successfully present positive outcomes.
  We also did web-scraping with Selenium to get more data regarding each turbine given in the original dataset, and argued that the data from there could be integrated into the complete system later on.
  We got second place as a team in the main track, and I personally got 1st place in the individual sidetrack of the same company, where the task was mainly pre-processing. They thought I deserved the reward due to the nice visualisations I provided and the novel way of decreasing ‘unique value’ count of some features through creating embedding similarity matrices and providing most-similar pairs to LLM’s to eventually retrieve pre-processing code for these columns.
  As a team, we think our solution was the best amongst all submissions, but we prepared the pitch very late and even though it was said that our pitch was great, we couldn’t focus a lot on the business aspects of the project, which we will pay more attention to in our future projects.
  We got invited to the company’s Munich office to further discuss our findings.
  `,
      links: [
        { label: "Github repo", url: "https://github.com/batikanor/predictive-maintenaince-wind-power" },
        { label: "Proof of participation", url: "https://drive.google.com/file/d/1mm8m518Vt0QAB05JSVW61tzl9Pwt9bb0/view?usp=sharing" },
  
      ],
      technologies: ["Python Flask", "ReactJS"],
      gdrive_embed: [
        "https://docs.google.com/presentation/d/1S3xRlTyYaJTQ3EfpPzmKcZr36jvNNIkaytn5SEXGUqo/edit#slide=id.p",
      ],
  
    },
    {
      slug: "mdsi-bundesliga-2024",  // Unique slug for each project
      importance: 4, // If less than 5, pink text

      title: "Proof of Concept: Detecting line-breaks in football matches",
      mapData: {
        venue: "TUM MDSI",
        city: "Munich",
        country: "Germany",
        coordinates: { lat: 48.1351, lng: 11.5820 }
      },
      date: "01/2024",
      shortDescription: `3D Visualization of football players as spheres during a live match, clustering them into lines and detecting line breaks, predictive analysis, providing an intuitive UI for configuration (Role: FullStack Developer).`,
      longDescription: `We focused on the line breaks during football matches. We worked on clustering the players in lines, determining when lines (offensive/defensive) have been broken, predicting when line breaks are expected to come, and considering how this information can be used to evaluate game performance. We built a 3D Visualisation app of football players as spheres during a live match, clustering them into lines and counting line breaks, providing an intuitive UI for configuration. We also used classical data mining methods such as XGBoost, Random Forest, Shapley etc to conduct further predictive analysis. We worked on a special confidential cluster to which we don’t have access anymore, and we cannot share some other details due to the confidentiality clause.`,
      links: [
      ],
      technologies: ["Python Flask", "ReactJS", "ThreeJS"],
      gdrive_embed: [
        "https://docs.google.com/presentation/d/1TjLC77f7rv1GVfNdqpKKlxQOdSntDlcw/edit?usp=sharing&ouid=108923877595249603456&rtpof=true&sd=true",
        "https://drive.google.com/file/d/1IPYrb_iPpduONEgdEusn32_OH1wx-8ze/view?usp=sharing",
        
      ],
  
    },
    {
      slug: "draeger-2023",  // Unique slug for each project
      importance: 5, // If less than 5, pink text

      title: "2nd Place at Dräger hackathon",
      mapData: {
        venue: "Dräger",
        // city: "Lübeck",
        city: "Lübeck",
        country: "Germany",
        coordinates: { lat: 53.8655, lng: 10.6866 }
      },
      date: "10/2023",
      shortDescription: `Predicting heart attacks through sensor readings (Role: AI Engineer).`,
      longDescription: `Dräger produces technologies for medicine and security. Using the VitalDB dataset where there is a great count of sensor readings of thousands of patients available online, we modelled and trained an AI model that can predict whether there’ll be a ‘shock’ in the coming 30 seconds / 2.5 minutes / 5 minutes. We reached test accuracies ranging from 70% to 90% using the methods we developed, and demonstrated them live using the aforementioned monitor. We had a doctor in the team who guided us towards measuring shock index (SI) as HRT / ART_SBP. For predictions we experimented with different models, but within the limited time and without access to GPUs, we could only prepare our LSTM model in time (even on that model we had made simple training mistakes, which we could only -to some extent- fix in the last minutes of the event), with which we reached the aforementioned accuracies. We also had working code to extract frequency information from some sensor readings using Mexican hat wavelet transformations, but even though we made use of as much multithreading as we could think, we couldn’t transform all the necessary data within the given time. We also had trouble finding pretrained autoencoders/embedders with which we could embed the data in order to put it into more explainable models. My role in the team was mainly participating in AI brainstorming sessions and trying to implement respective transformations and hopefully run explainable models. The jury and other Dräger employers especially praised our team for demonstrating ‘order in chaos’ and shared expertise on the domain. The source code is confidential and thus cannot be shared here.`,
      links: [
        { label: "Sample dräger monitor", url: "https://i.imgur.com/YhTbGY8.jpg" },
        { label: "VitalDB dataset", url: "https://vitaldb.net/dataset/?query=overview"},
        { label: "Sample prediction graph", url: "https://i.imgur.com/LPN3kpk.png"},
  
  
      ],
      technologies: ["LSTMs", "XGBoost"],
      gdrive_embed: [
        "https://drive.google.com/file/d/14iqBE66SjUpp2y6eFLHI8hOeCDtHZ8sh/view?usp=sharing",
      ],
  
    },
    {
      slug: "ethmunich-2023",  // Unique slug for each project
      importance: 8, // If less than 5, pink text

      highlighted: true,
      title: "1st Place (Main Track) at the first Ethereum-focused hackathon in Munich.",
      mapData: {
        venue: "PretzelDAO & TUM",
        city: "Munich",
        country: "Germany",
        coordinates: { lat: 48.1351, lng: 11.5820 }
      },
      date: "08/2023",
      shortDescription: `Built an NFT similarity judging tool (Role: Team Lead).`,
      longDescription: `We programmed an NFT similarity detective assistant which took not only the rarities of certain attributes to consideration but also the embeddings of the description (via Bert)  and contents (via ResNet) of the images. We used various machine learning methods to present the user with a multitude of options and won the AI main track of the hackathon. We also won the Gateway.fm bounty award.`,
      links: [
        { label: "Github repository", url: "https://github.com/batikanor/ethmunich-gate" },
        { label: "Devfolio page", url: "https://devfolio.co/projects/nft-similarity-detective-d8ef"},
        { label: "POAP", url: "https://app.poap.xyz/token/6759252"},
        { label: "NFT Proof for victory", url: "https://opensea.io/assets/arbitrum/0x020c3A900fdBd33795d709e2b40a1f3510fBe1Fc/18"}
  
  
      ],
      technologies: ["Gateway FM RPC", "Python"],
      gdrive_embed: [
        "https://drive.google.com/file/d/1-3hcEi9acIWug8ZNo0yoYe5UMrjzdTOE/view?usp=sharing",
      ],
  
    },
    {
      slug: "msg-karlsruhe-2023",  // Unique slug for each project
      importance: 6, // If less than 5, pink text

      title: "1st Place at  MSG Code & Create Hackathon",
      mapData: {
        venue: "MSG",
        city: "Karlsruhe",
        country: "Germany",
        coordinates: { lat: 49.0069, lng: 8.4037 }
      },
      date: "06/2023",
      shortDescription: `Built a CO-2-considerate route planner which won a hackathon organized by Münchner Softwaregesellschaft (MSG).`,
      longDescription: `We programmed a CO-2 considering route planner called Navigo which takes into consideration self calculated metrics that we called ‘efficiency’ and ‘catastrophe score’. We aren’t hosting it live due to api costs.`,
      links: [
        { label: "GitHub repository", url: "https://github.com/batikanor/navigo"},
        { label: "1st Place certificate", url: "https://www.batikanor.com/certificates/batikan/2023_msg_code_create_winner.pdf" },
        { label: "Event video", url: "https://www.instagram.com/reel/Cvz9pn0owzz/?igshid=MTc4MmM1YmI2Ng%3D%3D"},
      ],
      technologies: ["Python Flask", "ReactJS"],
      gdrive_embed: [
        "https://drive.google.com/file/d/1JrOiAxGTxlG9GfMk4jL9CslwcYOHvcwr/view?usp=sharing",
        "https://drive.google.com/file/d/1xrktqeqkMM-8CWpFcZVLXR-ccGVcJvHR/view?usp=sharing",
      ],
  
    },
    {
      slug: "bachelors-thesis",  // Unique slug for each project
      importance: 6, // If less than 5, pink text

      title: "Bachelor’s Thesis: Cat identification using Noseprints.",
      mapData: {
        venue: "Turkish-German University",
        city: "Istanbul",
        country: "Turkey",
        coordinates: { lat: 41.0082, lng: 28.9784 }
      },
      date: "2022",
      shortDescription: `Cat identification using noseprints and siamese networks.`,
      longDescription: `For the task of identification of pets and stray animals;  many methods, the ethicalness of which are questionable, are put to use. With this project, 16 different test cats (for each of which there were 4 to 20 examples) could be identified by the machine learning system using their nose images, face images or whole images with very high (99%, 100%, …) rank-1 to rank-5 accuracies without the model having been shown any example of their identity/class to the system in the training phase. Later on, the aim is to make the system more scalable and use it in end-user applications. For the project has an entrepreneurial side to it, the implementation will be kept confidential for at least a couple more years.`,
      technologies: ["Siamese Networks", "Pytorch"],
      gdrive_embed: [
        "https://drive.google.com/file/d/1vkXClWm80q1e-R4MItsKIthmG21vG_4R/view?usp=sharing",
      ],
  
    },
  ];

  export const getCitiesAndLocations = () => {
    const mapData = contestsAndActivities
      .filter((activity) => activity.mapData) // Ensure mapData exists
      .map((activity) => ({
        ...activity.mapData, // spread operator: ... is used to get all attributes from mapData to here 
        shortDescription: activity.shortDescription,
        title: activity.title,
        date: activity.date,
        slug: activity.slug,
        importance: activity.importance
      }));
  
    // Group activities by city and country
    const cityGroups = mapData.reduce((acc, activity) => { 
      const key = `${activity.city}-${activity.country}`;
      
      if (!acc[key]) {
        acc[key] = {
          city: activity.city,
          country: activity.country,
          coordinates: activity.coordinates,
          activities: [],
          maxImportance: activity.importance,
        };
      }
      acc[key].activities.push({
        venue: activity.venue,
        date: activity.date,
        title: activity.title,
        slug: activity.slug, 
      });
      if (activity.importance > acc[key].maxImportance) {
        acc[key].maxImportance = activity.importance;
      }
      return acc;
    }, {});
  
    return Object.values(cityGroups);
  };
  