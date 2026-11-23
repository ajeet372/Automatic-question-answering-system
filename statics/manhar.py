graph ={
"A":['B','C'],
'B':['D','E'],
'C':['F'],
'D':[],
'E':[],
'F':[]
}
queue = ['A']
visited = ['A']
while len(queue) >0:
    current = queue.pop(0)
    print(current,end="")
graph[current]:
