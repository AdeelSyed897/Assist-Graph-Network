// MVP/Frontend/src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import * as d3 from "d3-force";

const DEFAULTS = {
  backendBaseUrl: "http://127.0.0.1:8000",
  gameId: "0042400306",
  teamId: "1610612754",
  minEdgeWeight: 1,
};

const PALETTE = {
  bg: "#0f172a", 
  sidebarBgTop: "rgba(255,255,255,0.06)",
  sidebarBgBottom: "rgba(255,255,255,0.03)",
  text: "#e2e8f0",
  mutedText: "rgba(226,232,240,0.75)",
  inputBg: "rgba(148,163,184,0.14)", 
  inputBorder: "rgba(148,163,184,0.22)",
  cardBg: "rgba(148,163,184,0.10)",
  cardBorder: "rgba(148,163,184,0.20)",

  node: "rgba(56,189,248,0.85)", 
  nodeFaded: "rgba(148,163,184,0.18)",

  glow: "rgba(99,102,241,0.22)", 
  outEdge: "rgba(34,211,238,0.90)", 
  inEdge: "rgba(251,113,133,0.92)", 
  edge: "rgba(148,163,184,0.35)", 
  edgeFaded: "rgba(148,163,184,0.10)",
};

export default function App() {
  const fgRef = useRef(null);

  const [backendBaseUrl, setBackendBaseUrl] = useState(DEFAULTS.backendBaseUrl);
  const [gameId, setGameId] = useState(DEFAULTS.gameId);
  const [teamId, setTeamId] = useState(DEFAULTS.teamId);
  const [minEdgeWeight, setMinEdgeWeight] = useState(DEFAULTS.minEdgeWeight);

  const [data, setData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [hoverNode, setHoverNode] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const activeId = selectedNodeId || (hoverNode ? hoverNode.id : null);

  const [playerStats, setPlayerStats] = useState(null);
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false);
  const [playerStatsError, setPlayerStatsError] = useState("");

  const [centrality, setCentrality] = useState({});
  
  // Fetch player stats when activeId changes
  useEffect(() => {
    if (!activeId) {
      setPlayerStats(null);
      setPlayerStatsError("");
      setPlayerStatsLoading(false);
      return;
    }
    let cancelled = false;
    setPlayerStatsLoading(true);
    setPlayerStatsError("");
    setPlayerStats(null);
    fetch(`${backendBaseUrl}/player/${encodeURIComponent(activeId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Backend error: ${res.status} ${res.statusText}`);
        const json = await res.json();
        if (!cancelled) setPlayerStats(json);
      })
      .catch((e) => {
        if (!cancelled) setPlayerStatsError(e?.message || "Failed to fetch player stats");
      })
      .finally(() => {
        if (!cancelled) setPlayerStatsLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeId, backendBaseUrl]);

  const fetchGraph = async () => {
    setLoading(true);
    setErr("");
    try {
      const url = new URL("/graph", backendBaseUrl);
      url.searchParams.set("game_id", gameId);
      url.searchParams.set("team_id", teamId);
      url.searchParams.set("min_edge_weight", String(minEdgeWeight));

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Backend error: ${res.status} ${res.statusText}`);
      const jsonGraph = await res.json();

      // Fetch centrality right after graph
      let centralityJson = {};
      try {
        const centralityUrl = new URL("/centrality", backendBaseUrl);
        const resCentrality = await fetch(centralityUrl.toString());
        if (resCentrality.ok) {
          centralityJson = await resCentrality.json();
        }
      } catch (e) {
        centralityJson = {};
      }
      setCentrality(centralityJson || {});

      setData({
        nodes: jsonGraph.nodes || [],
        links: jsonGraph.links || [],
      });

      setTimeout(() => {
        fgRef.current?.d3ReheatSimulation();
        fgRef.current?.zoomToFit(600, 100);
      }, 500);
    } catch (e) {
      setErr(e?.message || "Failed to fetch graph");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  useEffect(() => {
    if (!fgRef.current) return;

    fgRef.current.d3Force("charge")?.strength(-240);
    fgRef.current
      .d3Force("link")
      ?.distance((link) => 90 + Number(link.weight ?? 1) * 10);

    // Keep unconnected nodes in frame
    fgRef.current.d3Force("x", d3.forceX(0).strength(0.06));
    fgRef.current.d3Force("y", d3.forceY(0).strength(0.06));

    fgRef.current.d3ReheatSimulation?.();
  }, [data]);

  const nodeSize = (node) => {
    const pts = Number(node.val ?? 0);
    return 3 + pts * 0.35;
  };

  const graphMeta = useMemo(() => {
    const out = new Map();
    const inn = new Map();
    for (const l of data.links || []) {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      const w = Number(l.weight ?? 0);
      if (!out.has(s)) out.set(s, new Map());
      if (!inn.has(t)) inn.set(t, new Map());
      out.get(s).set(t, w);
      inn.get(t).set(s, w);
    }
    return { out, inn };
  }, [data]);

  const isNeighborOfActive = (nodeId) => {
    if (!activeId || !nodeId) return false;
    if (nodeId === activeId) return true;
    return (
      graphMeta.out.get(activeId)?.has(nodeId) ||
      graphMeta.inn.get(activeId)?.has(nodeId) ||
      graphMeta.out.get(nodeId)?.has(activeId) ||
      graphMeta.inn.get(nodeId)?.has(activeId)
    );
  };

  const edgeInspector = useMemo(() => {
    if (!activeId) return { outgoing: [], incoming: [] };
    const outgoingMap = graphMeta.out.get(activeId) || new Map();
    const incomingMap = graphMeta.inn.get(activeId) || new Map();
    const outgoing = Array.from(outgoingMap.entries()).map(([target, weight]) => ({ target, weight })).sort((a, b) => b.weight - a.weight);
    const incoming = Array.from(incomingMap.entries()).map(([source, weight]) => ({ source, weight })).sort((a, b) => b.weight - a.weight);
    return { outgoing, incoming };
  }, [activeId, graphMeta]);

  // Ensure the app fills the viewport and grid is not clipped
  if (typeof window !== "undefined") {
    const style = document.createElement("style");
    style.innerHTML = `
      html, body, #root {
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #0f172a;
      }
    `;
    document.head.appendChild(style);
  }

  return (
    <div style={{...styles.page, gridTemplateColumns: "340px 1fr"}}>
      {/* Left Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.title}>NBA Assist Graph MVP</div>
        <div style={styles.subTitle}>
          Hover a node to inspect outgoing/incoming edges + weights. Click to lock.
        </div>

        {/* Player Stats Panel (moved to top of sidebar) */}
        {activeId ? (
          <div style={styles.statsPanelSidebar}>
            <div style={styles.statsPanelTitle}>Player Stats: <span style={{color: PALETTE.node}}>{activeId}</span></div>
            {playerStatsLoading ? (
              <div style={styles.statsPanelLoading}>Loading...</div>
            ) : playerStatsError ? (
              <div style={styles.statsPanelError}>⚠️ {playerStatsError}</div>
            ) : playerStats ? (
              <div style={styles.statsPanelContent}>
                {playerStats.error ? (
                  <div style={styles.statsPanelError}>⚠️ {playerStats.error}</div>
                ) : (
                  <ul style={styles.statsPanelList}>
                    <li><b>Team Points:</b> {playerStats.team_pts}</li>
                    <li><b>Scoring:</b> {playerStats.scoring}</li>
                    <li><b>Playmaking:</b> {playerStats.playmaking}</li>
                    <li><b>EigenCentrality:</b> {(centrality[activeId]).toFixed(2)}</li>
                  </ul>
                )}
              </div>
            ) : (
              <div style={styles.statsPanelLoading}>No data.</div>
            )}
          </div>
        ) : null}

        <div style={styles.inspector}>
          <div style={styles.inspectorHeader}>
            <div style={{ fontWeight: 800 }}>
              {activeId ? `Inspecting: ${activeId}` : "Edge Inspector"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {activeId ? "Outgoing is cyan, incoming is rose." : "Hover or click a node to see edge weights."}
            </div>
          </div>

          {activeId ? (
            <div style={styles.inspectorGrid}>
              <div style={styles.inspectorCol}>
                <div style={styles.inspectorTitle}>
                  <span style={{ color: PALETTE.outEdge, fontWeight: 900 }}>Outgoing</span>{" "}
                  <span style={{ opacity: 0.7 }}>(A → …)</span>
                </div>
                {edgeInspector.outgoing.length ? (
                  <div style={styles.list}>
                    {edgeInspector.outgoing.slice(0, 12).map((e) => (
                      <div key={`out-${e.target}`} style={styles.listRow}>
                        <span style={styles.listLeft}>{activeId} → {e.target}</span>
                        <span style={styles.listRight}>{e.weight}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.empty}>No outgoing edges</div>
                )}
              </div>

              <div style={styles.inspectorCol}>
                <div style={styles.inspectorTitle}>
                  <span style={{ color: PALETTE.inEdge, fontWeight: 900 }}>Incoming</span>{" "}
                  <span style={{ opacity: 0.7 }}>(… → A)</span>
                </div>
                {edgeInspector.incoming.length ? (
                  <div style={styles.list}>
                    {edgeInspector.incoming.slice(0, 12).map((e) => (
                      <div key={`in-${e.source}`} style={styles.listRow}>
                        <span style={styles.listLeft}>{e.source} → {activeId}</span>
                        <span style={styles.listRight}>{e.weight}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.empty}>No incoming edges</div>
                )}
              </div>
            </div>
          ) : (
            <div style={styles.empty}>Hover or click a node to populate this panel.</div>
          )}
        </div>

        <div style={styles.formRow}>
          <label style={styles.label}>Game ID</label>
          <input style={styles.input} value={gameId} onChange={(e) => setGameId(e.target.value)} />
        </div>

        <div style={styles.formRow}>
          <label style={styles.label}>Team ID</label>
          <input style={styles.input} value={teamId} onChange={(e) => setTeamId(e.target.value)} />
        </div>

        <div style={styles.formRow}>
          <label style={styles.label}>Min Edge Weight</label>
          <input
            style={styles.input}
            type="number"
            value={minEdgeWeight}
            onChange={(e) => setMinEdgeWeight(Number(e.target.value))}
          />
        </div>

        <button style={styles.button} onClick={fetchGraph} disabled={loading}>
          {loading ? "Loading..." : "Load Graph"}
        </button>

        {err ? <div style={styles.error}>⚠️ {err}</div> : null}

        <div style={styles.stats}>
          <div><b>Nodes:</b> {data.nodes?.length || 0}</div>
          <div><b>Links:</b> {data.links?.length || 0}</div>
        </div>
      </div>

      {/* Graph Canvas */}
      <div style={styles.canvasWrap}>
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          backgroundColor={PALETTE.bg}
          nodeLabel={(n) => `${n.id}\nPTS: ${Number(n.val ?? 0)}`}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.08}
          cooldownTicks={150}
          onNodeHover={(node) => setHoverNode(node || null)}
          onNodeClick={(node) => {
            if (!node) return;
            setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
          }}
          onBackgroundClick={() => setSelectedNodeId(null)}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.id;
            const size = nodeSize(node);
            const nodeId = node.id;
            const isActive = !activeId || isNeighborOfActive(nodeId);
            const isFaded = activeId && !isActive;

            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
            ctx.fillStyle = isFaded ? PALETTE.nodeFaded : PALETTE.node;
            ctx.fill();

            if (activeId && nodeId === activeId) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, size * 2.05, 0, 2 * Math.PI, false);
              ctx.fillStyle = PALETTE.glow;
              ctx.fill();
            }

            const fontSize = 12 / globalScale;
            if (globalScale > 1.15 || (activeId && nodeId === activeId) || (hoverNode && hoverNode.id === nodeId)) {
              ctx.font = `${fontSize}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = isFaded ? "rgba(226,232,240,0.25)" : "rgba(226,232,240,0.90)";
              ctx.fillText(label, node.x, node.y + size + 2 / globalScale);
            }
          }}
          linkWidth={(link) => {
            const w = Number(link.weight ?? 1);
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            const isRelevant = !activeId || s === activeId || t === activeId;
            const width = Math.max(1, w * 0.9);
            return isRelevant ? width : Math.max(0.7, width * 0.45);
          }}
          linkColor={(link) => {
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            if (!activeId) return PALETTE.edge;
            if (s === activeId) return PALETTE.outEdge;
            if (t === activeId) return PALETTE.inEdge;
            return PALETTE.edgeFaded;
          }}
        />

        {hoverNode ? (
          <div style={styles.tooltip}>
            <div style={{ fontWeight: 800 }}>{hoverNode.id}</div>
            <div style={{ opacity: 0.9 }}>PTS: {Number(hoverNode.val ?? 0)}</div>
            <div style={{ opacity: 0.75, marginTop: 6 }}>
              {selectedNodeId ? "click again to unselect" : "click to lock highlight"}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  page: { display: "grid", gridTemplateColumns: "340px 1fr", height: "100vh", background: PALETTE.bg, color: PALETTE.text, fontFamily: "system-ui, sans-serif" },
  sidebar: { borderRight: `1px solid ${PALETTE.cardBorder}`, padding: 16, background: `linear-gradient(180deg, ${PALETTE.sidebarBgTop}, ${PALETTE.sidebarBgBottom})`, overflow: "auto" },
  title: { fontSize: 18, fontWeight: 900, marginBottom: 6 },
  subTitle: { fontSize: 12, opacity: 0.8, marginBottom: 14, lineHeight: 1.35 },
  formRow: { marginBottom: 10, marginRight: "16px" },
  label: { display: "block", fontSize: 12, opacity: 0.85, marginBottom: 6 },
  input: { width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${PALETTE.inputBorder}`, background: PALETTE.inputBg, color: PALETTE.text, outline: "none" },
  button: { width: "100%", padding: "10px", borderRadius: 12, border: `1px solid ${PALETTE.cardBorder}`, background: "rgba(99,102,241,0.18)", color: PALETTE.text, cursor: "pointer", fontWeight: 800, marginTop: 6 },
  error: { marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(251,113,133,0.14)", fontSize: 12 },
  stats: { marginTop: 12, fontSize: 12, opacity: 0.9, lineHeight: 1.6 },
  canvasWrap: { position: "relative" },
  inspector: { marginTop: 14, padding: 12, borderRadius: 12, border: `1px solid ${PALETTE.cardBorder}`, background: "rgba(15,23,42,0.45)" },
  inspectorHeader: { marginBottom: 10 },
  inspectorGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 12 }, // Stacked as requested
  inspectorCol: { padding: 10, borderRadius: 12, border: `1px solid ${PALETTE.cardBorder}`, background: PALETTE.cardBg, maxHeight: "220px", overflowY: "auto" },
  inspectorTitle: { fontSize: 12, marginBottom: 8 },
  list: { display: "flex", flexDirection: "column", gap: 6 },
  listRow: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "6px 8px", borderRadius: 10, background: "rgba(148,163,184,0.10)", border: "1px solid rgba(148,163,184,0.18)", maxWidth: "100%", wordBreak: "break-word", overflow: "hidden" },
  listLeft: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "normal", wordBreak: "break-word", maxWidth: "70%" },
  listRight: { fontWeight: 900, opacity: 0.95 },
  empty: { fontSize: 12, opacity: 0.75, padding: "6px 2px" },
  tooltip: { position: "absolute", left: 14, top: 14, padding: 12, borderRadius: 12, border: `1px solid ${PALETTE.cardBorder}`, background: "rgba(15,23,42,0.72)", backdropFilter: "blur(10px)", fontSize: 12, pointerEvents: "none" },
  statsPanelSidebar: { marginBottom: 18, padding: 12, borderRadius: 12, border: `1px solid ${PALETTE.cardBorder}`, background: "rgba(15,23,42,0.45)" },
  statsPanelTitle: { fontSize: 16, fontWeight: 900, marginBottom: 10 },
  statsPanelLoading: { fontSize: 13, opacity: 0.8, marginTop: 10 },
  statsPanelError: { color: PALETTE.inEdge, fontSize: 13, marginTop: 10 },
  statsPanelContent: { marginTop: 8 },
  statsPanelList: { listStyle: "none", padding: 0, margin: 0, fontSize: 14, lineHeight: 1.7 },
};