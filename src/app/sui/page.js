"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiArrowDown,
  FiArrowLeft,
  FiArrowRight,
  FiArrowUp,
} from "react-icons/fi";
// 3D graph library & text sprites
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});
let SpriteText = null;
if (typeof window !== "undefined") {
  const mod = require("three-spritetext");
  SpriteText = mod.default ? mod.default : mod;
}

const Globe = dynamic(() => import("../../components/GlobeWrapper"), {
  ssr: false,
});

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

/**
 * Very small demo knowledge-base that returns a related concept for a pair
 * (source, relation). In a production setting this would consult a vector DB
 * (via embeddings) or a knowledge graph.
 */
function resolveRelation(source, relation) {
  const key = `${source.toLowerCase()}|${relation.toLowerCase()}`;
  const dictionary = {
    /** examples */
    "cat|bigger": "lion",
  };
  // Fallback: invent a synthetic target so that the UI always responds
  return dictionary[key] || `${relation}-${source}`;
}

export default function SuiGraphPage() {
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

  // ------------------------ Callbacks -------------------------------------
  const handleNodeClick = useCallback((node) => {
    setSelected(node.id);
    // focus the input field as soon as it appears
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!selected) return;
      const relation = inputRef.current?.value?.trim();
      if (!relation) return;

      const target = resolveRelation(selected, relation);

      // Update graph: add node if new, then add link
      setGraphData((prev) => {
        const exists = prev.nodes.some((n) => n.id === target);
        const nodes = exists ? prev.nodes : [...prev.nodes, { id: target }];
        const links = [
          ...prev.links,
          { source: selected, target, label: relation },
        ];
        return { nodes, links };
      });

      // reset UI
      inputRef.current.value = "";
      setSelected(null);
    },
    [selected]
  );

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
  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* original Sui page content */}
      <SuiPageContent />

      <h2 className="text-2xl font-semibold mt-12">Concept Graph Demo</h2>

      {/* Graph canvas */}
      <div
        ref={containerRef}
        className={`w-full border rounded-md shadow-sm overflow-hidden relative ${
          isFullscreen ? "fixed inset-0 z-50 h-screen" : "h-[70vh]"
        }`}
      >
        <button
          onClick={() => {
            if (isFullscreen) {
              document.exitFullscreen();
            } else {
              containerRef.current?.requestFullscreen();
            }
          }}
          className="absolute top-4 right-4 bg-blue-600 text-white px-2 py-1 rounded-md z-20"
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
        {isFullscreen && (
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
          <div className="absolute inset-0 z-0 pointer-events-none">
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
          </div>
        )}

        {/* Force graph overlay */}
        <div className="absolute inset-0 z-10">
          <ForceGraph3D
            ref={fgRef}
            graphData={graphData}
            nodeAutoColorBy="id"
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            nodeRelSize={8}
            nodeThreeObjectExtend={true}
            rendererConfig={{ alpha: true, antialias: true }}
            backgroundColor="rgba(0,0,0,0)"
            className="absolute inset-0"
            nodeThreeObject={(node) => {
              if (!SpriteText) return undefined;
              const sprite = new SpriteText(node.id);
              sprite.color = node.color ?? "#fff";
              sprite.textHeight = 20;
              return sprite;
            }}
            linkThreeObjectExtend={true}
            linkThreeObject={(link) => {
              if (!link.label || !SpriteText) return undefined;
              const sprite = new SpriteText(link.label);
              sprite.color = "#ffeb3b";
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
          >
            Add
          </button>
        </form>
      )}
      {!selected && (
        <p className="text-sm text-gray-500">
          Click a node to create a new relation.
        </p>
      )}
    </div>
  );
}
