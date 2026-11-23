import math
def alphabeta(node, depth, alpha, beta, maximizingPlayer, values, tree):
    """
    node: current node index
    depth: remaining depth
    alpha: best value that maximizer currently can guarantee
    beta: best value that minimizer currently can guarantee
    maximizingPlayer: boolean – True for maximizer's move, False for minimizer
    values: dictionary of leaf node values
    tree: adjacency list representing the game tree
    """

    if depth == 0 or node not in tree:
        return values[node]

    if maximizingPlayer:
        maxEval = -math.inf
        for child in tree[node]:
            eval = alphabeta(child, depth - 1, alpha, beta, False, values, tree)
            maxEval = max(maxEval, eval)
            alpha = max(alpha, eval)
            if beta <= alpha:
                break  # ❗ Prune
        return maxEval

    else:
        minEval = math.inf
        for child in tree[node]:
            eval = alphabeta(child, depth - 1, alpha, beta, True, values, tree)
            minEval = min(minEval, eval)
            beta = min(beta, eval)
            if beta <= alpha:
                break  # ❗ Prune
        return minEval


if __name__ == "__main__":

    tree = {
        "A": ["B", "C"],
        "B": ["D", "E"],
        "C": ["F", "G"]
    }

    values = {
        "D": 3,
        "E": 5,
        "F": 2,
        "G": 9
    }

    result = alphabeta("A", depth=3, alpha=-math.inf, beta=math.inf,
                       maximizingPlayer=True, values=values, tree=tree)

    print("Optimal value using Alpha-Beta Pruning:", result)
