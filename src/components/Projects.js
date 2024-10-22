import React, { useState } from "react";

// Function to convert Google Drive link to embeddable format for videos and documents
const getGoogleDriveEmbedUrl = (url) => {
  const fileIdMatch = url.match(/[-\w]{25,}/);
  return fileIdMatch ? `https://drive.google.com/file/d/${fileIdMatch[0]}/preview` : url;
};

// Function to convert Google Drive link to embeddable image format
const getGoogleDriveImageEmbedUrl = (url) => {
  const fileIdMatch = url.match(/[-\w]{25,}/);
  return fileIdMatch ? `https://drive.google.com/uc?export=view&id=${fileIdMatch[0]}` : url;
};

const contestsAndActivities = [
  {
    title: "2nd Place at DSAG Ideathon",
    location: "DSAG Jahreskonferenz, Leipzig/Germany",
    date: "10/2024",
    shortDescription: `We built a RL-based intricate fraud detection solution and pitched in front of 6000+ SAP user company CEO/CIO/CFO and experts. We later discussed partnership opportunities with many of them.`,
    longDescription: `We designed a reinforcement-learning based, multi-transaction supporting fraud detection system and pitched it in front of 6000+ people from different SAP user companies. We made it to the final and secured 2nd Place through audience voting.`,
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
    title: "Best Business Opportunity Award Winner at Circular Hackfest",
    location: "Makerspace, Munich/Germany",
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
    title: "1st Place at Thüga Solutions Hackathon",
    location: "Thüga Solutions, Munich/Germany",
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
    title: "2nd Place at Solana Superteam Ideathon",
    location: "Tum Blockchain Conference, Munich/Germany",
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
    title: "1st Place on Swiss Exchange Track & Audience Award at SwissHacks2024",
    location: "SIX Swiss Exchange, Zurich/Switzerland",
    date: "06/2024",
    shortDescription: `Developed “BizzWizz”, an AI-driven sustainability reporting assistance platform. Also presented in front of VC & on PointZero forum (Role: Back-End Dev)`,
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
    title: "3rd Place at HackUPC Main Challenge (Sponsor: Intersystems)",
    location: "UPC, Barcelona/Spain",
    date: "05/2024",
    shortDescription: `Advanced Travel Planning w/ user-interest & city-description embeddings using Intersystems Vector Search (Role: Fullstack Dev., Presenter)`,
    longDescription: `The challenge given on the hackathon was called “Best use of GenAI using InterSystems IRIS Vector Search”. Our team built a travel assistant tool that makes use of embeddings of user interests and city descriptions in order to suggest alternative flight routes s.t. Users with similar interests might be recommended to take the same flight OR users might be recommended to take flights to cities that they are likely to find interesting.  (Note: We improvised our presentation, and the video I embedded below wasn't meant to have sound, so please ignore the sound :D)`,
    links: [
      { label: "Devpost page", url: "https://devpost.com/software/potatoes-patatas?ref_content=contribution-prompt&ref_feature=engagement&ref_medium=email&utm_campaign=contribution-prompt&utm_content=contribution_reminder&utm_medium=email&utm_source=transactional#app-team" },
      { label: "Credly badge", url: "https://www.credly.com/badges/67e2920d-a299-4ba9-819a-f32f730bf009" },
      { label: "Github repo", url: "https://github.com/batikanor/potatoes_patatas" },

    ],
    technologies: ["Python Flask", "ReactJS"],
    gdrive_embed: [
      "https://www.youtube.com/embed/cjVDi2AY8yc",
      "https://docs.google.com/presentation/d/1eCo7cuh-HS7SYnlTHYASAdwcHIfLiFE7/edit?usp=sharing&ouid=108923877595249603456&rtpof=true&sd=true",
    ],

  },
  {
    title: "2nd Place (team) & 1st Place (individual) at TUM AI Makeathon Main Challenge (Sponsor: Reply S.p.A.)",
    location: "Munich/Germany",
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
    title: "Proof of Concept: Detecting line-breaks in football matches",
    location: "Munich/Germany",
    date: "01/2024",
    shortDescription: `3D Visualization of football players as spheres during a live match, clustering them into lines and detecting line breaks, predictive analysis, providing an intuitive UI for configuration (Role: FullStack Developer).`,
    longDescription: `We focused on the line breaks during football matches. We worked on clustering the players in lines, determining when lines (offensive/defensive) have been broken, predicting when line breaks are expected to come, and considering how this information can be used to evaluate game performance. We built a 3D Visualisation app of football players as spheres during a live match, clustering them into lines and counting line breaks, providing an intuitive UI for configuration. We also used classical data mining methods such as XGBoost, Random Forest, Shapley etc to conduct further predictive analysis. We worked on a special confidential cluster to which we don’t have access anymore, and we cannot share some other details due to the confidentiality clause.`,
    links: [
      { label: "Slide deck (too large to directly embed)", url: "https://docs.google.com/presentation/d/1yYBJeLSaPj4yY4KfLBv8zaDL6jK6daeF/edit?usp=sharing&ouid=108923877595249603456&rtpof=true&sd=true" },

    ],
    technologies: ["Python Flask", "ReactJS", "ThreeJS"],
    gdrive_embed: [
      // "https://docs.google.com/presentation/d/1yYBJeLSaPj4yY4KfLBv8zaDL6jK6daeF/edit?usp=sharing&ouid=108923877595249603456&rtpof=true&sd=true",
    ],

  },
  {
    title: "2nd Place at Dräger hackathon",
    location: "Lübeck/Germany",
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
    title: "1st Place (Main Track) at the first Ethereum-focused hackathon in Munich.",
    location: "PretzelDAO & TUM, Munich/Germany",
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
    title: "1st Place at  MSG Code & Create Hackathon",
    location: "MSG, Karlsruhe/Germany",
    date: "06/2023",
    shortDescription: `Won a hackathon organized by Münchner Softwaregesellschaft (MSG).`,
    longDescription: `We programmed a CO-2 considering route planner called Navigo which takes into consideration self calculated metrics that we called ‘efficiency’ and ‘catastrophe score’. We aren’t hosting it live due to api costs.`,
    links: [
      { label: "1st Place Certificate", url: "https://www.batikanor.com/certificates/batikan/2023_msg_code_create_winner.pdf" },
      { label: "Event video", url: "https://www.instagram.com/reel/Cvz9pn0owzz/?igshid=MTc4MmM1YmI2Ng%3D%3D"},
    ],
    technologies: ["Python Flask", "ReactJS"],
    gdrive_embed: [
      "https://drive.google.com/file/d/1xrktqeqkMM-8CWpFcZVLXR-ccGVcJvHR/view?usp=sharing",
    ],

  },
  {
    title: "Bachelor’s Thesis",
    location: "Turkish-German University, Istanbul/Turkey",
    date: "2022",
    shortDescription: `Cat identification using noseprints.`,
    longDescription: `For the task of identification of pets and stray animals;  many methods, the ethicalness of which are questionable, are put to use. With this project, 16 different test cats (for each of which there were 4 to 20 examples) could be identified by the machine learning system using their nose images, face images or whole images with very high (99%, 100%, …) rank-1 to rank-5 accuracies without the model having been shown any example of their identity/class to the system in the training phase. Later on, the aim is to make the system more scalable and use it in end-user applications. For the project has an entrepreneurial side to it, the implementation will be kept confidential for at least a couple more years.`,
    technologies: ["Siamese Networks", "Pytorch"],
    gdrive_embed: [
      "https://drive.google.com/file/d/1vkXClWm80q1e-R4MItsKIthmG21vG_4R/view?usp=sharing",
    ],

  },
];

const ContestsAndActivities = () => {
  const [expandedActivity, setExpandedActivity] = useState(null);

  const toggleExpandedView = (activity) => {
    setExpandedActivity(activity === expandedActivity ? null : activity);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4  sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold tracking-tight text-center mb-12 text-white">
        Past Project Samples
      </h2>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        {contestsAndActivities.map((activity, index) => {
          const isExpanded = expandedActivity === activity;
          return (
            <div
              key={index}
              className={`${
                isExpanded ? "col-span-1 sm:col-span-2" : ""
              } transition-all duration-300`}
            >
              <div className={`p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-600`}>
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-semibold mb-2 text-white">
                    {activity.title}
                  </h3>
                  <button
                    onClick={() => toggleExpandedView(activity)}
                    className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600"
                  >
                    {isExpanded ? "Collapse" : "See more"}
                  </button>
                </div>
                <p className="text-gray-300">{activity.location}</p>
                <p className="text-gray-400 mb-4">{activity.date}</p>

                {/* Display Short Description */}
                <p className="text-gray-300 mb-4">
                  {activity.shortDescription}
                </p>

                {/* Display Long Description if Expanded */}
                {isExpanded && (
                  <p className="text-gray-300 mb-4">
                    {activity.longDescription}
                  </p>
                )}

                {/* Used Technologies */}
                {activity.technologies && (
                  <div className="mt-4 mb-4 flex flex-wrap">
                    {activity.technologies.map((tech, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-700 text-white px-2 py-1 rounded-full mr-2 mb-2"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                {/* Display Links */}
                {activity.links && (
                  <div className="mt-4">
                    {activity.links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline block"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}

                {/* Embed Google Drive Media if Available */}
                {isExpanded && activity.gdrive_embed && (
                  <div className="mt-6 space-y-4">
                    {activity.gdrive_embed.map((embedUrl, i) => (
                      <iframe
                        key={i}
                        src={getGoogleDriveEmbedUrl(embedUrl)}
                        width="100%"
                        height="315"
                        allow="autoplay"
                        className="rounded-lg"
                        frameBorder="0"
                        allowFullScreen
                        title={`${activity.title} Google Drive Embed ${i + 1}`}
                      ></iframe>
                    ))}
                  </div>
                )}

                {/* Display Images if Available */}
                {isExpanded && activity.images && (
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activity.images.map((image, i) => (
                      <img
                        key={i}
                        src={getGoogleDriveImageEmbedUrl(image)}
                        alt={`Image for ${activity.title}`}
                        className="w-full h-auto rounded-lg shadow-lg"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContestsAndActivities;
