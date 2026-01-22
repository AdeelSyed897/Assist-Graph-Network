import math
import numpy as np
from dataHandler import loadAssShots, loadPlayerPts
from graphBuilder import buildGraph  

GAME_ID = "0022401021"
TEAM_ID = 1610612739
JSON_PATH = "assShotCavs.json"


def scan_player_pts(player_pts: dict):
    bad = []
    for name, v in player_pts.items():
        try:
            fv = float(v)
        except Exception:
            bad.append((name, v, "NON_NUMERIC"))
            continue
        if not math.isfinite(fv):
            bad.append((name, v, "NON_FINITE"))
    return bad


def scan_matrix(G):
    M = G.matrix
    bad_idx = np.argwhere(~np.isfinite(M))
    return bad_idx  # array of (i,j) pairs


def main():
    print("=== Debug non-finite values ===")
    print("GAME_ID:", GAME_ID)
    print("TEAM_ID:", TEAM_ID)

    # 1) check player pts
    player_pts = loadPlayerPts(TEAM_ID, GAME_ID)  # your function returns dict
    bad_pts = scan_player_pts(player_pts)
    print(f"\nPTS entries: {len(player_pts)}")
    print(f"Bad PTS entries: {len(bad_pts)}")
    if bad_pts:
        print("Example bad PTS rows:")
        for row in bad_pts[:10]:
            print(row)

    # 2) build graph and scan matrix
    G = buildGraph(GAME_ID, TEAM_ID)  # your builder
    bad_cells = scan_matrix(G)
    print(f"\nMatrix shape: {G.matrix.shape}")
    print(f"Non-finite matrix cells: {len(bad_cells)}")

    if len(bad_cells) > 0:
        # show first few cells with names
        print("\nExample non-finite cells (passer -> shooter):")
        for i, j in bad_cells[:10]:
            passer = G.names[int(i)] if int(i) < len(G.names) else f"i={i}"
            shooter = G.names[int(j)] if int(j) < len(G.names) else f"j={j}"
            print(f"{passer} -> {shooter} = {G.matrix[int(i)][int(j)]}")

    # 3) scan snapshot itself (THIS matches your FastAPI crash)
    snap = G.graph_snapshot(minEdgeWeight=1)
    bad_payload = []

    for n in snap["nodes"]:
        v = n.get("val")
        if v is None:
            continue
        if not math.isfinite(float(v)):
            bad_payload.append(("node", n))

    for l in snap["links"]:
        w = l.get("weight")
        if w is None:
            continue
        if not math.isfinite(float(w)):
            bad_payload.append(("link", l))

    print(f"\nNon-finite values in payload: {len(bad_payload)}")
    if bad_payload:
        print("Example payload offenders:")
        for x in bad_payload[:10]:
            print(x)


if __name__ == "__main__":
    main()
