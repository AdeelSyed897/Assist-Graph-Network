from fastapi import FastAPI, Request
from graphBuilder import buildGraph
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/graph")
def get_graph(game_id: str, team_id: int, min_edge_weight: int = 1):
    graph = buildGraph(game_id, team_id)
    app.state.graph = graph
    app.state.min_edge_weight = min_edge_weight
    snapshot = graph.graph_snapshot(minEdgeWeight=min_edge_weight)
    return snapshot


@app.get("/player/{name}")
def get_player_stats(name: str, request: Request):
    if not hasattr(request.app.state, "graph"):
        return {"error": "graph_not_loaded"}

    graph = request.app.state.graph
    return {
        "name": name,
        "scoring": graph.scoring(name),
        "playmaking": graph.playmaking(name),
        "off_created": graph.offCreated(name),
        "offense_share": graph.offenseShare(name),
        "team_pts": graph.getTeamPts()
    }

@app.get("/centrality")
def get_centrality(request: Request):
    if not hasattr(request.app.state, "graph"):
        return {"error": "graph_not_loaded"}
    
    graph = request.app.state.graph
    return graph.eigenCentrality(maxItr=50)