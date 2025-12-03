from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from algorithm_runner import AlgorithmRunner
import time
from algorithms.pathfinding import dijkstra_grid, astar_grid, bfs_grid, dfs_grid, greedy_best_first_grid
import threading
import osmnx as ox
import networkx as nx
from networkx.algorithms.simple_paths import shortest_simple_paths

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store runners per session (for demo, use a dict; production: use session IDs)
runners = {}

# Load the OSM graph once at startup (thread-safe)
G = None
G_lock = threading.Lock()

try:
    import sklearn
except ImportError:
    sklearn = None

def get_osm_graph():
    global G
    with G_lock:
        if G is None:
            G = ox.graph_from_place('Washington, District of Columbia, USA', network_type='drive')
        return G

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    emit('connected', {'message': 'Connected to server'})

@socketio.on('init_algorithm')
def handle_init(data):
    # Initialize AlgorithmRunner and store in runners
    # runners[session_id] = AlgorithmRunner(...)
    # emit initial state
    pass

@socketio.on('next_step')
def handle_next(data):
    # Call runner.next_step(), emit new state
    pass

@socketio.on('previous_step')
def handle_prev(data):
    # ...existing code...
    pass

@socketio.on('run_pathfinding')
def handle_run_pathfinding(data):
    rows = data.get('rows', 10)
    cols = data.get('cols', 10)
    start = tuple(data.get('start', (0, 0)))
    end = tuple(data.get('end', (rows-1, cols-1)))
    obstacles = set(tuple(map(int, cell.split(','))) for cell in data.get('obstacles', []))
    algorithm = data.get('algorithm', 'dijkstra')
    # --- Fix: flush output and ensure timing is outside of emit ---
    import sys
    sys.stdout.flush()
    t0 = time.perf_counter_ns()
    if algorithm == 'dijkstra':
        path, visited = dijkstra_grid(rows, cols, start, end, obstacles)
    elif algorithm == 'astar':
        path, visited = astar_grid(rows, cols, start, end, obstacles)
    elif algorithm == 'bfs':
        path, visited = bfs_grid(rows, cols, start, end, obstacles)
    elif algorithm == 'dfs':
        path, visited = dfs_grid(rows, cols, start, end, obstacles)
    elif algorithm == 'greedy':
        path, visited = greedy_best_first_grid(rows, cols, start, end, obstacles)
    else:
        path, visited = [], []
    t1 = time.perf_counter_ns()
    elapsed_ms = (t1 - t0) / 1_000_000
    emit('pathfinding_result', {
        'path': path,
        'visited': visited,
        'time_ms': max(1, int(round(elapsed_ms)))
    })

@app.route('/api/road_route', methods=['POST'])
def road_route():
    if sklearn is None:
        return jsonify({'error': 'scikit-learn is required for nearest_nodes. Please install it: pip install scikit-learn'}), 500

    data = request.get_json()
    try:
        start = tuple(map(float, data['start']))  # [lat, lng]
        end = tuple(map(float, data['end']))      # [lat, lng]
        algorithm = data.get('algorithm', 'dijkstra')
    except Exception:
        return jsonify({'error': 'Invalid coordinates'}), 400
    G = get_osm_graph()
    try:
        orig_node = ox.nearest_nodes(G, start[1], start[0])
        dest_node = ox.nearest_nodes(G, end[1], end[0])
        if algorithm == 'astar':
            route = nx.astar_path(G, orig_node, dest_node, weight='length')
        elif algorithm == 'bfs' or algorithm == 'dfs' or algorithm == 'greedy':
            # Use unweighted shortest path for BFS, DFS, Greedy
            route = nx.shortest_path(G, orig_node, dest_node)
        else:
            route = nx.shortest_path(G, orig_node, dest_node, weight='length')
        route_coords = [(G.nodes[n]['y'], G.nodes[n]['x']) for n in route]
        return jsonify({'route': route_coords})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/road_routes', methods=['POST'])
def road_routes():
    if sklearn is None:
        return jsonify({'error': 'scikit-learn is required for nearest_nodes. Please install it: pip install scikit-learn'}), 500

    data = request.get_json()
    try:
        start = tuple(map(float, data['start']))  # [lat, lng]
        end = tuple(map(float, data['end']))      # [lat, lng]
        k = int(data.get('k', 3))
    except Exception:
        return jsonify({'error': 'Invalid coordinates'}), 400
    G = get_osm_graph()
    try:
        orig_node = ox.nearest_nodes(G, start[1], start[0])
        dest_node = ox.nearest_nodes(G, end[1], end[0])
        # Get k-shortest paths (by length)
        paths = []
        for i, path in enumerate(shortest_simple_paths(G, orig_node, dest_node, weight='length')):
            coords = [(G.nodes[n]['y'], G.nodes[n]['x']) for n in path]
            paths.append(coords)
            if len(paths) >= k:
                break
        return jsonify({'routes': paths})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    socketio.run(app, debug=True)