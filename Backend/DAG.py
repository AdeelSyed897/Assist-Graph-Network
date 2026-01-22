import numpy as np
import matplotlib.pyplot as plt
import math

class Graph:
    def __init__(self, names):
        self.index = {}
        self.names = list(names)
        self.matrix = np.zeros((len(names),len(names)))
        counter=0
        for name in names:
            self.index[name]=counter
            counter+=1

    def setNodeVal(self, name, val):
        self.matrix[self.index[name]][self.index[name]] = val
    
    def directedEdge(self, passer, shooter, val):
        if passer is None or shooter is None:
            return
        if passer not in self.index or shooter not in self.index:
            return
        self.matrix[self.index[passer]][self.index[shooter]] += float(val)

    def graph_snapshot(self, minEdgeWeight=1):

        nodes = []
        for name in self.names:
            val = self.matrix[self.index[name]][self.index[name]]
            nodes.append({"id": name, "val": float(val)})

        links = []
        for passer in self.names:
            for shooter in self.names:
                weight = self.matrix[self.index[passer]][self.index[shooter]]
                if passer != shooter and weight >= minEdgeWeight:
                    links.append({
                        "source": passer,
                        "target": shooter,
                        "weight": float(weight)
                    })

        return {"nodes": nodes, "links": links}
        

    def printMatrix(self):
        print(self.matrix)

    
    #analytics
    def scoring(self,name):
        return self.matrix[self.index[name]][self.index[name]]

    def getTeamPts(self):
        return float(np.trace(self.matrix))
    
    def offCreated(self, name):
        pts = 0
        for i in range(len(self.names)):
            pts += self.matrix[self.index[name]][i]
        return pts

    def playmaking(self,name):
        return self.offCreated(name) - self.scoring(name)

    def recieving(self, name):
        pts = 0
        for i in range(len(self.names)):
            pts += self.matrix[i][self.index[name]]
        return pts - self.scoring(name)
    
    def offenseShare(self, name):
        return self.offCreated(name) / self.getTeamPts()

    def eigenCentrality(self, maxItr):
        adjMatrix = self.matrix.copy()
        
        for i in range(len(self.names)):
            adjMatrix[i][i] = adjMatrix[i][i] * 0.5
        
        unityVector = np.ones(len(self.names), dtype=float)
        prevNormVal = 0
        currNormVal = 1

        while abs(currNormVal - prevNormVal) > 1e-8 and maxItr!=0:
            prevNormVal = currNormVal
            unityVector = np.dot(adjMatrix, unityVector)
            currNormVal = np.linalg.norm(unityVector)
            if currNormVal==0:
                return {p: 0.0 for p in self.names}
            unityVector = unityVector/currNormVal
            maxItr-=1
        
        centrality = {}
        for i in range(len(self.names)):
            centrality[self.names[i]] = float(unityVector[i])
        
        return centrality

