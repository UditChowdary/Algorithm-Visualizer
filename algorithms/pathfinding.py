import heapq
from collections import deque

def dijkstra_grid(rows, cols, start, end, obstacles=None):
    if obstacles is None:
        obstacles = set()
    # 4-directional movement
    moves = [(-1,0),(1,0),(0,-1),(0,1)]
    dist = [[float('inf') for _ in range(cols)] for _ in range(rows)]
    prev = [[None for _ in range(cols)] for _ in range(rows)]
    visited = []
    heap = [(0, start)]
    dist[start[0]][start[1]] = 0

    while heap:
        d, (r, c) = heapq.heappop(heap)
        if (r, c) == end:
            break
        if (r, c) in visited or (r, c) in obstacles:
            continue
        visited.append((r, c))
        for dr, dc in moves:
            nr, nc = r+dr, c+dc
            if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in obstacles:
                if dist[nr][nc] > d + 1:
                    dist[nr][nc] = d + 1
                    prev[nr][nc] = (r, c)
                    heapq.heappush(heap, (dist[nr][nc], (nr, nc)))
    # Reconstruct path
    path = []
    curr = end
    while curr and dist[curr[0]][curr[1]] != float('inf'):
        path.append(curr)
        curr = prev[curr[0]][curr[1]]
    path.reverse()
    return path, visited

def astar_grid(rows, cols, start, end, obstacles=None):
    if obstacles is None:
        obstacles = set()
    moves = [(-1,0),(1,0),(0,-1),(0,1)]
    dist = [[float('inf') for _ in range(cols)] for _ in range(rows)]
    prev = [[None for _ in range(cols)] for _ in range(rows)]
    visited = []
    heap = [(0 + abs(start[0]-end[0]) + abs(start[1]-end[1]), 0, start)]
    dist[start[0]][start[1]] = 0

    while heap:
        f, d, (r, c) = heapq.heappop(heap)
        if (r, c) == end:
            break
        if (r, c) in visited or (r, c) in obstacles:
            continue
        visited.append((r, c))
        for dr, dc in moves:
            nr, nc = r+dr, c+dc
            if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in obstacles:
                g = d + 1
                h = abs(nr-end[0]) + abs(nc-end[1])
                if dist[nr][nc] > g:
                    dist[nr][nc] = g
                    prev[nr][nc] = (r, c)
                    heapq.heappush(heap, (g+h, g, (nr, nc)))
    path = []
    curr = end
    while curr and dist[curr[0]][curr[1]] != float('inf'):
        path.append(curr)
        curr = prev[curr[0]][curr[1]]
    path.reverse()
    return path, visited

def bfs_grid(rows, cols, start, end, obstacles=None):
    if obstacles is None:
        obstacles = set()
    moves = [(-1,0),(1,0),(0,-1),(0,1)]
    prev = [[None for _ in range(cols)] for _ in range(rows)]
    visited = []
    queue = deque([start])
    seen = set([start])
    found = False
    while queue:
        r, c = queue.popleft()
        if (r, c) == end:
            found = True
            break
        visited.append((r, c))
        for dr, dc in moves:
            nr, nc = r+dr, c+dc
            if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in obstacles and (nr, nc) not in seen:
                prev[nr][nc] = (r, c)
                queue.append((nr, nc))
                seen.add((nr, nc))
    path = []
    if found:
        curr = end
        while curr:
            path.append(curr)
            curr = prev[curr[0]][curr[1]]
        path.reverse()
    return path, visited

def dfs_grid(rows, cols, start, end, obstacles=None):
    if obstacles is None:
        obstacles = set()
    moves = [(-1,0),(1,0),(0,-1),(0,1)]
    prev = [[None for _ in range(cols)] for _ in range(rows)]
    visited = []
    stack = [start]
    seen = set([start])
    found = False
    while stack:
        r, c = stack.pop()
        if (r, c) == end:
            found = True
            break
        if (r, c) in obstacles or (r, c) in visited:
            continue
        visited.append((r, c))
        for dr, dc in moves:
            nr, nc = r+dr, c+dc
            if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in obstacles and (nr, nc) not in seen:
                prev[nr][nc] = (r, c)
                stack.append((nr, nc))
                seen.add((nr, nc))
    path = []
    if found:
        curr = end
        while curr:
            path.append(curr)
            curr = prev[curr[0]][curr[1]]
        path.reverse()
    return path, visited

def greedy_best_first_grid(rows, cols, start, end, obstacles=None):
    if obstacles is None:
        obstacles = set()
    moves = [(-1,0),(1,0),(0,-1),(0,1)]
    prev = [[None for _ in range(cols)] for _ in range(rows)]
    visited = []
    heap = [(abs(start[0]-end[0]) + abs(start[1]-end[1]), start)]
    seen = set([start])
    found = False
    while heap:
        h, (r, c) = heapq.heappop(heap)
        if (r, c) == end:
            found = True
            break
        if (r, c) in obstacles or (r, c) in visited:
            continue
        visited.append((r, c))
        for dr, dc in moves:
            nr, nc = r+dr, c+dc
            if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in obstacles and (nr, nc) not in seen:
                prev[nr][nc] = (r, c)
                heapq.heappush(heap, (abs(nr-end[0]) + abs(nc-end[1]), (nr, nc)))
                seen.add((nr, nc))
    path = []
    if found:
        curr = end
        while curr:
            path.append(curr)
            curr = prev[curr[0]][curr[1]]
        path.reverse()
    return path, visited