"use client";

import {
  useCurrentAccount,
  useSignTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiArrowDown,
  FiArrowLeft,
  FiArrowRight,
  FiArrowUp,
} from "react-icons/fi";
import {
  Group,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
} from "three";

// 3D graph library & text sprites
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

const SuiMap = dynamic(() => import("../../components/SuiMap"), { ssr: false });

const Globe = dynamic(() => import("../../components/GlobeWrapper"), {
  ssr: false,
});

const NFT_PACKAGE_ID =
  "0x8fcba05c0a64ca8f36ff0f8cc65d93bb6327bbba2b6280ed232acd468eaa2576";

// Convert lat/lon to 3D Cartesian (radius ~100)
function latLngToCartesian(lat, lon, radius = 110) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

// fallback chart size
const GRAPH_HEIGHT = "70vh";

// Add content component
const SuiPageContent = dynamic(
  () => import("../../components/SuiPageContent"),
  {
    ssr: false,
  }
);

// --- Helper functions ------------------------------------------------------

async function getLocalAI(source, relation, model) {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that suggests a single word related to the source via the given relation. Respond only with the word.",
          },
          { role: "user", content: `Source: ${source}, Relation: ${relation}` },
        ],
        stream: false,
      }),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data.message.content.trim();
  } catch (error) {
    console.error("Local AI error:", error);
    // Fallback to avoid crashing the app
    return `${relation}-${source}`;
  }
}

async function getOpenRouterAI(source, relation, model) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, relation, model }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.target;
}

async function resolveRelation(
  source,
  relation,
  mode,
  localModel,
  openRouterModel
) {
  try {
    if (mode === "local") {
      return await getLocalAI(source, relation, localModel);
    } else {
      return await getOpenRouterAI(source, relation, openRouterModel);
    }
  } catch (error) {
    console.error("AI error:", error);
    return `${relation}-${source}`; // fallback
  }
}

const vibrantColors = [
  "#FF5733",
  "#33FF57",
  "#3357FF",
  "#FF33A1",
  "#A133FF",
  "#33FFA1",
  "#FFC300",
  "#DAF7A6",
  "#C70039",
  "#900C3F",
];

const localModels = [
  "gemma3:27b",
  "gemma3:12b-it-qat",
  "eramax/gemma-3-27b-it-qat:q4_0",
  "mistral-small:24b",
  "llava:13b",
  "deepseek-r1:14b",
  "nomic-embed-text:latest",
  "qwq:32b",
  "phi4:14b",
  "qwen2.5:0.5b",
];

const openRouterModels = [
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1-0528:free",
  "deepseek/deepseek-chat:free",
  "openrouter/cypher-alpha:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-nemo:free",
  "microsoft/mai-ds-r1:free",
  "meta-llama/llama-4-maverick:free",
];

const relationToColor = (relation) => {
  let hash = 0;
  for (let i = 0; i < (relation || "").length; i++) {
    hash = relation.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % vibrantColors.length;
  return vibrantColors[index];
};

const stringToLightColor = (str, theme) => {
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  if (theme === "light") {
    return `hsl(${hue}, 70%, 20%)`;
  } else {
    return `hsl(${hue}, 80%, 85%)`;
  }
};

export default function SuiGraphPage() {
  const { resolvedTheme } = useTheme();
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const [aiMode, setAiMode] = useState("local");
  const [localAiModel, setLocalAiModel] = useState(localModels[0]);
  const [openRouterModel, setOpenRouterModel] = useState(openRouterModels[0]);
  const [SpriteText, setSpriteText] = useState(null);
  const [mintedNames, setMintedNames] = useState(new Set());
  const [pendingMint, setPendingMint] = useState(null);
  const [nftDesc, setNftDesc] = useState("");
  const [autoNftDesc, setAutoNftDesc] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [nftUrl, setNftUrl] = useState("https://picsum.photos/400");
  // ------------------------ State -----------------------------------------
  const [graphData, setGraphData] = useState(() => {
    const initialNodes = [
      { id: "cat", ...latLngToCartesian(0, 0), fx: null, fy: null, fz: null },
      {
        id: "ethereum",
        ...latLngToCartesian(20, -30),
        fx: null,
        fy: null,
        fz: null,
      },
      {
        id: "poland",
        ...latLngToCartesian(52, 19),
        fx: null,
        fy: null,
        fz: null,
      },
    ];
    initialNodes.forEach((n) => {
      n.fx = n.x;
      n.fy = n.y;
      n.fz = n.z;
    });
    return { nodes: initialNodes, links: [] };
  });
  const [selected, setSelected] = useState(null); // node id string
  const inputRef = useRef(null);
  const fgRef = useRef();
  const globeRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const [horizSpeed, setHorizSpeed] = useState(0);
  const [vertSpeed, setVertSpeed] = useState(0);
  const [mintedNftMap, setMintedNftMap] = useState({});
  const [mintInfo, setMintInfo] = useState({});
  const [fullscreenView, setFullscreenView] = useState("3d");
  const [mapState, setMapState] = useState({
    zoom: 6,
    center: { lat: 52, lng: 19 },
  });
  const [isAddingRelation, setIsAddingRelation] = useState(false);

  const handleGenerateMockData = () => {
    const wordList = [
      "athena",
      "zeus",
      "apollo",
      "artemis",
      "poseidon",
      "hermes",
      "aphrodite",
      "ares",
      "hades",
      "demeter",
      "blockchain",
      "crypto",
      "decentralized",
      "ledger",
      "smart-contract",
      "token",
      "wallet",
      "node",
      "hash",
      "mining",
      "forest",
      "river",
      "mountain",
      "ocean",
      "desert",
      "canyon",
      "valley",
      "glacier",
      "island",
      "volcano",
      "galaxy",
      "nebula",
      "supernova",
      "quasar",
      "pulsar",
      "cosmos",
      "orbit",
      "gravity",
      "singularity",
      "planet",
      "symphony",
      "sonata",
      "concerto",
      "opera",
      "fugue",
      "rhapsody",
      "nocturne",
      "prelude",
      "serenade",
      "melody",
      "impressionism",
      "cubism",
      "surrealism",
      "baroque",
      "renaissance",
      "expressionism",
      "realism",
      "abstract",
      "gothic",
      "rococo",
      "algorithm",
      "database",
      "frontend",
      "backend",
      "cloud",
      "serverless",
      "microservice",
      "api",
      "devops",
      "agile",
      "philosophy",
      "metaphysics",
      "epistemology",
      "ethics",
      "logic",
      "aesthetics",
      "ontology",
      "phenomenology",
      "existentialism",
      "stoicism",
      "quantum",
      "relativity",
      "thermodynamics",
      "electromagnetism",
      "kinematics",
      "optics",
      "acoustics",
      "plasma",
      "particle",
      "string-theory",
      "neuron",
      "synapse",
      "cortex",
      "cerebellum",
      "amygdala",
      "hippocampus",
      "axon",
      "dendrite",
      "glia",
      "neurotransmitter",
    ];

    const numNodes = 300;
    const numClusters = 7;
    const nodesPerCluster = Math.floor(numNodes / numClusters);

    let newNodes = [];
    let newLinks = [];
    const existingNodeIds = new Set(graphData.nodes.map((n) => n.id));

    for (let i = 0; i < numClusters; i++) {
      const clusterNodes = [];
      for (let j = 0; j < nodesPerCluster; j++) {
        const wordIndex = (i * nodesPerCluster + j) % wordList.length;
        let nodeId = wordList[wordIndex];
        if (existingNodeIds.has(nodeId)) {
          nodeId = `${nodeId}_${i}_${j}`;
        }
        if (!existingNodeIds.has(nodeId)) {
          newNodes.push({ id: nodeId });
          clusterNodes.push(nodeId);
          existingNodeIds.add(nodeId);
        }
      }

      // Connect nodes within the cluster
      for (let k = 0; k < clusterNodes.length; k++) {
        const source = clusterNodes[k];
        const numConnections = Math.floor(Math.random() * 3) + 1;
        for (let l = 0; l < numConnections; l++) {
          const target =
            clusterNodes[Math.floor(Math.random() * clusterNodes.length)];
          if (source !== target) {
            newLinks.push({ source, target, label: "related_to" });
          }
        }
      }
    }

    setGraphData((prev) => ({
      nodes: [...prev.nodes, ...newNodes],
      links: [...prev.links, ...newLinks],
    }));
  };

  const fetchAllNfts = useCallback(async () => {
    console.log("Fetching all mint transactions via RPC...");
    const shinamiKey = process.env.SHINAMI_RPC_KEY;
    const rpcUrl = shinamiKey
      ? `https://api.shinami.com:443/fullnode_v1/${shinamiKey}`
      : "https://fullnode.devnet.sui.io:443";
    console.log("Using RPC URL:", rpcUrl);

    const allCreated = [];
    let cursor = null;
    try {
      do {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "suix_queryTransactionBlocks",
            params: [
              {
                filter: {
                  MoveFunction: {
                    package: NFT_PACKAGE_ID,
                    module: "my_nft",
                    function: "mint",
                  },
                },
                options: { showEffects: true },
              },
              cursor,
              50,
              false,
            ],
          }),
        });
        const result = await response.json();
        console.log("RPC tx page response:", result);
        if (result.result && result.result.data) {
          result.result.data.forEach((tx) => {
            if (tx.effects?.created) {
              console.log(
                `Tx ${tx.digest}: Found ${tx.effects.created.length} created objects`
              );
              tx.effects.created.forEach((created) => {
                if (created.reference?.objectId && created.reference?.version) {
                  allCreated.push({
                    objectId: created.reference.objectId,
                    version: created.reference.version.toString(),
                    digest: tx.digest,
                  });
                } else {
                  console.log(
                    `Skipping created in tx ${tx.digest}: Missing ID or version`,
                    created
                  );
                }
              });
            } else {
              console.log(`Tx ${tx.digest}: No created objects`);
            }
          });
          cursor = result.result.nextCursor;
          if (!result.result.hasNextPage) {
            cursor = null;
          }
          console.log("Current cursor:", cursor);
          console.log("Total created collected so far:", allCreated.length);
        } else {
          console.error(
            "No result in RPC response, stopping pagination.",
            result
          );
          cursor = null;
        }
      } while (cursor);
    } catch (err) {
      console.error("Error fetching transaction pages:", err);
      cursor = null;
    }

    console.log("Found potential historical NFTs:", allCreated);

    const nftMap = {};
    const newMintInfo = {};
    if (allCreated.length > 0) {
      try {
        const objResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sui_tryMultiGetPastObjects",
            params: [allCreated, { showContent: true, showType: true }],
          }),
        });
        const objResult = await objResponse.json();
        console.log("Historical objects response:", objResult);
        if (objResult.result) {
          objResult.result.forEach((res, index) => {
            console.log(`Processing historical object #${index + 1}:`, res);
            if (res.status === "VersionFound") {
              const objData = res.details;
              if (objData?.content?.fields) {
                const { name, url } = objData.content.fields;
                console.log(
                  `Minted NFT ${index + 1}: Name = ${name}, URL = ${url}`
                );
                nftMap[name] = url;
                newMintInfo[name] = {
                  objectId: allCreated[index].objectId,
                  digest: allCreated[index].digest,
                };
              } else {
                console.log(
                  `Object ${index + 1} (ID: ${
                    objData.objectId
                  }) found but has no content fields.`
                );
              }
            } else {
              console.log(
                `Object ${index + 1} (ID: ${
                  allCreated[index].objectId
                }) could not be fetched with status: ${res.status}`
              );
            }
          });
        } else {
          console.error("No result in objects response:", objResult);
        }
      } catch (err) {
        console.error("Error fetching historical objects:", err);
      }
    }

    console.log("NFTs found:", nftMap);
    console.log("All NFT names found:", Object.keys(nftMap));
    setMintedNftMap(nftMap);
    setMintInfo(newMintInfo);
    setMintedNames(new Set(Object.keys(nftMap)));
  }, []);

  useEffect(() => {
    fetchAllNfts();
  }, [fetchAllNfts]);

  useEffect(() => {
    import("three-spritetext").then((mod) => {
      setSpriteText(() => (mod.default ? mod.default : mod));
    });
  }, []);

  // ------------------------ Callbacks -------------------------------------
  const handleNodeClick = useCallback((node) => {
    setSelected(node.id);
    // focus the input field as soon as it appears
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selected) return;
      const relation = inputRef.current?.value?.trim();
      if (!relation) return;

      setIsAddingRelation(true);

      const aiTarget = await resolveRelation(
        selected,
        relation,
        aiMode,
        localAiModel,
        openRouterModel
      );
      const target = aiTarget.toLowerCase();

      setGraphData((prev) => {
        const exists = prev.nodes.some((n) => n.id === target);
        let nodes = prev.nodes;
        let newNode = null;
        if (!exists) {
          const sourceNode = prev.nodes.find((n) => n.id === selected);
          const childIndex = prev.links.filter(
            (l) => l.source === selected
          ).length;
          const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.399 rad
          const angle = childIndex * goldenAngle;
          const dist = 50;
          const theta = angle;
          const phi = Math.PI / 2 - (childIndex % 5) * 0.2; // some z variation
          const offsetX = dist * Math.cos(theta) * Math.sin(phi);
          const offsetY = dist * Math.sin(theta) * Math.sin(phi);
          const offsetZ = dist * Math.cos(phi);
          newNode = {
            id: target,
            x: (sourceNode.x || 0) + offsetX,
            y: (sourceNode.y || 0) + offsetY,
            z: (sourceNode.z || 0) + offsetZ,
            fx: (sourceNode.x || 0) + offsetX,
            fy: (sourceNode.y || 0) + offsetY,
            fz: (sourceNode.z || 0) + offsetZ,
          };
          nodes = [...prev.nodes, newNode];
        }
        const links = [
          ...prev.links,
          { source: selected, target, label: relation },
        ];
        if (newNode) {
          setPendingMint(target);
          setAutoNftDesc(`${selected} -> ${relation}`);
        }
        return { nodes, links };
      });

      setIsAddingRelation(false);
      inputRef.current.value = "";
      setSelected(null);
    },
    [selected, aiMode, localAiModel, openRouterModel]
  );

  useEffect(() => {
    if (fullscreenView === "2d" && fgRef.current) {
      const { lat, lng } = mapState.center;
      // This is a simplified projection. A proper one would use mercator projection formulas.
      // We are mapping lat/lng to a fictional 3D space.
      const x = (lng - 19) * 20; // Poland's longitude is approx 19
      const y = -(lat - 52) * 20; // Poland's latitude is approx 52
      fgRef.current.cameraPosition({ x, y, z: 500 });
    }
  }, [fullscreenView, mapState.center]);

  // Fit graph to canvas whenever nodes/links change significantly
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400);
    }
  }, [graphData]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!globeRef.current || !isFullscreen) return;
    const DAMPING = 0.95;
    const updateRotation = () => {
      globeRef.current.scene().rotation.y += horizSpeed * 0.02;
      globeRef.current.scene().rotation.x += vertSpeed * 0.02;
      setHorizSpeed((s) => s * DAMPING);
      setVertSpeed((s) => s * DAMPING);
      requestAnimationFrame(updateRotation);
    };
    const frameId = requestAnimationFrame(updateRotation);
    return () => cancelAnimationFrame(frameId);
  }, [horizSpeed, vertSpeed, isFullscreen]);

  // ------------------------ Rendering -------------------------------------
  const handleMint = async () => {
    if (!currentAccount || !pendingMint) return;

    setIsMinting(true);

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${NFT_PACKAGE_ID}::my_nft::mint`,
        arguments: [
          tx.pure.string(pendingMint),
          tx.pure.string(autoNftDesc),
          tx.pure.string(nftUrl),
        ],
      });
      const signResult = await signTransaction({
        transaction: tx,
        chain: "sui:devnet",
      });
      const { bytes, signature } = signResult;
      const executeResult = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showRawEffects: true, showObjectChanges: true },
      });
      if (executeResult.rawEffects && signResult.reportTransactionEffects) {
        signResult.reportTransactionEffects(executeResult.rawEffects);
      }

      // Refetch NFTs after mint to ensure the graph is up-to-date
      await fetchAllNfts();

      // Force graph to re-render the node with the new data
      setGraphData((prevData) => {
        const newNodes = prevData.nodes.map((node) =>
          node.id === pendingMint ? { ...node, _updated: Date.now() } : node
        );
        return { ...prevData, nodes: newNodes };
      });

      alert(`NFT minted! Digest: ${executeResult.digest}`);
    } catch (error) {
      console.error("Mint error:", error);
      alert("Mint failed: " + error.message);
    } finally {
      setIsMinting(false);
      setPendingMint(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* original Sui page content */}
      <SuiPageContent />

      {/* <h2 className="text-2xl font-semibold mt-12">Concept Graph Demo</h2> */}

      {/* Graph canvas */}
      <div
        ref={containerRef}
        className={`w-full overflow-hidden relative ${
          isFullscreen ? "fixed inset-0 z-50 h-screen" : "h-[70vh]"
        }`}
      >
        <div className="absolute top-4 right-4 flex gap-2 z-20">
          <button
            onClick={handleGenerateMockData}
            className="bg-purple-600 text-white px-3 py-1 rounded-md"
            title="Generate Mock Data"
          >
            Generate Mock Data
          </button>
          <button
            onClick={fetchAllNfts}
            className="bg-gray-500 text-white px-3 py-1 rounded-md"
            title="Refresh NFT data"
          >
            Refresh
          </button>
          {isFullscreen && fullscreenView === "3d" && (
            <button
              onClick={() => setFullscreenView("2d")}
              className="bg-blue-600 text-white px-3 py-1 rounded-md"
            >
              Switch to 2D Map
            </button>
          )}
          {isFullscreen && fullscreenView === "2d" && (
            <button
              onClick={() => setFullscreenView("3d")}
              className="bg-blue-600 text-white px-3 py-1 rounded-md"
            >
              Switch to 3D Globe
            </button>
          )}
          {!isFullscreen && (
            <button
              onClick={() => containerRef.current?.requestFullscreen()}
              className="bg-blue-600 text-white px-2 py-1 rounded-md z-20"
            >
              Fullscreen
            </button>
          )}
        </div>
        {isFullscreen && fullscreenView === "3d" && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800/80 p-2 rounded-full flex items-center justify-center gap-2 z-20">
            <button
              onClick={() => {
                if (globeRef.current)
                  globeRef.current.scene().rotation.y -= 0.1;
              }}
              className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              <FiArrowLeft size={20} />
            </button>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  if (globeRef.current)
                    globeRef.current.scene().rotation.x -= 0.1;
                }}
                className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <FiArrowUp size={20} />
              </button>
              <button
                onClick={() => {
                  if (globeRef.current)
                    globeRef.current.scene().rotation.x += 0.1;
                }}
                className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <FiArrowDown size={20} />
              </button>
            </div>
            <button
              onClick={() => {
                if (globeRef.current)
                  globeRef.current.scene().rotation.y += 0.1;
              }}
              className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              <FiArrowRight size={20} />
            </button>
          </div>
        )}
        {isFullscreen && (
          <div
            className={`absolute inset-0 z-0 ${
              fullscreenView === "3d" ? "pointer-events-none" : ""
            }`}
          >
            {fullscreenView === "3d" ? (
              <Globe
                height={undefined}
                enableRotate={false}
                onGlobeLoad={(g) => (globeRef.current = g)}
                width={undefined}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                atmosphereColor="lightskyblue"
                atmosphereAltitude={0.15}
                className="absolute inset-0"
              />
            ) : (
              <SuiMap onMapChange={setMapState} />
            )}
          </div>
        )}

        {/* Force graph overlay */}
        <div
          className="absolute inset-0 z-10"
          style={{
            pointerEvents:
              isFullscreen && fullscreenView === "2d" ? "none" : "auto",
            opacity: fullscreenView === "2d" && mapState.zoom < 5 ? 0 : 1,
            transition: "opacity 0.3s ease-in-out",
          }}
        >
          <ForceGraph3D
            ref={fgRef}
            graphData={graphData}
            nodeAutoColorBy="id"
            linkDirectionalArrowLength={
              fullscreenView === "2d" && mapState.zoom < 7 ? 0 : 4
            }
            linkDirectionalArrowRelPos={1}
            nodeRelSize={
              fullscreenView === "2d" ? Math.max(0, (mapState.zoom - 6) * 4) : 8
            }
            nodeThreeObjectExtend={false}
            cooldownTicks={fullscreenView === "2d" ? 0 : undefined}
            linkColor={(link) => relationToColor(link.label)}
            linkWidth={2}
            rendererConfig={{ alpha: true, antialias: true }}
            backgroundColor="rgba(0,0,0,0)"
            className="absolute inset-0"
            nodeThreeObject={(node) => {
              if (mintedNames.has(node.id)) {
                const url = mintedNftMap[node.id];
                if (url) {
                  const loader = new TextureLoader();
                  const texture = loader.load(url);
                  texture.colorSpace = SRGBColorSpace;
                  const material = new SpriteMaterial({ map: texture });
                  const imgSprite = new Sprite(material);
                  imgSprite.scale.set(30, 30, 1);
                  return imgSprite;
                }
              }
              if (!SpriteText) return new Group();
              const textSprite = new SpriteText(node.id);
              textSprite.color = stringToLightColor(node.id, resolvedTheme);
              textSprite.textHeight = 20;
              return textSprite;
            }}
            linkThreeObjectExtend={true}
            linkThreeObject={(link) => {
              if (!link.label || !SpriteText) return undefined;
              const sprite = new SpriteText(link.label);
              sprite.color = stringToLightColor(link.label, resolvedTheme);
              sprite.textHeight = 10;
              return sprite;
            }}
            linkPositionUpdate={(sprite, { start, end }) => {
              if (!sprite) return;
              const pos = {
                x: (start.x + end.x) / 2,
                y: (start.y + end.y) / 2,
                z: (start.z + end.z) / 2,
              };
              sprite.position.set(pos.x, pos.y, pos.z);
            }}
            onNodeClick={handleNodeClick}
          />
        </div>
      </div>
      {/* Relation input */}
      {selected && (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border p-3 rounded-md shadow-sm relative z-10 bg-white/90 dark:bg-gray-800/90"
        >
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Relation from <strong>{selected}</strong>:
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="e.g. bigger"
            className="border px-2 py-1 rounded-md text-sm focus:outline-none text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm dark:bg-blue-500"
            disabled={isAddingRelation}
          >
            {isAddingRelation ? "Adding..." : "Add"}
          </button>
          {isAddingRelation && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-gray-100 ml-2"></div>
          )}
        </form>
      )}
      {!selected && (
        <p className="text-sm text-gray-500">
          Click a node to create a new relation.
        </p>
      )}
      {pendingMint && (
        <div className="border p-4 rounded-md shadow-sm mt-4">
          {mintedNames.has(pendingMint) ? (
            <div>
              <h3>The name &quot;{pendingMint}&quot; is already minted.</h3>
              {mintInfo[pendingMint] && (
                <div className="text-sm mt-2">
                  <p>
                    <a
                      href={`https://suiscan.xyz/devnet/object/${mintInfo[pendingMint].objectId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      View NFT on Suiscan
                    </a>
                  </p>
                  <p>
                    <a
                      href={`https://suiscan.xyz/devnet/tx/${mintInfo[pendingMint].digest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      View Mint Transaction
                    </a>
                  </p>
                </div>
              )}
              <p className="mt-4">Would you like to place a bid instead?</p>
              <button
                onClick={() => {
                  alert("Bidding is a work-in-progress feature.");
                  setPendingMint(null);
                }}
                className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm mt-2"
              >
                Place Bid
              </button>
              <button
                onClick={() => setPendingMint(null)}
                className="bg-gray-400 text-white px-3 py-1 rounded-md text-sm ml-2 mt-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <h3>Mint new concept &quot;{pendingMint}&quot; as NFT?</h3>
              <p className="text-sm text-gray-500 my-2">
                Description:{" "}
                <span className="font-mono bg-gray-100 dark:bg-gray-700 p-1 rounded">
                  {autoNftDesc}
                </span>
              </p>
              <input
                type="text"
                placeholder="Image URL"
                value={nftUrl}
                onChange={(e) => setNftUrl(e.target.value)}
                className="border px-2 py-1 rounded-md text-sm ml-2"
              />
              <button
                onClick={handleMint}
                disabled={isMinting}
                className="bg-green-600 text-white px-3 py-1 rounded-md text-sm ml-2 disabled:bg-gray-400"
              >
                {isMinting ? "Minting..." : "Mint"}
              </button>
              <button
                onClick={() => setPendingMint(null)}
                disabled={isMinting}
                className="bg-red-600 text-white px-3 py-1 rounded-md text-sm ml-2 disabled:bg-gray-400"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
      {/* Debug Menu */}
      <div className="flex gap-2 mt-4 items-center">
        <button
          onClick={() => setAiMode("local")}
          className={`px-3 py-1 rounded ${
            aiMode === "local"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          Local AI
        </button>
        <button
          onClick={() => setAiMode("openrouter")}
          className={`px-3 py-1 rounded ${
            aiMode === "openrouter"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          OpenRouter AI
        </button>
        {aiMode === "local" && (
          <select
            value={localAiModel}
            onChange={(e) => setLocalAiModel(e.target.value)}
            className="border px-2 py-1 rounded-md text-sm focus:outline-none text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
          >
            {localModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        )}
        {aiMode === "openrouter" && (
          <select
            value={openRouterModel}
            onChange={(e) => setOpenRouterModel(e.target.value)}
            className="border px-2 py-1 rounded-md text-sm focus:outline-none text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
          >
            {openRouterModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        )}
      </div>
      <h3 className="text-xl font-semibold mt-8">Future Steps</h3>
      <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300">
        <li>
          Implement semantic node placement where direction depends on relation
          logic (e.g., &apos;bigger&apos; to the right, &apos;smaller&apos; to
          the left).
        </li>
        <li>
          Group semantically similar nodes closer together using embeddings.
        </li>
        <li>Bidding on already taken NFTs.</li>
        <li>
          Find a better name for the collection than &quot;Awesome NFTs&quot;.
        </li>
        <li>
          Constrain names to be unique through the Move smart contract rather
          than through web2.
        </li>
        <li>Use IPFS for storing images instead of URLs.</li>
      </ul>
    </div>
  );
}
