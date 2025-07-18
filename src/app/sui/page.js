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
import { NFT_PACKAGE_ID } from "../../components/SuiPageContent";

// 3D graph library & text sprites
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

const SuiMap = dynamic(() => import("../../components/SuiMap"), { ssr: false });

const Globe = dynamic(() => import("../../components/GlobeWrapper"), {
  ssr: false,
});

// constants

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

// helper functions

function latLngToCartesian(lat, lon, radius = 110) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

async function getLocalAIResponse(sourceWord, relationType, selectedModel) {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that suggests a single word related to the source via the given relation. Respond only with the word.",
          },
          {
            role: "user",
            content: `Source: ${sourceWord}, Relation: ${relationType}`,
          },
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
    return `${relationType}-${sourceWord}`;
  }
}

async function getOpenRouterAIResponse(
  sourceWord,
  relationType,
  selectedModel
) {
  const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key not configured");
  }
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel || "meta-llama/llama-3.1-8b-instruct:free",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that suggests a single word related to the source via the given relation. Respond only with the word.",
            },
            {
              role: "user",
              content: `Source: ${sourceWord}, Relation: ${relationType}`,
            },
          ],
        }),
      }
    );
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }
    const data = await response.json();
    const targetWord = data.choices[0].message.content.trim();
    return targetWord;
  } catch (error) {
    console.error("OpenRouter AI error:", error);
    throw error;
  }
}

async function resolveRelationFromSource(
  sourceWord,
  relationType,
  aiMode,
  localSelectedModel,
  openRouterSelectedModel
) {
  try {
    if (aiMode === "local") {
      return await getLocalAIResponse(
        sourceWord,
        relationType,
        localSelectedModel
      );
    } else {
      return await getOpenRouterAIResponse(
        sourceWord,
        relationType,
        openRouterSelectedModel
      );
    }
  } catch (error) {
    console.error("AI error:", error);
    return `${relationType}-${sourceWord}`;
  }
}

function getColorForRelation(relation) {
  let hash = 0;
  for (let i = 0; i < (relation || "").length; i++) {
    hash = relation.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % vibrantColors.length;
  return vibrantColors[index];
}

function getLightColorFromString(inputString, currentTheme) {
  let hash = 0;
  for (let i = 0; i < (inputString || "").length; i++) {
    hash = inputString.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  if (currentTheme === "light") {
    return `hsl(${hue}, 70%, 20%)`;
  } else {
    return `hsl(${hue}, 80%, 85%)`;
  }
}

// Add content component
const SuiPageContent = dynamic(
  () => import("../../components/SuiPageContent"),
  {
    ssr: false,
  }
);

// main component
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
  const [isMinting, setIsMinting] = useState(false);
  const [nftUrl, setNftUrl] = useState("https://picsum.photos/400");
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
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const relationInputRef = useRef(null);
  const forceGraphRef = useRef();
  const globeInstanceRef = useRef(null);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const graphContainerRef = useRef(null);
  const [horizontalRotationSpeed, setHorizontalRotationSpeed] = useState(0);
  const [verticalRotationSpeed, setVerticalRotationSpeed] = useState(0);
  const [mintedNftImageMap, setMintedNftImageMap] = useState({});
  const [mintTransactionInfo, setMintTransactionInfo] = useState({});
  const [fullscreenViewMode, setFullscreenViewMode] = useState("3d");
  const [mapConfiguration, setMapConfiguration] = useState({
    zoom: 6,
    center: { lat: 52, lng: 19 },
  });
  const [isAddingNewRelation, setIsAddingNewRelation] = useState(false);
  const [autoNftDesc, setAutoNftDesc] = useState("");

  // effects

  const fetchAllMintedNfts = useCallback(async () => {
    console.log("Fetching all mint transactions via RPC...");
    const shinamiKey = process.env.SHINAMI_RPC_KEY;
    const rpcUrl = shinamiKey
      ? `https://api.shinami.com:443/fullnode_v1/${shinamiKey}`
      : "https://fullnode.devnet.sui.io:443";
    console.log("Using RPC URL:", rpcUrl);

    const allCreatedObjects = [];
    let paginationCursor = null;
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
              paginationCursor,
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
                  allCreatedObjects.push({
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
          paginationCursor = result.result.nextCursor;
          if (!result.result.hasNextPage) {
            paginationCursor = null;
          }
          console.log("Current cursor:", paginationCursor);
          console.log(
            "Total created collected so far:",
            allCreatedObjects.length
          );
        } else {
          console.error(
            "No result in RPC response, stopping pagination.",
            result
          );
          paginationCursor = null;
        }
      } while (paginationCursor);
    } catch (err) {
      console.error("Error fetching transaction pages:", err);
      paginationCursor = null;
    }

    console.log("Found potential historical NFTs:", allCreatedObjects);

    const nftNameToUrlMap = {};
    const newMintInfoMap = {};
    if (allCreatedObjects.length > 0) {
      try {
        const objResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sui_tryMultiGetPastObjects",
            params: [allCreatedObjects, { showContent: true, showType: true }],
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
                nftNameToUrlMap[name] = url;
                newMintInfoMap[name] = {
                  objectId: allCreatedObjects[index].objectId,
                  digest: allCreatedObjects[index].digest,
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
                  allCreatedObjects[index].objectId
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

    console.log("NFTs found:", nftNameToUrlMap);
    console.log("All NFT names found:", Object.keys(nftNameToUrlMap));
    setMintedNftImageMap(nftNameToUrlMap);
    setMintTransactionInfo(newMintInfoMap);
    setMintedNames(new Set(Object.keys(nftNameToUrlMap)));
  }, []);

  useEffect(() => {
    fetchAllMintedNfts();
  }, [fetchAllMintedNfts]);

  useEffect(() => {
    import("three-spritetext").then((mod) => {
      setSpriteText(() => (mod.default ? mod.default : mod));
    });
  }, []);

  useEffect(() => {
    if (fullscreenViewMode === "2d" && forceGraphRef.current) {
      const { lat, lng } = mapConfiguration.center;
      const x = (lng - 19) * 20;
      const y = -(lat - 52) * 20;
      forceGraphRef.current.cameraPosition({ x, y, z: 500 });
    }
  }, [fullscreenViewMode, mapConfiguration.center]);

  useEffect(() => {
    if (forceGraphRef.current) {
      forceGraphRef.current.zoomToFit(400);
    }
  }, [graphData]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreenMode(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!globeInstanceRef.current || !isFullscreenMode) return;
    const DAMPING = 0.95;
    const updateRotation = () => {
      globeInstanceRef.current.scene().rotation.y +=
        horizontalRotationSpeed * 0.02;
      globeInstanceRef.current.scene().rotation.x +=
        verticalRotationSpeed * 0.02;
      setHorizontalRotationSpeed((s) => s * DAMPING);
      setVerticalRotationSpeed((s) => s * DAMPING);
      requestAnimationFrame(updateRotation);
    };
    const frameId = requestAnimationFrame(updateRotation);
    return () => cancelAnimationFrame(frameId);
  }, [horizontalRotationSpeed, verticalRotationSpeed, isFullscreenMode]);

  // handlers

  const handleNodeClick = useCallback((node) => {
    setSelectedNodeId(node.id);
    setTimeout(() => relationInputRef.current?.focus(), 0);
  }, []);

  const handleRelationSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selectedNodeId) return;
      const relationType = relationInputRef.current?.value?.trim();
      if (!relationType) return;

      setIsAddingNewRelation(true);

      const targetWord = await resolveRelationFromSource(
        selectedNodeId,
        relationType,
        aiMode,
        localAiModel,
        openRouterModel
      );
      const lowercaseTarget = targetWord.toLowerCase();

      setGraphData((prev) => {
        const nodeExists = prev.nodes.some((n) => n.id === lowercaseTarget);
        let updatedNodes = prev.nodes;
        let newNode = null;
        if (!nodeExists) {
          const sourceNode = prev.nodes.find((n) => n.id === selectedNodeId);
          const childIndex = prev.links.filter(
            (l) => l.source === selectedNodeId
          ).length;
          const goldenAngle = Math.PI * (3 - Math.sqrt(5));
          const angle = childIndex * goldenAngle;
          const dist = 50;
          const theta = angle;
          const phi = Math.PI / 2 - (childIndex % 5) * 0.2;
          const offsetX = dist * Math.cos(theta) * Math.sin(phi);
          const offsetY = dist * Math.sin(theta) * Math.sin(phi);
          const offsetZ = dist * Math.cos(phi);
          newNode = {
            id: lowercaseTarget,
            x: (sourceNode.x || 0) + offsetX,
            y: (sourceNode.y || 0) + offsetY,
            z: (sourceNode.z || 0) + offsetZ,
            fx: (sourceNode.x || 0) + offsetX,
            fy: (sourceNode.y || 0) + offsetY,
            fz: (sourceNode.z || 0) + offsetZ,
          };
          updatedNodes = [...prev.nodes, newNode];
        }
        const updatedLinks = [
          ...prev.links,
          {
            source: selectedNodeId,
            target: lowercaseTarget,
            label: relationType,
          },
        ];
        if (newNode) {
          setPendingMint(lowercaseTarget);
          setAutoNftDesc(`${selectedNodeId} -> ${relationType}`);
        }
        return { nodes: updatedNodes, links: updatedLinks };
      });

      setIsAddingNewRelation(false);
      relationInputRef.current.value = "";
      setSelectedNodeId(null);
    },
    [selectedNodeId, aiMode, localAiModel, openRouterModel]
  );

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

    const numNodesToGenerate = 300;
    const numClusters = 7;
    const nodesPerCluster = Math.floor(numNodesToGenerate / numClusters);

    let newNodesToAdd = [];
    let newLinksToAdd = [];
    const existingNodeIdsSet = new Set(graphData.nodes.map((n) => n.id));

    for (let clusterIndex = 0; clusterIndex < numClusters; clusterIndex++) {
      const clusterNodes = [];
      for (let nodeIndex = 0; nodeIndex < nodesPerCluster; nodeIndex++) {
        const wordIndex =
          (clusterIndex * nodesPerCluster + nodeIndex) % wordList.length;
        let nodeId = wordList[wordIndex];
        if (existingNodeIdsSet.has(nodeId)) {
          nodeId = `${nodeId}_${clusterIndex}_${nodeIndex}`;
        }
        if (!existingNodeIdsSet.has(nodeId)) {
          newNodesToAdd.push({ id: nodeId });
          clusterNodes.push(nodeId);
          existingNodeIdsSet.add(nodeId);
        }
      }

      for (let k = 0; k < clusterNodes.length; k++) {
        const source = clusterNodes[k];
        const numConnections = Math.floor(Math.random() * 3) + 1;
        for (let l = 0; l < numConnections; l++) {
          const target =
            clusterNodes[Math.floor(Math.random() * clusterNodes.length)];
          if (source !== target) {
            newLinksToAdd.push({ source, target, label: "related_to" });
          }
        }
      }
    }

    setGraphData((prev) => ({
      nodes: [...prev.nodes, ...newNodesToAdd],
      links: [...prev.links, ...newLinksToAdd],
    }));
  };

  const handleMintNft = async () => {
    if (!currentAccount || !pendingMint) return;

    setIsMinting(true);

    try {
      const transaction = new Transaction();
      transaction.moveCall({
        target: `${NFT_PACKAGE_ID}::my_nft::mint`,
        arguments: [
          transaction.pure.string(pendingMint),
          transaction.pure.string(autoNftDesc),
          transaction.pure.string(nftUrl),
        ],
      });
      const signResult = await signTransaction({
        transaction,
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

      await fetchAllMintedNfts();

      setGraphData((prevData) => {
        const updatedNodes = prevData.nodes.map((node) =>
          node.id === pendingMint ? { ...node, _updated: Date.now() } : node
        );
        return { ...prevData, nodes: updatedNodes };
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

  // render

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <SuiPageContent />

      <div
        ref={graphContainerRef}
        className={`w-full overflow-hidden relative ${
          isFullscreenMode ? "fixed inset-0 z-50 h-screen" : "h-[70vh]"
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
            onClick={fetchAllMintedNfts}
            className="bg-gray-500 text-white px-3 py-1 rounded-md"
            title="Refresh NFT data"
          >
            Refresh
          </button>
          {isFullscreenMode && fullscreenViewMode === "3d" && (
            <button
              onClick={() => setFullscreenViewMode("2d")}
              className="bg-blue-600 text-white px-3 py-1 rounded-md"
            >
              Switch to 2D Map
            </button>
          )}
          {isFullscreenMode && fullscreenViewMode === "2d" && (
            <button
              onClick={() => setFullscreenViewMode("3d")}
              className="bg-blue-600 text-white px-3 py-1 rounded-md"
            >
              Switch to 3D Globe
            </button>
          )}
          {!isFullscreenMode && (
            <button
              onClick={() => graphContainerRef.current?.requestFullscreen()}
              className="bg-blue-600 text-white px-2 py-1 rounded-md z-20"
            >
              Fullscreen
            </button>
          )}
        </div>
        {isFullscreenMode && fullscreenViewMode === "3d" && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800/80 p-2 rounded-full flex items-center justify-center gap-2 z-20">
            <button
              onClick={() => {
                if (globeInstanceRef.current)
                  globeInstanceRef.current.scene().rotation.y -= 0.1;
              }}
              className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              <FiArrowLeft size={20} />
            </button>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  if (globeInstanceRef.current)
                    globeInstanceRef.current.scene().rotation.x -= 0.1;
                }}
                className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <FiArrowUp size={20} />
              </button>
              <button
                onClick={() => {
                  if (globeInstanceRef.current)
                    globeInstanceRef.current.scene().rotation.x += 0.1;
                }}
                className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <FiArrowDown size={20} />
              </button>
            </div>
            <button
              onClick={() => {
                if (globeInstanceRef.current)
                  globeInstanceRef.current.scene().rotation.y += 0.1;
              }}
              className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              <FiArrowRight size={20} />
            </button>
          </div>
        )}
        {isFullscreenMode && (
          <div
            className={`absolute inset-0 z-0 ${
              fullscreenViewMode === "3d" ? "pointer-events-none" : ""
            }`}
          >
            {fullscreenViewMode === "3d" ? (
              <Globe
                height={undefined}
                enableRotate={false}
                onGlobeLoad={(g) => (globeInstanceRef.current = g)}
                width={undefined}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                atmosphereColor="lightskyblue"
                atmosphereAltitude={0.15}
                className="absolute inset-0"
              />
            ) : (
              <SuiMap onMapChange={setMapConfiguration} />
            )}
          </div>
        )}

        <div
          className="absolute inset-0 z-10"
          style={{
            pointerEvents:
              isFullscreenMode && fullscreenViewMode === "2d" ? "none" : "auto",
            opacity:
              fullscreenViewMode === "2d" && mapConfiguration.zoom < 5 ? 0 : 1,
            transition: "opacity 0.3s ease-in-out",
          }}
        >
          <ForceGraph3D
            ref={forceGraphRef}
            graphData={graphData}
            nodeAutoColorBy="id"
            linkDirectionalArrowLength={
              fullscreenViewMode === "2d" && mapConfiguration.zoom < 7 ? 0 : 4
            }
            linkDirectionalArrowRelPos={1}
            nodeRelSize={
              fullscreenViewMode === "2d"
                ? Math.max(0, (mapConfiguration.zoom - 6) * 4)
                : 8
            }
            nodeThreeObjectExtend={false}
            cooldownTicks={fullscreenViewMode === "2d" ? 0 : undefined}
            linkColor={(link) => getColorForRelation(link.label)}
            linkWidth={2}
            rendererConfig={{ alpha: true, antialias: true }}
            backgroundColor="rgba(0,0,0,0)"
            className="absolute inset-0"
            nodeThreeObject={(node) => {
              if (mintedNames.has(node.id)) {
                const url = mintedNftImageMap[node.id];
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
              textSprite.color = getLightColorFromString(
                node.id,
                resolvedTheme
              );
              textSprite.textHeight = 20;
              return textSprite;
            }}
            linkThreeObjectExtend={true}
            linkThreeObject={(link) => {
              if (!link.label || !SpriteText) return undefined;
              const sprite = new SpriteText(link.label);
              sprite.color = getLightColorFromString(link.label, resolvedTheme);
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
      {selectedNodeId && (
        <form
          onSubmit={handleRelationSubmit}
          className="flex items-center gap-2 border p-3 rounded-md shadow-sm relative z-10 bg-white/90 dark:bg-gray-800/90"
        >
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Relation from <strong>{selectedNodeId}</strong>:
          </span>
          <input
            ref={relationInputRef}
            type="text"
            placeholder="e.g. bigger"
            className="border px-2 py-1 rounded-md text-sm focus:outline-none text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm dark:bg-blue-500"
            disabled={isAddingNewRelation}
          >
            {isAddingNewRelation ? "Adding..." : "Add"}
          </button>
          {isAddingNewRelation && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-gray-100 ml-2"></div>
          )}
        </form>
      )}
      {!selectedNodeId && (
        <p className="text-sm text-gray-500">
          Click a node to create a new relation.
        </p>
      )}
      {pendingMint && (
        <div className="border p-4 rounded-md shadow-sm mt-4">
          {mintedNames.has(pendingMint) ? (
            <div>
              <h3>The name &quot;{pendingMint}&quot; is already minted.</h3>
              {mintTransactionInfo[pendingMint] && (
                <div className="text-sm mt-2">
                  <p>
                    <a
                      href={`https://suiscan.xyz/devnet/object/${mintTransactionInfo[pendingMint].objectId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      View NFT on Suiscan
                    </a>
                  </p>
                  <p>
                    <a
                      href={`https://suiscan.xyz/devnet/tx/${mintTransactionInfo[pendingMint].digest}`}
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
                onClick={handleMintNft}
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
