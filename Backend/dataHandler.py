import json
import math
from nba_api.stats.endpoints import boxscoretraditionalv2

teamID = {
    "Pacers": 1610612754,
    "Cavs": 1610612739,
    "Warriors": 1610612744,
    "OKC": 1610612760,
}

def loadGameIDs(teamName):
    pathName = f"assShot{teamName}.json"
    with open(pathName) as f:
        data = json.load(f)
        
    gameIDs = set()
    for play in data['results']:
        gameIDs.add(play['gid'])

    return sorted(list(gameIDs))


def loadAssShots(pathName, gameID):
    with open(pathName) as f:
        data = json.load(f)
    
    gameData = []
    for play in data["results"]:
        if play['gid']==gameID:
            gameData.append(play)
            
    return gameData


def loadPlayerPts(teamID, gameID):
    boxscore = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=gameID)
    playerStats = boxscore.get_data_frames()[0]
    teamPlayers = playerStats[playerStats["TEAM_ID"] == teamID]
    playersPointsDF = teamPlayers[["PLAYER_NAME", "PTS"]]
    teamPlayers = playerStats[playerStats["TEAM_ID"] == teamID]
    playerPts = {}
    for index, row in playersPointsDF.iterrows():
        pts = row['PTS']
        try:
            pts = float(pts)
        except:
            pts = 0.0
        if  not math.isfinite(pts):
            pts = 0.0
        playerPts[row["PLAYER_NAME"]]= pts
    
    return playerPts


