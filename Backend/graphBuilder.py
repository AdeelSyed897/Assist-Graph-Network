from DAG import Graph
from dataHandler import loadAssShots, loadPlayerPts

teamID = {
    "Pacers": 1610612754,
    "Cavs": 1610612739,
    "Warriors": 1610612744,
    "OKC": 1610612760,
}

def buildGraph(game_id, teamName):
    path = f"assShot{teamName}.json"
    plays = loadAssShots(path, game_id)
    playerPts = loadPlayerPts(teamID[teamName], game_id)

    names = set(playerPts.keys())
    for play in plays:
        a = play.get("assist_player")
        s = play.get("player")
        if a: 
            names.add(a)
        if s: 
            names.add(s)


    graph = Graph(list(names))


    for name, pts in playerPts.items():
        graph.setNodeVal(name, pts)


    for play in plays:
        passer = play.get("assist_player")
        shooter = play.get("player")
        val = play.get("shot_value", 1)
        graph.directedEdge(passer, shooter, val)

    return graph
