from DAG import Graph
from dataHandler import loadAssShots, loadPlayerPts

def buildGraph(game_id, team_id):
    plays = loadAssShots("assShotPacers.json", game_id)
    playerPts = loadPlayerPts(team_id, game_id)

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
